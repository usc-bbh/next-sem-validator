import React, { useEffect, useRef, useState } from "react";
import { C, HEAD, eyebrow, card, primaryButton, secondaryButton } from "./theme";
import { uploadProblem, describeResult, redactReport, redactedName } from "./redact";

// The Feedback page (#/feedback), from the nav and "Something wrong? Report it"
// under the results. Two steps: redact your STARS report, right here in the
// browser with STARSRedacter's engine (src/redact.js), then report the issue in
// the Google Form, which opens in a popup on the page and takes the redacted PDF
// as an attachment. A file-upload question makes Google require sign-in, and
// sign-in can't happen inside a frame: a browser that already carries the
// student's Google sign-in into the frame shows the form, others show Google's
// sign-in screen, so the popup says to open the form in a new tab if that happens.
export const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpxZGDSFvv3VdKaWftf-rdTySfJeZqkjRDFmnzmE788DldDQ/viewform";

// A form's share link ends in /viewform; embedding needs ?embedded=true on it.
export function embedUrl(link) {
  if (!link) return "";
  const url = new URL(link);
  url.searchParams.set("embedded", "true");
  return url.toString();
}

const stepHead = (n, title) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: C.cardinal, color: "#fff", fontFamily: HEAD, fontWeight: 700, fontSize: 12,
      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
    <h2 style={{ fontSize: 19, fontFamily: HEAD, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h2>
  </div>
);

const TONE = {
  ok: { color: C.ok, bg: "rgba(22,163,74,0.07)", border: "rgba(22,163,74,0.3)" },
  warn: { color: C.warn, bg: "#FEFAEC", border: C.goldLine },
  bad: { color: C.bad, bg: "#FDF2F2", border: "rgba(193,18,31,0.25)" },
};

// Step 1. `reportPdfUrl` is the report already uploaded to RegCheck, if any, so
// it can be redacted without picking the file again.
export function RedactStep({ reportPdfUrl }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ phase: "idle" }); // idle | working | done | error
  const [download, setDownload] = useState(null); // { url, name }
  useEffect(() => () => download && URL.revokeObjectURL(download.url), [download]);

  const run = async (name, bytes) => {
    const problem = uploadProblem(name, bytes);
    if (problem) return setState({ phase: "error", text: problem });
    setDownload(null);
    setState({ phase: "working", text: "Starting…" });
    try {
      const { res, out } = await redactReport(bytes, (text) => setState({ phase: "working", text }));
      const verdict = describeResult(res);
      if (verdict.ok && out) {
        setDownload({ url: URL.createObjectURL(new Blob([out], { type: "application/pdf" })), name: redactedName(name) });
      }
      setState({ phase: verdict.ok ? "done" : "error", tone: verdict.tone, text: verdict.text });
    } catch {
      setState({ phase: "error", text: "The redactor couldn't start. Check your connection and try again." });
    }
  };

  const fromUpload = async () => run("STARS-report.pdf", await (await fetch(reportPdfUrl)).arrayBuffer());
  const fromFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run(file.name, await file.arrayBuffer());
  };

  const working = state.phase === "working";
  const tone = TONE[state.phase === "error" ? "bad" : state.tone ?? "ok"];
  return (
    <section aria-labelledby="redact-title" style={{ ...card, marginTop: 24, padding: "20px 22px", borderTop: `3px solid ${C.cardinal}` }}>
      <div style={{ ...eyebrow, color: C.cardinal, marginBottom: 8 }}>Having an issue with a result?</div>
      <div id="redact-title">{stepHead(1, "Redact your STARS report")}</div>
      <p style={{ fontSize: 14, color: C.body, lineHeight: 1.65, margin: "10px 0 0", maxWidth: 640 }}>
        To look into a wrong result we need to see the report behind it. Redact it here first: this takes out your
        name, USC ID, address and grades, right in your browser, and nothing is uploaded. Then attach the redacted
        copy in step 2.
      </p>

      <input ref={fileRef} type="file" accept="application/pdf" onChange={fromFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        {reportPdfUrl && (
          <button onClick={fromUpload} disabled={working} style={{ ...primaryButton, opacity: working ? 0.6 : 1 }}>Redact the report you uploaded</button>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={working}
          className={reportPdfUrl ? "outline-btn" : undefined}
          style={{ ...(reportPdfUrl ? secondaryButton : primaryButton), opacity: working ? 0.6 : 1 }}>
          {reportPdfUrl ? "Choose a different PDF" : "Choose your STARS PDF"}
        </button>
      </div>

      {state.phase !== "idle" && (
        <div role="status" style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.55,
          background: working ? "#FAFAF9" : tone.bg, border: `1px solid ${working ? C.line : tone.border}`, color: working ? C.body : C.ink }}>
          {working ? <span>{state.text}</span> : <>{state.phase === "error" && <b style={{ color: tone.color }}>Not redacted. </b>}{state.text}</>}
          {download && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <a href={download.url} download={download.name} style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>Download redacted report</a>
              <a href={download.url} target="_blank" rel="noopener noreferrer" className="outline-btn" style={{ ...secondaryButton, display: "inline-block", textDecoration: "none" }}>Open to check</a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// The Google Form, in a popup over the page.
export function FormPopup({ formUrl, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="form-title" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,20,24,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div style={{ ...card, width: "100%", maxWidth: 720, height: "min(88vh, 960px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 70px -20px rgba(28,28,31,0.45)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div id="form-title" style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 16, color: C.ink, flex: 1 }}>Report an issue</div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 22, lineHeight: 1, width: 32, height: 32 }}>×</button>
        </div>
        <div style={{ padding: "9px 18px", background: "#FAFAF9", borderBottom: `1px solid ${C.line}`, fontSize: 12.5, color: C.body, lineHeight: 1.5 }}>
          Asked to sign in? Google doesn't allow signing in here.{" "}
          <a href={formUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.cardinal, fontWeight: 600 }}>Open the form in a new tab ↗</a>
        </div>
        <iframe src={embedUrl(formUrl)} title="RegCheck feedback form" style={{ flex: 1, width: "100%", border: 0 }}>Loading the feedback form…</iframe>
      </div>
    </div>
  );
}

export default function Feedback({ onBack, reportPdfUrl = null, formUrl = FEEDBACK_FORM_URL }) {
  const [showForm, setShowForm] = useState(false);
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
        A wrong result, a course or section that's missing, something confusing: it all helps us fix it.
      </p>

      <RedactStep reportPdfUrl={reportPdfUrl} />

      <section aria-labelledby="report-title" style={{ ...card, marginTop: 16, padding: "20px 22px" }}>
        <div id="report-title">{stepHead(2, "Report the issue")}</div>
        <p style={{ fontSize: 14, color: C.body, lineHeight: 1.65, margin: "10px 0 0", maxWidth: 640 }}>
          Tell us what went wrong. If it's about a result, name the course and section, say what you expected
          instead, and attach your redacted report from step 1.
        </p>
        <button onClick={() => setShowForm(true)} style={{ ...primaryButton, marginTop: 16 }}>Report an issue</button>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "12px 0 0" }}>
          The form is a Google Form, so what you send goes to Google, and it asks you to sign in with Google (your
          USC account works). Attach only the redacted copy, never the original.
        </p>
      </section>

      {showForm && <FormPopup formUrl={formUrl} onClose={() => setShowForm(false)} />}
    </main>
  );
}
