import React from "react";
import { C, HEAD, eyebrow, card } from "./theme";

// The Feedback page (#/feedback), from "Something wrong? Report it" under the
// results. The site is static, so the form itself is a Google Form, embedded
// here; responses land in that form's Google Sheet.
export const FEEDBACK_FORM_URL = "";

// A form's share link ends in /viewform; embedding needs ?embedded=true on it.
export function embedUrl(link) {
  if (!link) return "";
  const url = new URL(link);
  url.searchParams.set("embedded", "true");
  return url.toString();
}

export default function Feedback({ onBack, formUrl = FEEDBACK_FORM_URL }) {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "28px 28px 0" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, color: C.muted, fontFamily: HEAD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        ← Back to RegCheck
      </button>

      <div style={{ ...eyebrow, color: C.cardinal, marginTop: 26 }}>Feedback</div>
      <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontFamily: HEAD, fontWeight: 700, color: C.ink, lineHeight: 1.1, margin: "8px 0 0" }}>
        Tell us what RegCheck got wrong
      </h1>
      <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, maxWidth: 640, margin: "12px 0 0" }}>
        A wrong result, a course or section that's missing, something confusing: it all helps us fix it. Name the
        course and section if it's about a result.
      </p>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 640, margin: "8px 0 0" }}>
        This form is a Google Form, so what you send goes to Google. Your STARS report never leaves your device, so
        don't paste anything from it you wouldn't want shared.
      </p>

      {formUrl ? (
        <>
          <div style={{ ...card, marginTop: 24, padding: 0, overflow: "hidden" }}>
            <iframe src={embedUrl(formUrl)} title="RegCheck feedback form" loading="lazy"
              style={{ display: "block", width: "100%", height: 900, border: 0 }}>
              Loading the feedback form…
            </iframe>
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, margin: "10px 0 0" }}>
            Form not loading?{" "}
            <a href={formUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.cardinal, fontWeight: 600 }}>Open it in a new tab ↗</a>
          </p>
        </>
      ) : (
        <div style={{ ...card, marginTop: 24, padding: "18px 20px", fontSize: 14, color: C.body }}>
          The feedback form isn't set up yet.
        </div>
      )}
    </main>
  );
}
