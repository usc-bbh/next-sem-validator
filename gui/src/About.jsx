import React from "react";
import { C, HEAD, BODY, eyebrow, card, primaryButton, secondaryButton } from "./theme";

// The About page (#/about), from the nav and the results disclaimer. What
// RegCheck checks set against what it doesn't, topic by topic, and where to go
// for help. Every link here must be a page someone has opened and checked
// (About.test.js).

// One row per topic: `yes` is what the validator checks, `no` is what a pass
// doesn't cover. Keep `yes` in step with validate_next_semester.py's checks.
export const COMPARISON = [
  {
    topic: "Prerequisites",
    yes: [
      <>Prerequisites, counting courses you've finished <b>and</b> ones you're taking now</>,
      <>GPA minimums, when your GPA is on your report or you add it</>,
    ],
    no: [
      <>Minimum grades in prerequisites (like "C or better"): any passing grade counts</>,
      <>Co-requisites, for every course</>,
    ],
  },
  {
    topic: "Your schedule",
    yes: [
      <>Time conflicts between your picked sections</>,
      <>Missing labs or discussions a course needs</>,
      <>Courses that aren't offered next semester</>,
      <>Unit totals under 12 or over 18</>,
    ],
    no: [
      <>Graduation requirements or degree progress</>,
    ],
  },
  {
    topic: "Seats",
    yes: [
      <>Sections that are full right now</>,
    ],
    no: [
      <>Whether a seat will still be open when your registration window opens</>,
    ],
  },
  {
    topic: "Permissions",
    yes: [
      <>D-clearance sections, with how that department gives clearance</>,
      <>Sections reserved for certain majors or programs</>,
    ],
    no: [
      <>Holds, registration appointments, or WebReg issues</>,
    ],
  },
  {
    topic: "Your record",
    yes: [
      <>Courses you've already taken (repeatable ones only warn)</>,
      <>Whether your class standing fits 400-level courses</>,
    ],
    no: [
      <>A second STARS report: double majors get one per major, and only the one you upload is checked</>,
    ],
  },
];

const css = `
  .about-compare { width: 100%; border-collapse: separate; border-spacing: 0; }
  .about-compare th, .about-compare td { text-align: left; vertical-align: top; padding: 16px 20px; border-top: 1px solid ${C.line}; }
  .about-compare thead th { border-top: none; padding-top: 14px; padding-bottom: 14px; }
  .about-compare .topic { width: 170px; }
  .about-compare ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .about-compare li { display: grid; grid-template-columns: 18px 1fr; gap: 8px; align-items: baseline; }
  .about-compare .col-label { display: none; }
  @media (max-width: 720px) {
    .about-compare thead { display: none; }
    .about-compare, .about-compare tbody, .about-compare tr, .about-compare th, .about-compare td { display: block; width: auto; }
    .about-compare tr { border-top: 1px solid ${C.line}; padding: 6px 0 10px; }
    .about-compare tr:first-child { border-top: none; }
    .about-compare th, .about-compare td { border-top: none; padding: 8px 18px; }
    .about-compare .col-label { display: block; margin-bottom: 6px; }
  }
`;

function Mark({ yes }) {
  return (
    <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 10.5, fontWeight: 700, fontFamily: HEAD, transform: "translateY(3px)",
      background: yes ? "rgba(22,163,74,0.12)" : "rgba(0,0,0,0.06)", color: yes ? C.ok : C.faint }}>
      {yes ? "✓" : "✕"}
    </span>
  );
}

function Items({ items, yes }) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}><Mark yes={yes} /><span>{item}</span></li>
      ))}
    </ul>
  );
}

const colHead = (yes) => ({ ...eyebrow, color: yes ? C.ok : C.faint, letterSpacing: 1.5 });

export default function About({ onBack, onTour }) {
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 28px 0" }}>
      <style>{css}</style>
      <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, color: C.muted, fontFamily: HEAD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        ← Back to RegCheck
      </button>

      <div style={{ ...eyebrow, color: C.cardinal, marginTop: 26 }}>About RegCheck</div>
      <h1 id="about-title" style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontFamily: HEAD, fontWeight: 700, color: C.ink, lineHeight: 1.1, margin: "8px 0 0", maxWidth: 720 }}>
        What RegCheck checks, and what it doesn't
      </h1>
      <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, maxWidth: 680, margin: "12px 0 0" }}>
        RegCheck reads your STARS report and next semester's course catalog, then checks the sections you pick for the
        things that stop a registration. It's a best guess, not an official check, so confirm with your advisor and on
        WebReg before you register.
      </p>

      <div style={{ ...card, marginTop: 28, overflow: "hidden", padding: 0 }}>
        <table className="about-compare" aria-labelledby="about-title">
          <thead>
            <tr style={{ background: "#FAFAF9" }}>
              <th className="topic" scope="col"><span style={colHead(false)}>Topic</span></th>
              <th scope="col" style={{ background: "rgba(22,163,74,0.05)" }}><span style={colHead(true)}>✓ RegCheck checks</span></th>
              <th scope="col"><span style={colHead(false)}>✕ RegCheck doesn't check</span></th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.topic}>
                <th className="topic" scope="row" style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 14.5, color: C.ink }}>{row.topic}</th>
                <td data-col="yes" style={{ background: "rgba(22,163,74,0.05)", fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
                  <div className="col-label" style={colHead(true)}>Checks</div>
                  <Items items={row.yes} yes />
                </td>
                <td data-col="no" style={{ fontSize: 13.5, color: C.body, lineHeight: 1.55 }}>
                  <div className="col-label" style={colHead(false)}>Doesn't check</div>
                  <Items items={row.no} yes={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 18 }}>
        <div style={{ padding: "16px 18px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 12, fontSize: 13.5, color: C.body, lineHeight: 1.6 }}>
          <b>Need D-clearance?</b> Reach out to your department.
        </div>
        <div style={{ ...card, padding: "16px 18px", fontSize: 13.5, color: C.body, lineHeight: 1.6 }}>
          For advising, reach out to your academic advisor.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
        <button onClick={onBack} style={primaryButton}>Back to RegCheck</button>
        <button onClick={onTour} className="outline-btn" style={secondaryButton}>Take the tour</button>
      </div>
    </main>
  );
}

// Sits under the overall result: the results are a best guess, not an
// official check, with a way into About's list of what isn't checked.
export function ResultsDisclaimer({ onShowLimits }) {
  return (
    <div role="note" style={{ marginBottom: 14, padding: "10px 14px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 8, fontSize: 12.5, color: C.body, lineHeight: 1.55 }}>
      <b>Not an official check.</b> These results are a best guess from your STARS report and the course catalog. Confirm with your advisor and on WebReg before you register.{" "}
      <button onClick={onShowLimits} style={{ background: "none", border: "none", padding: 0, color: C.cardinal, fontWeight: 600, fontSize: 12.5, fontFamily: BODY, cursor: "pointer", textDecoration: "underline" }}>
        What RegCheck doesn't check
      </button>
    </div>
  );
}
