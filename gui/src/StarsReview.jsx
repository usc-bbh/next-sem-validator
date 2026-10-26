import React, { useState } from "react";
import { passed as passRule } from "../stars-parser/fields.js";
import { C, HEAD, BODY, eyebrow, primaryButton, secondaryButton } from "./theme";
import { GRADE_GROUPS, gradeLabel, groupCompleted, isKnownGrade, sumUnits, termLabel, unitTotals } from "./starsDisplay";

// ─────────────────────────────────────────────────────────────
// The review screen (STARS_PARSER_DESIGN.md §9).
//
// Shows what was read from the report, flags anything doubtful, and lets the
// student correct it. After a failed parse it opens empty, with the reason,
// so a failure is never a dead end. Nothing here leaves the browser: edits
// live in component state and are handed to the app only on save.
//
// Two layouts share one editor: a dialog over the main page (StarsReview),
// and a full page with the PDF beside it (StarsSideBySide).
//
// Rule 1 of §9: any row the student adds or changes gets origin: "student",
// and the validator won't treat such a row as proof of a prerequisite on its
// own. Removing a row just removes it.
// ─────────────────────────────────────────────────────────────

const CLASS_LEVELS = ["Freshman", "Sophomore", "Junior", "Senior"];

// What a failure's `check` means, in words a student can act on.
const FAILURE_TEXT = {
  noText: "This PDF has no readable text.",
  unreadable: "We couldn't open this PDF.",
  notStars: "This doesn't look like a STARS report.",
  layout: "This PDF isn't laid out the way STARS reports usually are.",
  landmarks: "Parts of your report we rely on are missing or unfamiliar.",
  masterListRows: "We couldn't read every row of your course list.",
  unitsEarned: "We couldn't match your unit totals, so we may have missed a course.",
  unlabelledRows: "Your report has a section we don't recognise that lists courses.",
};

// Failures whose message says more than the headline above, worth showing.
const DETAIL_CHECKS = new Set(["layout", "landmarks", "masterListRows", "unitsEarned", "unlabelledRows"]);

// "csci104" / "CSCI  104" → "CSCI 104", the parser's spacing.
function tidyCode(raw) {
  const t = raw.trim().toUpperCase();
  const m = t.match(/^([A-Z]{2,4}) *(\d{3}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : t;
}

// One line saying why a row may not count the way the student expects.
function flagFor(row, report, inProgress) {
  if (row.origin === "student") return { tone: "info", text: "Added or changed by you" };
  if (inProgress) return null;
  if (row.passed === false) {
    return { tone: "warn", text: row.grade === "W" ? "Withdrawn: won't count toward prerequisites" : "Won't count toward prerequisites" };
  }
  if (row.source === "transfer" || row.source === "exam") {
    const eq = report.equivalents.find((e) => e.from === row.code);
    return eq
      ? { tone: "ok", text: `Counts as ${eq.to}` }
      : { tone: "warn", text: "Counts toward your units, not toward prerequisites" };
  }
  if (row.source === "transfer_generic") {
    return { tone: "warn", text: "Counts toward your units, not toward prerequisites" };
  }
  return null;
}

const TONE = { warn: C.warn, ok: C.ok, info: "#1d4ed8" };

// The draft report and every edit the editor can make to it.
function useStarsDraft(initial) {
  const [draft, setDraft] = useState(initial);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // A changed row becomes the student's claim.
  const editRow = (list, index, patch) =>
    setDraft((d) => {
      const rows = d[list].map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch, origin: "student" };
        if (list === "completedCourses") next.passed = passRule(next);
        return next;
      });
      return { ...d, [list]: rows };
    });

  const removeRow = (list, index) =>
    setDraft((d) => ({ ...d, [list]: d[list].filter((_, i) => i !== index) }));

  const moveRow = (from, index) =>
    setDraft((d) => {
      const row = d[from][index];
      const toCompleted = from === "inProgressCourses";
      const moved = toCompleted
        ? { ...row, grade: "", flags: row.flags.filter((f) => f !== ">IP"), origin: "student" }
        : { ...row, grade: "RG", flags: [...row.flags.filter((f) => f !== ">IP"), ">IP"], passed: null, origin: "student" };
      if (toCompleted) moved.passed = passRule(moved);
      const to = toCompleted ? "completedCourses" : "inProgressCourses";
      return { ...d, [from]: d[from].filter((_, i) => i !== index), [to]: [...d[to], moved] };
    });

  const addRow = (row) =>
    setDraft((d) => {
      const list = row.passed === null ? "inProgressCourses" : "completedCourses";
      return { ...d, [list]: [...d[list], row] };
    });

  return { draft, update, editRow, removeRow, moveRow, addRow };
}

const canSave = (draft) => CLASS_LEVELS.includes(draft.classLevel);

export default function StarsReview({ initial, mode, failure, onConfirm, onCancel, onSideBySide }) {
  const editor = useStarsDraft(initial);
  const { draft } = editor;
  const ready = canSave(draft);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stars-review-title"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,24,0.45)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: C.card, borderRadius: 16, width: "100%", maxWidth: 820, boxShadow: "0 30px 70px -20px rgba(28,28,31,0.45)", overflow: "hidden", fontFamily: BODY, color: C.ink }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.line}`, position: "relative" }}>
          <button onClick={onCancel} aria-label="Close without saving" title="Close without saving" autoFocus
            style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 22, lineHeight: 1, width: 32, height: 32, borderRadius: 8 }}>
            ×
          </button>
          <ReviewHeading mode={mode} />
        </div>

        <div style={{ padding: "18px 22px" }}>
          <StarsEditor editor={editor} mode={mode} failure={failure} />
        </div>

        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", flexWrap: "wrap", background: C.page }}>
          {onSideBySide && (
            <button onClick={() => onSideBySide(draft)} className="outline-btn" style={{ ...secondaryButton, marginRight: "auto" }}>
              View next to your PDF
            </button>
          )}
          {!ready && <span style={{ fontSize: 12.5, color: C.muted }}>Choose your class level to continue.</span>}
          <button onClick={onCancel} className="outline-btn" style={secondaryButton}>Cancel</button>
          <button onClick={() => onConfirm(draft)} disabled={!ready}
            style={{ ...primaryButton, opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}>
            Looks right
          </button>
        </div>
      </div>
    </div>
  );
}

// The same editor as a full page, with the uploaded PDF on the left so the
// student can check each line against the report itself.
export function StarsSideBySide({ initial, mode, failure, pdfUrl, onConfirm, onCancel, onPopOut }) {
  const editor = useStarsDraft(initial);
  const { draft } = editor;
  const ready = canSave(draft);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stars-review-title"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: C.page, display: "flex", flexDirection: "column", fontFamily: BODY, color: C.ink }}>
      <style>{`
        .side-by-side { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; }
        .side-by-side > * { min-height: 0; }
        @media (max-width: 900px) {
          .side-by-side { grid-template-columns: 1fr; grid-template-rows: 55vh auto; overflow-y: auto; }
        }
      `}</style>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.line}`, background: C.card, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto" }}><ReviewHeading mode={mode} compact /></div>
        {!ready && <span style={{ fontSize: 12.5, color: C.muted }}>Choose your class level to save.</span>}
        <button onClick={onCancel} className="outline-btn" style={secondaryButton}>Back</button>
        <button onClick={() => onConfirm(draft)} disabled={!ready}
          style={{ ...primaryButton, opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}>
          Save details
        </button>
      </div>
      <div className="side-by-side">
        <iframe src={`${pdfUrl}#view=FitH`} title="Your STARS report (PDF)"
          style={{ width: "100%", height: "100%", border: "none", borderRight: `1px solid ${C.line}`, background: "#525659" }} />
        <div style={{ overflowY: "auto", padding: "14px 22px 18px", background: C.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={eyebrow}>What we read</div>
            {onPopOut && (
              <button onClick={() => onPopOut(draft)} title="Pop out: details only, without the PDF" aria-label="Pop out details without the PDF"
                className="outline-btn" style={{ ...secondaryButton, padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>↗</span> Pop out
              </button>
            )}
          </div>
          <StarsEditor editor={editor} mode={mode} failure={failure} />
        </div>
      </div>
    </div>
  );
}

function ReviewHeading({ mode, compact }) {
  return (
    <>
      <div style={{ ...eyebrow, color: C.cardinal, letterSpacing: 3, marginBottom: compact ? 2 : 6 }}>Your STARS report</div>
      <div id="stars-review-title" style={{ fontSize: compact ? 18 : 22, fontWeight: 700, fontFamily: HEAD }}>
        {mode === "failed" ? "Enter your STARS details" : "Check what we read from your report"}
      </div>
      {!compact && (
        <div style={{ fontSize: 13, color: C.body, marginTop: 6 }}>
          Your report stays on your device. Nothing here is sent to a server or saved.
        </div>
      )}
    </>
  );
}

function StarsEditor({ editor, mode, failure }) {
  const { draft, update, editRow, removeRow, moveRow, addRow } = editor;
  const groups = groupCompleted(draft.completedCourses);
  const ipTerms = [...new Set(draft.inProgressCourses.map((r) => r.term).filter(Boolean))];
  const [open, setOpen] = useState(() => new Set(["inProgress"]));
  const toggle = (key) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allOpen = groups.every((g) => open.has(g.key));
  const setAll = (on) =>
    setOpen((s) => {
      const next = new Set(s);
      for (const g of groups) {
        if (on) next.add(g.key);
        else next.delete(g.key);
      }
      return next;
    });

  return (
    <>
      {mode === "failed" && (
        <Notice tone={C.bad} bg="#FDF2F2">
          <b>{FAILURE_TEXT[failure?.check] ?? "We couldn't read your report."}</b> Fill in what the checker needs below:
          your class level, your GPA if you know it, and your courses.
          {failure?.message && DETAIL_CHECKS.has(failure.check) && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Details: {failure.message}</div>}
        </Notice>
      )}
      {draft.meta.warnings.map((w, i) => (
        <Notice key={i} tone={C.warn} bg="#FEFAEC">{w.message}</Notice>
      ))}

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...eyebrow, margin: "0 0 8px" }}>In progress · {draft.inProgressCourses.length}</div>
        <Collapsible title={ipTerms.length === 1 ? termLabel(ipTerms[0]) : "This semester"} open={open.has("inProgress")} onToggle={() => toggle("inProgress")}
          count={draft.inProgressCourses.length} units={sumUnits(draft.inProgressCourses)}>
          <CourseRows list="inProgressCourses" items={draft.inProgressCourses.map((row, index) => ({ row, index }))} report={draft} inProgress showTerm={ipTerms.length > 1}
            onEdit={editRow} onRemove={removeRow} onMove={moveRow} moveLabel="Move to completed" />
        </Collapsible>
      </div>

      <AddCourse onAdd={(row) => { addRow(row); setOpen((s) => new Set(s).add(row.passed === null ? "inProgress" : "term:")); }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Field label="Major">
          <input value={draft.major ?? ""} onChange={(e) => update({ major: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Class level (by units)">
          <select value={draft.classLevel ?? ""} onChange={(e) => update({ classLevel: e.target.value || null })} style={inputStyle}>
            <option value="">Choose…</option>
            {CLASS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="GPA" hint={draft.gpa !== null ? null : mode === "failed"
          ? "Leave blank if you don't know it. GPA minimums are then skipped, with a warning."
          : "Not on your report. Leave blank to skip GPA minimums (you'll get a warning)."}>
          <input type="number" min="0" max="4" step="0.001" value={draft.gpa ?? ""} placeholder="e.g. 3.45"
            onChange={(e) => update({ gpa: e.target.value === "" ? null : Number(e.target.value) })} style={inputStyle} />
        </Field>
      </div>

      <UnitTotals report={draft} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "4px 0 8px" }}>
        <div style={eyebrow}>Completed courses · {draft.completedCourses.length}</div>
        {groups.length > 1 && (
          <button onClick={() => setAll(!allOpen)} style={{ background: "none", border: "none", color: C.cardinal, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: HEAD, padding: 0 }}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {groups.length === 0 && <div style={{ fontSize: 13, color: C.faint, padding: "6px 0" }}>None.</div>}
      {groups.map((g, gi) => (
        <React.Fragment key={g.key}>
          {g.kind === "transfer" && groups[gi - 1]?.kind !== "transfer" && (
            <div style={{ ...eyebrow, fontSize: 9.5, margin: "14px 0 6px" }}>Transfer credit</div>
          )}
          <Collapsible title={g.title} open={open.has(g.key)} onToggle={() => toggle(g.key)}
            count={g.items.length} units={sumUnits(g.items.map((i) => i.row))}
            notPassed={g.items.filter((i) => i.row.passed === false).length}>
            <CourseRows list="completedCourses" items={g.items} report={draft} showTerm={g.kind === "transfer"}
              onEdit={editRow} onRemove={removeRow} onMove={moveRow} moveLabel="Move to in progress" />
          </Collapsible>
        </React.Fragment>
      ))}

      <div style={{ fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
        Courses you add or change are marked as yours. The checker won't treat them as proof of a prerequisite on their own;
        it'll warn you to double-check instead.
      </div>
    </>
  );
}

// The course list's totals beside what the report itself says, so a missed or
// extra row shows up as a mismatch.
function UnitTotals({ report }) {
  const t = unitTotals(report);
  const fmtU = (n) => `${n} ${n === 1 ? "unit" : "units"}`;
  const match = (a, b) => b === null || Math.abs(a - b) < 0.01;
  const earnedOk = match(t.completed, t.earned);
  const ipOk = match(t.inProgress, t.reportInProgress);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      <Stat ok={earnedOk} label="Completed"
        value={t.transfer ? `${fmtU(t.usc)} at USC + ${t.transfer} transfer = ${t.completed}` : fmtU(t.completed)}
        note={t.earned === null ? null : earnedOk ? "matches your report" : `your report says ${t.earned}`} />
      <Stat ok={ipOk} label="In progress" value={fmtU(t.inProgress)}
        note={t.reportInProgress === null ? null : ipOk ? "matches your report" : `your report says ${t.reportInProgress}`} />
    </div>
  );
}

function Stat({ label, value, note, ok }) {
  return (
    <div style={{ flex: "1 1 220px", border: `1px solid ${ok ? C.line : C.goldLine}`, background: ok ? C.page : "#FEFAEC", borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ ...eyebrow, fontSize: 9.5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 13.5, color: C.ink, fontWeight: 600, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 11.5, color: ok ? C.ok : C.warn, fontWeight: 600 }}>{ok ? "✓ " : ""}{note}</div>}
    </div>
  );
}

function AddCourse({ onAdd }) {
  const [adding, setAdding] = useState({ code: "", grade: "", units: "4", list: "completed" });

  const add = () => {
    const code = tidyCode(adding.code);
    if (!code) return;
    const inProgress = adding.list === "inProgress";
    const row = {
      term: "",
      code,
      rawCode: code.replace(" ", ""),
      title: "",
      units: Number(adding.units) || 0,
      grade: inProgress ? "RG" : adding.grade,
      suffixes: [],
      flags: inProgress ? [">IP"] : [],
      source: "usc",
      passed: null,
      origin: "student",
    };
    if (!inProgress) row.passed = passRule(row);
    onAdd(row);
    setAdding({ code: "", grade: "", units: "4", list: adding.list });
  };

  return (
    <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <Field label="Add a course">
        <input value={adding.code} placeholder="e.g. CSCI 104" onChange={(e) => setAdding({ ...adding, code: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && add()} style={{ ...inputStyle, width: 130 }} />
      </Field>
      <Field label="List">
        <select value={adding.list} onChange={(e) => setAdding({ ...adding, list: e.target.value })} style={inputStyle}>
          <option value="completed">Completed</option>
          <option value="inProgress">In progress</option>
        </select>
      </Field>
      {adding.list === "completed" && (
        <Field label="Grade">
          <GradeSelect value={adding.grade} onChange={(grade) => setAdding({ ...adding, grade })} style={inputStyle} />
        </Field>
      )}
      <Field label="Units">
        <input type="number" min="0" max="12" step="0.5" value={adding.units} onChange={(e) => setAdding({ ...adding, units: e.target.value })} style={{ ...inputStyle, width: 64 }} />
      </Field>
      <button onClick={add} disabled={!adding.code.trim()} className="outline-btn" style={secondaryButton}>Add</button>
    </div>
  );
}

// Grade codes as words. A code we don't know (a new STARS grade) is kept as
// an option of its own rather than silently replaced.
function GradeSelect({ value, onChange, label, style }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} title={gradeLabel(value)} style={style}>
      <option value="">No grade</option>
      {value && !isKnownGrade(value) && <option value={value}>{value}</option>}
      {GRADE_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(([code, text]) => <option key={code} value={code}>{text}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function Collapsible({ title, open, onToggle, count, units, notPassed = 0, children }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: open ? C.page : C.card, border: "none", cursor: "pointer", fontFamily: BODY, color: C.ink, textAlign: "left" }}>
        <span aria-hidden style={{ display: "inline-block", width: 10, color: C.faint, fontSize: 10, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}>▶</span>
        <span style={{ fontWeight: 600, fontSize: 14, fontFamily: HEAD }}>{title}</span>
        {notPassed > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: C.warn, border: `1px solid ${C.goldLine}`, background: "#FEFAEC", borderRadius: 999, padding: "1px 8px" }}>
            {notPassed} not passed
          </span>
        )}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
          {count} {count === 1 ? "course" : "courses"} · {units} {units === 1 ? "unit" : "units"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 8px 4px", borderTop: `1px solid ${C.line}` }}>
          {count === 0 ? <div style={{ fontSize: 13, color: C.faint, padding: "10px 4px" }}>None.</div> : children}
        </div>
      )}
    </div>
  );
}

function CourseRows({ list, items, report, inProgress, showTerm, onEdit, onRemove, onMove, moveLabel }) {
  return items.map(({ row, index }, n) => {
    const flag = flagFor(row, report, inProgress);
    return (
      <div key={`${row.term}-${row.code}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: n ? `1px solid ${C.line}` : "none", fontSize: 13, flexWrap: "wrap" }}>
        {showTerm && <span className="mono" style={{ width: 84, color: C.faint, fontSize: 11.5 }}>{termLabel(row.term)}</span>}
        <span style={{ width: 96, fontWeight: 600, fontFamily: HEAD }}>{row.code}</span>
        <span style={{ flex: "1 1 140px", minWidth: 0 }}>
          <span style={{ color: C.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{row.title}</span>
          {flag && <span style={{ fontSize: 11, color: TONE[flag.tone], fontWeight: 600 }}>{flag.text}</span>}
        </span>
        {!inProgress && (
          <GradeSelect label={`Grade for ${row.code}`} value={row.grade} onChange={(grade) => onEdit(list, index, { grade })}
            style={{ ...inputStyle, width: 168, padding: "4px 6px", fontSize: 12 }} />
        )}
        <span className="mono" style={{ width: 62, textAlign: "right", color: C.body, fontSize: 12, whiteSpace: "nowrap" }}>{row.units} {row.units === 1 ? "unit" : "units"}</span>
        <button onClick={() => onMove(list, index)} title={moveLabel} aria-label={`${moveLabel}: ${row.code}`} style={iconButton}>{inProgress ? "↓" : "↑"}</button>
        <button onClick={() => onRemove(list, index)} title="Remove" aria-label={`Remove ${row.code}`} style={{ ...iconButton, color: C.bad }}>×</button>
      </div>
    );
  });
}

// Shown in place of the form for a graduate report: there's nothing to fill
// in, because the checker only handles undergraduate requirements.
export function GraduateNotice({ onClose }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(20,20,24,0.45)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div style={{ background: C.card, borderRadius: 16, maxWidth: 440, padding: 24, boxShadow: "0 30px 70px -20px rgba(28,28,31,0.45)", fontFamily: BODY }}>
        <div style={{ ...eyebrow, color: C.cardinal, letterSpacing: 3, marginBottom: 6 }}>Your STARS report</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: HEAD, color: C.ink, marginBottom: 8 }}>Undergraduate reports only</div>
        <div style={{ fontSize: 14, color: C.body, lineHeight: 1.6 }}>
          This is a graduate STARS report. RegCheck only checks undergraduate requirements, so it can't check this schedule.
        </div>
        <div style={{ textAlign: "right", marginTop: 16 }}>
          <button onClick={onClose} style={primaryButton}>OK</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, ...eyebrow }}>
      {label}
      {children}
      {hint && <span style={{ fontSize: 11.5, fontWeight: 400, color: C.muted, textTransform: "none", letterSpacing: 0, fontFamily: BODY, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  );
}

function Notice({ tone, bg, children }) {
  return (
    <div style={{ padding: "11px 14px", background: bg, borderLeft: `4px solid ${tone}`, borderRadius: 8, fontSize: 13, color: C.ink, marginBottom: 12, lineHeight: 1.55 }}>
      {children}
    </div>
  );
}

const inputStyle = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 13.5, fontFamily: BODY, color: C.ink, background: "#fff", textTransform: "none", letterSpacing: 0, fontWeight: 400 };
const iconButton = { background: "#fff", border: `1px solid ${C.lineStrong}`, borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: C.body, fontSize: 13, lineHeight: 1, fontFamily: BODY };
