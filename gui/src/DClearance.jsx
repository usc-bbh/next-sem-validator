import React, { useEffect, useMemo, useState } from "react";
import { C, HEAD, eyebrow, card, primaryButton } from "./theme";
import { VALIDATOR_ASSETS } from "./validatorAssets";
import { hashForPage } from "./route";

// The D-clearance page (#/d-clearance). Each D-clearance notice in the results
// shows a department's one-line `summary` and links here, to
// #/d-clearance/<dept_code>, which opens that department's full steps. Every
// entry comes from analytics/data/dept_clearance.json, the same file the
// validator reads.

export const anchorId = (code) => `dc-${code}`;

// The course prefixes an entry covers. The Dornsife fallback's covers_prefixes
// is a reference list of departments with their own entries, so it isn't shown.
export const prefixesOf = (dept) => [dept.dept_code, ...(dept.also_covers_prefixes ?? [])];

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

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const css = `
  .dc-dept { scroll-margin-top: 84px; }
  .dc-dept details > summary { cursor: pointer; list-style: none; }
  .dc-dept details > summary::-webkit-details-marker { display: none; }
  .dc-dept details > summary::before { content: "▸"; display: inline-block; width: 14px; transition: transform .15s ease; }
  .dc-dept details[open] > summary::before { transform: rotate(90deg); }
  .dc-dept dl { display: grid; grid-template-columns: 130px 1fr; gap: 10px 16px; margin: 12px 0 0; }
  .dc-dept dt { font-family: ${HEAD}; font-weight: 600; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${C.faint}; padding-top: 2px; }
  .dc-dept dd { margin: 0; }
  @media (max-width: 560px) { .dc-dept dl { grid-template-columns: 1fr; gap: 2px; } .dc-dept dd { margin-bottom: 10px; } }
`;

function Department({ dept, focused }) {
  const contact = [dept.contact_office, dept.contact_email, dept.contact_phone].filter(Boolean).join(" · ");
  const rows = [
    ["How to get it", dept.how_to_get_clearance],
    ["Which courses", dept.clearance_required_for],
    ["Priority", dept.priority_note],
    ["Turnaround", dept.typical_turnaround],
    ["Contact", contact],
    ["Tips", dept.tips],
  ].filter(([, v]) => v);
  return (
    <section id={anchorId(dept.dept_code)} className="dc-dept" aria-current={focused ? "true" : undefined}
      style={{ ...card, padding: "16px 18px", border: `1px solid ${focused ? C.cardinal : C.line}`, boxShadow: focused ? `0 0 0 3px ${C.cardinalTint}` : card.boxShadow }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontFamily: HEAD, fontWeight: 700, color: C.ink }}>{dept.dept_name}</h3>
        {!dept.verified && <span style={{ ...eyebrow, fontSize: 9.5, letterSpacing: 1, color: C.warn }}>Not confirmed</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {prefixesOf(dept).map((p) => (
          <span key={p} className="mono" style={{ fontSize: 11, color: C.body, background: "#FAFAF9", border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 6px" }}>{p}</span>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 14, color: C.ink, lineHeight: 1.55 }}>{dept.summary}</p>
      {(isUrl(dept.form_link) || isUrl(dept.source_url)) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13, fontFamily: HEAD, fontWeight: 600 }}>
          {isUrl(dept.form_link) && <a href={dept.form_link} target="_blank" rel="noopener noreferrer" style={{ color: C.cardinal, textDecoration: "none" }}>Where to request it ↗</a>}
          {isUrl(dept.source_url) && <a href={dept.source_url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: "none" }}>Department's page ↗</a>}
        </div>
      )}
      <details open={focused || undefined} style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
        <summary style={{ fontSize: 12.5, fontFamily: HEAD, fontWeight: 600, color: C.body }}>Full steps</summary>
        <dl style={{ fontSize: 13.5, color: C.body, lineHeight: 1.6 }}>
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
  useEffect(() => setQuery(""), [focus]);
  useEffect(() => {
    if (rules && focus) document.getElementById(anchorId(focus))?.scrollIntoView({ block: "start" });
  }, [rules, focus]);
  const groups = useMemo(() => bySchool((rules?.departments ?? []).filter((d) => matchesQuery(d, query))), [rules, query]);

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
        Some sections need permission from the department before WebReg lets you register. They have a D after the
        section number. Each department runs its own process, so find yours below.
      </p>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 680, margin: "8px 0 0" }}>
        These steps come from each department's advising page and change every semester, so check the department's page
        before you apply.{rules?._last_updated && <> Last checked {longDate(rules._last_updated)}.</>}
      </p>

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
          {groups.map(([school, depts]) => (
            <div key={school} style={{ marginTop: 28 }}>
              <h2 style={{ ...eyebrow, fontSize: 11, margin: "0 0 10px" }}>{school}</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {depts.map((d) => <Department key={d.dept_code} dept={d} focused={d.dept_code === focus} />)}
              </div>
            </div>
          ))}
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
