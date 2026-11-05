import React from "react";
import { C, HEAD, eyebrow, card, primaryButton, secondaryButton } from "./theme";

// The Feedback page (#/feedback), from "Something wrong? Report it" under the
// results. Two ways to help: share a redacted STARS report through the STARS
// Redactor (BBH's Hugging Face app, which strips name, ID, address and grades
// and stores what a student chooses to submit), and the feedback form itself, a
// Google Form, since the site is static. The form asks for the redactor's
// report ID, so a comment can be matched to the report it's about.
//
// The form needs a Google sign-in, which can't happen inside an iframe (Google
// won't frame its sign-in page, and Safari blocks the frame's cookies), so it
// opens in a new tab. If the form is ever made open to anyone, set
// FEEDBACK_FORM_EMBED to true to show it on the page instead.
export const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpxZGDSFvv3VdKaWftf-rdTySfJeZqkjRDFmnzmE788DldDQ/viewform";
export const FEEDBACK_FORM_EMBED = false;
export const STARS_REDACTOR_URL = "https://huggingface.co/spaces/buai-builder-hub/STARSRedacter";

const REDACT_STEPS = [
  <>Open the STARS Redactor and upload the same PDF you used here.</>,
  <>It takes out your name, USC ID, address and grades, and shows you the result.</>,
  <>Submit the redacted copy there. You'll get a report ID: add it to the form below, and use it if you ever want the report deleted.</>,
];

// A form's share link ends in /viewform; embedding needs ?embedded=true on it.
export function embedUrl(link) {
  if (!link) return "";
  const url = new URL(link);
  url.searchParams.set("embedded", "true");
  return url.toString();
}

export default function Feedback({ onBack, formUrl = FEEDBACK_FORM_URL, embed = FEEDBACK_FORM_EMBED }) {
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

      <section aria-labelledby="share-title" style={{ ...card, marginTop: 24, padding: "20px 22px", borderTop: `3px solid ${C.cardinal}` }}>
        <div style={{ ...eyebrow, color: C.cardinal }}>The most useful thing you can send</div>
        <h2 id="share-title" style={{ fontSize: 20, fontFamily: HEAD, fontWeight: 700, color: C.ink, margin: "6px 0 0" }}>
          Share your redacted STARS report
        </h2>
        <p style={{ fontSize: 14, color: C.body, lineHeight: 1.65, margin: "8px 0 0", maxWidth: 640 }}>
          STARS reports differ a lot from major to major. Seeing yours, with your personal details removed, is how we
          find what RegCheck misreads and make it work for students like you.
        </p>
        <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
          {REDACT_STEPS.map((step, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "baseline", fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: C.cardinalTint, color: C.cardinal, fontFamily: HEAD, fontWeight: 700, fontSize: 11.5,
                display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "translateY(5px)" }}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <a href={STARS_REDACTOR_URL} target="_blank" rel="noopener noreferrer"
          style={{ ...primaryButton, display: "inline-block", marginTop: 18, textDecoration: "none" }}>
          Redact and share your report ↗
        </a>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "12px 0 0" }}>
          Sharing is up to you. RegCheck never sends your report anywhere; only what you submit in the Redactor is kept.
        </p>
      </section>

      <h2 style={{ fontSize: 20, fontFamily: HEAD, fontWeight: 700, color: C.ink, margin: "32px 0 0" }}>Send us feedback</h2>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 640, margin: "6px 0 0" }}>
        This form is a Google Form, so what you send goes to Google. Don't paste anything from your report you
        wouldn't want shared; share the redacted report instead.
      </p>

      {formUrl && !embed ? (
        <div style={{ ...card, marginTop: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: C.body, lineHeight: 1.6 }}>
            Takes a minute. You'll sign in with your Google account (your USC one works).
          </div>
          <a href={formUrl} target="_blank" rel="noopener noreferrer" className="outline-btn"
            style={{ ...secondaryButton, display: "inline-block", textDecoration: "none" }}>
            Open the feedback form ↗
          </a>
        </div>
      ) : formUrl ? (
        <>
          <div style={{ ...card, marginTop: 14, padding: 0, overflow: "hidden" }}>
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
        <div style={{ ...card, marginTop: 14, padding: "18px 20px", fontSize: 14, color: C.body }}>
          The feedback form isn't set up yet.
        </div>
      )}
    </main>
  );
}
