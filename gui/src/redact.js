// Page side of in-browser redaction (public/redact-worker.js). The report is
// read and redacted on the student's device; nothing here sends it anywhere.

// Same limits as the hosted Redactor (STARSRedacter app.py).
export const MAX_UPLOAD_MB = 10;
const PDF_MAGIC = "%PDF-";
const PDF_HEADER_SCAN_BYTES = 1024;

// Why a file shouldn't be redacted, or null if it's fine to try.
export function uploadProblem(name, bytes) {
  if (!/\.pdf$/i.test(name ?? "")) return "That's not a PDF. On experience.usc.edu, open your STARS report, hit Print, and choose Save as PDF.";
  if (bytes.byteLength > MAX_UPLOAD_MB * 1024 * 1024) return `That file is over ${MAX_UPLOAD_MB} MB. A STARS report is normally well under 1 MB, so check you picked the right file.`;
  const head = new TextDecoder("latin1").decode(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, PDF_HEADER_SCAN_BYTES)));
  if (!head.includes(PDF_MAGIC)) return "This file is named .pdf but isn't one inside. Use Print → Save as PDF on experience.usc.edu.";
  return null;
}

// What to tell the student about a finished run. `ok` means there's a file to download.
export function describeResult(res) {
  switch (res?.code) {
    case "OK":
      return res.status === "REVIEW"
        ? { ok: true, tone: "warn", text: "Done. Part of your name may still appear somewhere in the report, so open it and check before you share it." }
        : { ok: true, tone: "ok", text: "Done. Your name, USC ID, address and grades are out. Open it to check before you share it." };
    case "NO_TEXT":
      return { ok: false, text: "This looks like a scan or photo, so it can't be redacted. Use Print → Save as PDF on experience.usc.edu and try again." };
    case "NOT_STARS":
      return { ok: false, text: "This doesn't look like a STARS Degree Progress Report. Check you picked the PDF from experience.usc.edu → My Academics → STARS." };
    case "TOO_MANY_PAGES":
      return { ok: false, text: `That PDF is ${res.pages ?? "too many"} pages; a STARS report is only a few. Check you picked your STARS report.` };
    case "TIMEOUT":
      return { ok: false, text: "That took too long, so we stopped. Try re-saving the report with Print → Save as PDF and redacting it again." };
    case "UNREADABLE":
      return { ok: false, text: "We couldn't read that file. Try re-saving it with Print → Save as PDF on experience.usc.edu." };
    default:
      return { ok: false, text: "Something didn't check out, so we didn't make a file. Better safe than sorry: don't share the original." };
  }
}

// The redacted file's name, the same convention as the Redactor's.
export const redactedName = (name) => `REDACTED_${(name || "STARS-report.pdf").replace(/^REDACTED[A-Z-]*_/i, "")}`;

let worker = null;
let nextId = 0;

// Resolves to { res, out: ArrayBuffer | null }. onStatus gets loading messages.
export function redactReport(bytes, onStatus = () => {}) {
  worker ??= new Worker(`${import.meta.env.BASE_URL}redact-worker.js`);
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const onMessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.type === "status") return onStatus(data.msg);
      worker.removeEventListener("message", onMessage);
      if (data.type === "done") resolve({ res: data.res, out: data.out });
      else reject(new Error(data.msg));
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, bytes }, [bytes]);
  });
}
