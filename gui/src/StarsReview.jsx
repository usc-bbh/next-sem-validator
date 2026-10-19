import React, { useState } from "react";
import { passed as passRule } from "../stars-parser/fields.js";
import { C, HEAD, BODY, eyebrow, primaryButton, secondaryButton } from "./theme";

// ─────────────────────────────────────────────────────────────
// The review screen (STARS_PARSER_DESIGN.md §9).
//
// Sits between upload and validation. After a successful parse it shows what
// was read, flags anything doubtful, and lets the student correct it. After a
// failed parse it opens empty, with the reason, so a failure is never a dead
// end. Nothing here leaves the browser: edits live in component state and are
// handed to the app only when the student presses "Looks right".
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

export default function StarsReview({ initial, mode, failure, onConfirm, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [adding, setAdding] = useState({ code: "", grade: "", units: "4", list: "completed" });

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

  const addRow = () => {
    const code = tidyCode(adding.code);
    if (!code) return;
    const inProgress = adding.list === "inProgress";
    const row = {
      term: "",
      code,
      rawCode: code.replace(" ", ""),
      title: "",
      units: Number(adding.units) || 0,
      grade: inProgress ? "RG" : adding.grade.trim().toUpperCase(),
      suffixes: [],
      flags: inProgress ? [">IP"] : [],
      source: "usc",
      passed: null,
      origin: "student",
    };
    if (!inProgress) row.passed = passRule(row);
    setDraft((d) => {
      const list = inProgress ? "inProgressCourses" : "completedCourses";
      return { ...d, [list]: [...d[list], row] };
    });
    setAdding({ code: "", grade: "", units: "4", list: adding.list });
  };

  const canConfirm = CLASS_LEVELS.includes(draft.classLevel);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stars-review-title"
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,24,0.45)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: C.card, borderRadius: 16, width: "100%", maxWidth: 820, boxShadow: "0 30px 70px -20px rgba(28,28,31,0.45)", overflow: "hidden", fontFamily: BODY, color: C.ink }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ ...eyebrow, color: C.cardinal, letterSpacing: 3, marginBottom: 6 }}>Your STARS report</div>
          <div id="stars-review-title" style={{ fontSize: 22, fontWeight: 700, fontFamily: HEAD }}>
            {mode === "failed" ? "Enter your STARS details" : "Check what we read from your report"}
          </div>
          <div style={{ fontSize: 13, color: C.body, marginTop: 6 }}>
            This stays in your browser. Nothing you upload or type here is sent anywhere.
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Field label="Major">
              <input value={draft.major ?? ""} onChange={(e) => update({ major: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Class level">
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

          <CourseTable title="Completed courses" list="completedCourses" rows={draft.completedCourses} report={draft}
            onEdit={editRow} onRemove={removeRow} onMove={moveRow} moveLabel="Move to in progress" />
          <CourseTable title="In progress" list="inProgressCourses" rows={draft.inProgressCourses} report={draft} inProgress
            onEdit={editRow} onRemove={removeRow} onMove={moveRow} moveLabel="Move to completed" />

          <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 12, padding: 14, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Add a course">
              <input value={adding.code} placeholder="e.g. CSCI 104" onChange={(e) => setAdding({ ...adding, code: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addRow()} style={{ ...inputStyle, width: 130 }} />
            </Field>
            <Field label="List">
              <select value={adding.list} onChange={(e) => setAdding({ ...adding, list: e.target.value })} style={inputStyle}>
                <option value="completed">Completed</option>
                <option value="inProgress">In progress</option>
              </select>
            </Field>
            {adding.list === "completed" && (
              <Field label="Grade">
                <input value={adding.grade} placeholder="A-" onChange={(e) => setAdding({ ...adding, grade: e.target.value })} style={{ ...inputStyle, width: 64 }} />
              </Field>
            )}
            <Field label="Units">
              <input type="number" min="0" max="12" step="0.5" value={adding.units} onChange={(e) => setAdding({ ...adding, units: e.target.value })} style={{ ...inputStyle, width: 64 }} />
            </Field>
            <button onClick={addRow} disabled={!adding.code.trim()} className="outline-btn" style={secondaryButton}>Add</button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Courses you add or change are marked as yours. The checker won't treat them as proof of a prerequisite on their own;
            it'll warn you to double-check instead.
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", background: C.page }}>
          {!canConfirm && <span style={{ fontSize: 12.5, color: C.muted, marginRight: "auto" }}>Choose your class level to continue.</span>}
          <button onClick={onCancel} className="outline-btn" style={secondaryButton}>Cancel</button>
          <button onClick={() => onConfirm(draft)} disabled={!canConfirm}
            style={{ ...primaryButton, opacity: canConfirm ? 1 : 0.5, cursor: canConfirm ? "pointer" : "not-allowed" }}>
            Looks right
          </button>
        </div>
      </div>
    </div>
  );
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

function CourseTable({ title, list, rows, report, inProgress, onEdit, onRemove, onMove, moveLabel }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...eyebrow, marginBottom: 6 }}>
        {title} · {rows.length}
      </div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: C.faint, padding: "6px 0" }}>None.</div>}
      {rows.map((row, i) => {
        const flag = flagFor(row, report, inProgress);
        return (
          <div key={`${row.term}-${row.code}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
            <span className="mono" style={{ width: 44, color: C.faint, fontSize: 11.5 }}>{row.term}</span>
            <span style={{ width: 96, fontWeight: 600, fontFamily: HEAD }}>{row.code}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: C.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{row.title}</span>
              {flag && <span style={{ fontSize: 11, color: TONE[flag.tone], fontWeight: 600 }}>{flag.text}</span>}
            </span>
            {!inProgress && (
              <input aria-label={`Grade for ${row.code}`} value={row.grade} placeholder="grade"
                onChange={(e) => onEdit(list, i, { grade: e.target.value.trim() })}
                style={{ ...inputStyle, width: 52, padding: "4px 6px", fontSize: 12 }} />
            )}
            <span className="mono" style={{ width: 62, textAlign: "right", color: C.body, fontSize: 12, whiteSpace: "nowrap" }}>{row.units} {row.units === 1 ? "unit" : "units"}</span>
            <button onClick={() => onMove(list, i)} title={moveLabel} aria-label={`${moveLabel}: ${row.code}`} style={iconButton}>{inProgress ? "↑" : "↓"}</button>
            <button onClick={() => onRemove(list, i)} title="Remove" aria-label={`Remove ${row.code}`} style={{ ...iconButton, color: C.bad }}>×</button>
          </div>
        );
      })}
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
