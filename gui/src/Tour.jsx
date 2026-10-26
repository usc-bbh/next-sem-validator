import React, { useEffect, useLayoutEffect, useState } from "react";
import { C, HEAD, BODY, eyebrow, primaryButton, secondaryButton } from "./theme";

// ─────────────────────────────────────────────────────────────
// First-visit guided tour. Each step spotlights an element marked
// data-tour="<target>" and explains it in a card beside it. The page
// underneath can't be clicked while the tour is open. Escape skips it.
// ─────────────────────────────────────────────────────────────

const TOUR_STEPS = [
  {
    target: "stars",
    title: "Start with your STARS report",
    body: "Print your STARS report to PDF from experience.usc.edu and upload it here. It's read in your browser and never uploaded. No report yet? The demo data works for a trial run.",
  },
  {
    target: "search",
    title: "Add next semester's courses",
    body: "Search by course code, a word from the description, or an instructor's name.",
  },
  {
    target: "courses",
    title: "Pick your sections",
    body: "Each course lists its lectures, labs and discussions. Pick one of each type you need. Open seats show in green, full sections in red.",
  },
  {
    target: "week",
    title: "See your week",
    body: "Picked sections land on this calendar. Your unit count sits above it, with a warning if it's under 12.",
  },
  {
    target: "validate",
    title: "Validate before you register",
    body: "Checks time conflicts, full sections, D-clearance, prerequisites and GPA minimums against your report. It doesn't replace your advisor.",
  },
];

const PAD = 8;
const CARD_W = 320;

export default function Tour({ onClose }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const { target, title, body } = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The card goes below the target if it fits, otherwise above, otherwise
  // pinned to the bottom of the screen (a tall target on a phone).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 32);
  let cardPos = { left: (vw - width) / 2, bottom: 16 };
  if (rect) {
    const left = Math.min(Math.max(16, rect.left), vw - width - 16);
    if (rect.bottom + PAD + 200 < vh) cardPos = { left, top: rect.bottom + PAD + 10 };
    else if (rect.top - PAD - 200 > 0) cardPos = { left, bottom: vh - rect.top + PAD + 10 };
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      {rect ? (
        <div style={{ position: "fixed", top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 14, boxShadow: "0 0 0 9999px rgba(20,20,24,0.55)", outline: `2px solid ${C.cardinal}`, pointerEvents: "none",
          transition: "top .25s ease, left .25s ease, width .25s ease, height .25s ease" }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,20,24,0.55)" }} />
      )}
      <div style={{ position: "fixed", ...cardPos, width, background: C.card, borderRadius: 14, padding: "16px 18px", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.5)", fontFamily: BODY, color: C.ink }}>
        <div style={{ ...eyebrow, color: C.cardinal, marginBottom: 6 }}>Step {step + 1} of {TOUR_STEPS.length}</div>
        <div id="tour-title" style={{ fontSize: 17, fontWeight: 700, fontFamily: HEAD, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>{body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12.5, fontFamily: HEAD, fontWeight: 600, padding: 0, marginRight: "auto" }}>
            Skip tour
          </button>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="outline-btn" style={{ ...secondaryButton, padding: "7px 12px" }}>Back</button>
          )}
          <button autoFocus onClick={() => (last ? onClose() : setStep(step + 1))} style={{ ...primaryButton, padding: "8px 16px" }}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
