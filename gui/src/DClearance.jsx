import React, { useEffect, useMemo, useState } from "react";
import { C, HEAD, eyebrow, card, primaryButton } from "./theme";
import { VALIDATOR_ASSETS } from "./validatorAssets";
import { hashForPage } from "./route";
import { FEEDBACK_FORM_URL } from "./Feedback";
import { toPoints, splitLabel, sentences, listItems, linkify, shortUrl } from "./richText";

// The D-clearance page (#/d-clearance). Each D-clearance notice in the results
// shows a department's one-line `summary` and links here, to
// #/d-clearance/<dept_code>, which opens that department's full steps. Every
// entry comes from analytics/data/dept_clearance.json, the same file the
// validator reads.

export const anchorId = (code) => `dc-${code}`;

// The course prefixes an entry covers. The Dornsife fallback's covers_prefixes
// is a reference list of departments with their own entries, so it isn't shown.
export const prefixesOf = (dept) => [dept.dept_code, ...(dept.also_covers_prefixes ?? [])];

// The name without its trailing "(Dornsife)" or "(Marshall — BUCO, …)": the
// page already groups by school and shows the prefixes. The school-wide
// fallback ("Dornsife (all departments not separately listed)") would be left
// as just the school, so it reads "Other Dornsife departments".
export const displayName = (dept) => {
  const name = dept.dept_name.replace(/\s*\([^()]*\)\s*$/, "");
  return dept.type === "school_fallback" && name === dept.school ? `Other ${dept.school} departments` : name;
};

// A school's section starts closed, except the one holding the department a
// notice linked to, or any that a search matches.
export const startsOpen = (school, focusSchool, query) => Boolean(query.trim()) || school === focusSchool;

export const matchesQuery = (dept, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return prefixesOf(dept).some((p) => p.toLowerCase().startsWith(q)) || dept.dept_name.toLowerCase().includes(q);
};

// Schools in the order they first appear in the file, each with its departments.
export const bySchool = (departments) => {
  const groups = new Map();
  for (const d of departments) groups.set(d.school, [...(groups.get(d.school) ?? []), d]);
  return [...groups];
};

// The general process, above the departments. Each point is backed by
// dept_clearance.json or its DEPT_CLEARANCE_SOURCES.md, not assumed: a
// department's own steps (below) win where they differ.
export const HOW_IT_WORKS = [
  ["Find the sections that need it.",
    "Look for the D after the section number. When you validate your schedule, RegCheck flags the sections you picked that need it."],
  ["Request it from the department.",
    "Find the department below by its course prefix and follow its steps. Include the course, the five-digit section number and your USC ID. In some departments, majors get D-clearance at their advisement appointment instead."],
  ["Wait for approval.",
    "Most departments take a few business days. Once you're cleared, the section shows in WebReg under My Info > Cleared Sections."],
  ["Register in WebReg yourself.",
    "D-clearance only lets you register. It doesn't enroll you, so add the section in WebReg once you're cleared."],
];

export const GOOD_TO_KNOW = [
  "D-clearance doesn't hold a seat. If the section fills before you register, you can't get in. GE office clearances for GE seminars are the exception: they come with a seat.",
  "It isn't a prerequisite waiver. If you're missing a prerequisite, that's a separate request.",
  "Many departments clear their majors first and open requests to other students later, so ask early.",
];

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const css = `
  .dc-steps { counter-reset: dc-step; list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 12px; }
  .dc-steps li { counter-increment: dc-step; display: grid; grid-template-columns: 26px 1fr; gap: 10px; font-size: 14px; color: ${C.body}; line-height: 1.6; }
  .dc-steps li::before { content: counter(dc-step); width: 24px; height: 24px; border-radius: 50%; background: ${C.cardinal}; color: #fff;
    font-family: ${HEAD}; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; }
  .dc-notes { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13.5px; color: ${C.body}; line-height: 1.6; }
  .dc-dept { scroll-margin-top: 84px; }
  .dc-school > summary { cursor: pointer; list-style: none; }
  .dc-school > summary::-webkit-details-marker { display: none; }
  .dc-school > summary::before { content: "▸"; color: ${C.muted}; transition: transform .15s ease; }
  .dc-school[open] > summary::before { transform: rotate(90deg); }
  .dc-school > summary:hover { background: #FAFAF9; }
  .dc-dept details > summary { cursor: pointer; list-style: none; }
  .dc-dept details > summary::-webkit-details-marker { display: none; }
  .dc-dept details > summary::before { content: "▸"; display: inline-block; width: 14px; transition: transform .15s ease; }
  .dc-dept details[open] > summary::before { transform: rotate(90deg); }
  .dc-dept dl { display: grid; grid-template-columns: 130px 1fr; gap: 10px 16px; margin: 12px 0 0; }
  .dc-dept dt { font-family: ${HEAD}; font-weight: 600; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${C.faint}; padding-top: 2px; }
  .dc-dept dd { margin: 0; }
  .dc-dept dd ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
  .dc-dept dd ul ul { margin-top: 4px; gap: 3px; list-style: circle; }
  .dc-rich a { color: ${C.cardinal}; text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
  @media (max-width: 560px) { .dc-dept dl { grid-template-columns: 1fr; gap: 2px; } .dc-dept dd { margin-bottom: 10px; } }
`;

// Text with its emails, web addresses and phone numbers as links.
function Rich({ text }) {
  return linkify(text).map((t, i) => (t.href
    ? <a key={i} href={t.href} title={t.href.startsWith("http") ? t.href : undefined}
        {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {t.href.startsWith("http") ? shortUrl(t.text) : t.text}
      </a>
    : <React.Fragment key={i}>{t.text}</React.Fragment>));
}

// One point: its case in bold ("Declared CSCI majors:"), its first sentence,
// and any further sentences or a long list as sub-points.
function Point({ text, as: Tag = "li" }) {
  const [label, body] = splitLabel(text);
  const [lead, ...more] = sentences(body);
  const items = listItems(lead);
  const sub = [...(items ?? []), ...more];
  return (
    <Tag>
      {label && <b style={{ color: C.ink }}>{label} </b>}
      {!items && <Rich text={lead} />}
      {sub.length > 0 && <ul>{sub.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>}
    </Tag>
  );
}

// A field as a lead-in plus points; a one-point field without a lead-in stays a line.
function Points({ text }) {
  const { intro, points } = toPoints(text);
  if (!intro && points.length === 1) return <Point text={points[0]} as="div" />;
  return (
    <>
      {intro && <div style={{ marginBottom: 4 }}><Rich text={intro} /></div>}
      <ul>{points.map((p, i) => <Point key={i} text={p} />)}</ul>
    </>
  );
}

function Contact({ dept }) {
  const lines = [dept.contact_office, ...(dept.contact_email ?? "").split(/;\s*/), dept.contact_phone].filter((l) => l && l.trim());
  if (lines.length === 1) return <Rich text={lines[0]} />;
  return <ul>{lines.map((l, i) => <li key={i}><Rich text={l} /></li>)}</ul>;
}

function Department({ dept, focused }) {
  // Most useful first: how to get it and who to ask, then the background.
  const rows = [
    ["How to get it", dept.how_to_get_clearance && <Points text={dept.how_to_get_clearance} />],
    ["Contact", (dept.contact_office || dept.contact_email || dept.contact_phone) && <Contact dept={dept} />],
    ["Turnaround", dept.typical_turnaround && <Points text={dept.typical_turnaround} />],
    ["Which courses", dept.clearance_required_for && <Points text={dept.clearance_required_for} />],
    ["Priority", dept.priority_note && <Points text={dept.priority_note} />],
    ["Tips", dept.tips && <Points text={dept.tips} />],
  ].filter(([, v]) => v);
  return (
    <section id={anchorId(dept.dept_code)} className="dc-dept" aria-current={focused ? "true" : undefined}
      style={{ ...card, padding: "16px 18px", border: `1px solid ${focused ? C.cardinal : C.line}`, boxShadow: focused ? `0 0 0 3px ${C.cardinalTint}` : card.boxShadow }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontFamily: HEAD, fontWeight: 700, color: C.ink }}>{displayName(dept)}</h3>
        {!dept.verified && <span style={{ ...eyebrow, fontSize: 9.5, letterSpacing: 1, color: C.warn }}>Not confirmed</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {prefixesOf(dept).map((p) => (
          <span key={p} className="mono" style={{ fontSize: 11, color: C.body, background: "#FAFAF9", border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 6px" }}>{p}</span>
        ))}
      </div>
      <p className="dc-rich" style={{ margin: "10px 0 0", fontSize: 14, color: C.ink, lineHeight: 1.55 }}><Rich text={dept.summary} /></p>
      {(isUrl(dept.form_link) || isUrl(dept.source_url)) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13, fontFamily: HEAD, fontWeight: 600 }}>
          {isUrl(dept.form_link) && <a href={dept.form_link} target="_blank" rel="noopener noreferrer" style={{ color: C.cardinal, textDecoration: "none" }}>Where to request it ↗</a>}
          {isUrl(dept.source_url) && <a href={dept.source_url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none" }}>Department's page ↗</a>}
        </div>
      )}
      <details open={focused || undefined} style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
        <summary style={{ fontSize: 12.5, fontFamily: HEAD, fontWeight: 600, color: C.body }}>Full steps</summary>
        <dl className="dc-rich" style={{ fontSize: 13.5, color: C.body, lineHeight: 1.6 }}>
          {rows.map(([label, value]) => (
            <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>
          ))}
        </dl>
      </details>
    </section>
  );
}

// The page, given the parsed dept_clearance.json (null while it loads).
export function DClearanceView({ rules, error = false, focus = null, onBack }) {
  const [query, setQuery] = useState("");
  // Schools the student opened or closed themselves; the rest follow startsOpen.
  const [toggled, setToggled] = useState({});
  useEffect(() => { setQuery(""); setToggled({}); }, [focus]);
  useEffect(() => setToggled({}), [query]);
  useEffect(() => {
    if (rules && focus) document.getElementById(anchorId(focus))?.scrollIntoView({ block: "start" });
  }, [rules, focus]);
  const groups = useMemo(() => bySchool((rules?.departments ?? []).filter((d) => matchesQuery(d, query))), [rules, query]);
  const focusSchool = rules?.departments.find((d) => d.dept_code === focus)?.school ?? null;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 28px 0" }}>
      <style>{css}</style>
      <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, color: C.muted, fontFamily: HEAD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        ← Back to RegCheck
      </button>

      <div style={{ ...eyebrow, color: C.cardinal, marginTop: 26 }}>D-clearance</div>
      <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontFamily: HEAD, fontWeight: 700, color: C.ink, lineHeight: 1.1, margin: "8px 0 0" }}>
        How to get D-clearance
      </h1>
      <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, maxWidth: 680, margin: "12px 0 0" }}>
        D-clearance is permission from the department that offers a course. Sections that need it have a D after the
        five-digit section number in the Schedule of Classes and WebReg, and WebReg won't let you register for one until
        the department clears you. Each department runs its own process, so find yours below.
      </p>

      <section aria-labelledby="dc-how" style={{ ...card, marginTop: 24, padding: "20px 22px" }}>
        <h2 id="dc-how" style={{ margin: 0, fontSize: 17, fontFamily: HEAD, fontWeight: 700, color: C.ink }}>How it works</h2>
        <ol className="dc-steps">
          {HOW_IT_WORKS.map(([title, body]) => (
            <li key={title}><span><b style={{ color: C.ink }}>{title}</b> {body}</span></li>
          ))}
        </ol>
        <h3 style={{ ...eyebrow, margin: "18px 0 8px" }}>Good to know</h3>
        <ul className="dc-notes">
          {GOOD_TO_KNOW.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </section>

      {/* The steps are a snapshot of each department's page, and students see
          changes before we do, so the notice asks them to send one in. */}
      <div role="note" style={{ marginTop: 16, padding: "12px 16px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 10, fontSize: 13, color: C.body, lineHeight: 1.6 }}>
        <div style={{ color: C.warn, fontWeight: 700, marginBottom: 2 }}>These steps may not be up to date</div>
        The D-clearance process can change every semester. Each department's steps come from its advising page, so check the
        department's page before you apply. If you see a new requirement, <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer"
          style={{ color: C.cardinal, fontWeight: 600 }}>submit it through the feedback form ↗</a>.
        {rules?._last_updated && <> Last checked {longDate(rules._last_updated)}.</>}
      </div>

      {error ? (
        <div role="alert" style={{ ...card, marginTop: 24, padding: "16px 18px", fontSize: 14, color: C.body }}>
          The D-clearance steps didn't load. Check your connection and reload the page.
        </div>
      ) : !rules ? (
        <div role="status" style={{ marginTop: 24, fontSize: 14, color: C.muted }}>Loading departments…</div>
      ) : (
        <>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a department or course prefix, like CSCI" aria-label="Find a department"
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 24, padding: "11px 14px", fontSize: 14, border: `1px solid ${C.lineStrong}`, borderRadius: 10, background: C.card, color: C.ink }} />
          {groups.length === 0 && (
            <p style={{ marginTop: 18, fontSize: 14, color: C.body }}>
              No department matches "{query.trim()}". Ask the department that offers the course how to get D-clearance.
            </p>
          )}
          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {groups.map(([school, depts]) => {
              const open = toggled[school] ?? startsOpen(school, focusSchool, query);
              return (
                <details key={school} className="dc-school" open={open}
                  // Only a student's click is recorded; the browser also fires toggle when `open` is set from here.
                  onToggle={(e) => {
                    const now = e.currentTarget.open; // read here: React clears currentTarget before the updater runs
                    if (now !== open) setToggled((t) => ({ ...t, [school]: now }));
                  }}
                  style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <summary style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontFamily: HEAD, fontWeight: 700, color: C.ink }}>{school}</h2>
                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: C.muted }}>
                      {depts.length} {depts.length === 1 ? "department" : "departments"}
                    </span>
                  </summary>
                  <div style={{ display: "grid", gap: 10, padding: 14, background: C.page, borderTop: `1px solid ${C.line}` }}>
                    {depts.map((d) => <Department key={d.dept_code} dept={d} focused={d.dept_code === focus} />)}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <button onClick={onBack} style={primaryButton}>Back to RegCheck</button>
      </div>
    </main>
  );
}

// The link under a D-clearance notice in the results: to the department's full
// steps, or to the whole page when no department entry covers the course. A
// modified click (new tab or window) follows the real link.
export function ClearanceLink({ course, dept, onOpen }) {
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(course, dept);
  };
  return (
    <a href={hashForPage("d-clearance", dept)} onClick={onClick}
      style={{ display: "inline-block", paddingLeft: 27, marginTop: 6, fontSize: 12.5, fontFamily: HEAD, fontWeight: 600, color: C.cardinal, textDecoration: "none" }}>
      {dept ? "See the full steps →" : "See every department's steps →"}
    </a>
  );
}

// Loads the same dept_clearance.json the checker fetches.
export default function DClearance(props) {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(VALIDATOR_ASSETS.deptClearance.url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => live && setRules(json))
      .catch(() => live && setError(true));
    return () => { live = false; };
  }, []);
  return <DClearanceView {...props} rules={rules} error={error} />;
}
