import React from "react";
import { C, HEAD, BODY, eyebrow, card, primaryButton } from "./theme";

// The About popup: shown on a first visit, and from the nav.
// What RegCheck checks, what it doesn't, and where to go for help. Every link
// here must be a page someone has opened and checked (About.test.js).
export default function About({ onClose }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,24,0.45)", zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "48px 16px", overflowY: "auto" }}>
      <div style={{ ...card, width: "100%", maxWidth: 580, padding: "22px 24px", position: "relative", boxShadow: "0 30px 70px -20px rgba(28,28,31,0.45)" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 22, lineHeight: 1, width: 32, height: 32 }}>×</button>
        <div id="about-title" style={{ fontSize: 22, fontWeight: 700, fontFamily: HEAD, color: C.ink, marginBottom: 14 }}>
          Welcome to Reg<span style={{ color: C.cardinal }}>Check</span>
        </div>
        <div style={{ ...eyebrow, color: C.cardinal, marginBottom: 12 }}>What RegCheck does</div>
        <ul style={{ fontSize: 13, color: C.body, lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
          <li>Checks <b>time conflicts</b> between your picked sections</li>
          <li>Flags sections that are <b>full</b> (no open seats)</li>
          <li>Warns about <b>D-clearance</b> requirements</li>
          <li>Checks <b>prerequisite</b> completion against your STARS report</li>
          <li>Checks <b>GPA minimums</b> when your GPA is on your report or you enter it</li>
          <li>Warns if your unit count is unusually <b>low (&lt;12)</b> or <b>high (&gt;18)</b></li>
        </ul>
        <div style={{ ...eyebrow, color: C.cardinal, marginBottom: 8, marginTop: 16 }}>What RegCheck does NOT do</div>
        <ul style={{ fontSize: 13, color: C.body, lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
          <li>Does <b>not</b> replace your academic advisor — always confirm with them</li>
          <li>Does <b>not</b> check graduation requirements or degree progress</li>
          <li>Does <b>not</b> guarantee seat availability at registration time</li>
          <li>Does <b>not</b> handle holds, registration appointments, or WebReg issues</li>
          <li>Does <b>not</b> verify co-requisite requirements for all courses</li>
          <li>Does <b>not</b> check minimum grades in prerequisites (like "C or better"): any passing grade counts</li>
          <li>Does <b>not</b> read a second STARS report: double majors get one per major, and only the one you upload is checked</li>
        </ul>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEFAEC", border: `1px solid ${C.goldLine}`, borderRadius: 8 }}>
          <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.6 }}>
            <b>Need D-clearance?</b> Reach out to your department.
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          For advising, reach out to your academic advisor.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} autoFocus style={primaryButton}>Got it</button>
        </div>
      </div>
    </div>
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
