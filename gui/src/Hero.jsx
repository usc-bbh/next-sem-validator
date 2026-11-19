import { C, HEAD } from "./theme";

// The home page's opening. It used to list what RegCheck checks without saying
// what goes wrong without it. The wording follows RegCheck's card on the BUAI
// Builder Hub site, minus "a full section": RegCheck doesn't check seats (About
// says so), so it can't promise to catch one.
export const SUMMARY = "Validate your next-semester schedule before you register.";
export const PROBLEM = "You don't find out your schedule is broken until WebReg rejects it mid-registration, whether it's a time conflict, a missing prerequisite or D-clearance, or a lab you forgot to add. By then your spot is gone.";
export const SOLUTION = "Upload your STARS report and the sections you're planning to take. RegCheck catches what would make registration fail, before you try.";

export default function Hero() {
  return (
    <>
      <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", fontFamily: HEAD, fontWeight: 700, color: C.ink, lineHeight: 1.05, margin: 0 }}>
        Reg<span style={{ color: C.cardinal }}>Check</span>
      </h1>
      <p style={{ fontSize: "clamp(18px, 2.4vw, 22px)", fontFamily: HEAD, fontWeight: 600, color: C.ink, lineHeight: 1.3, maxWidth: 680, margin: "12px 0 0" }}>
        {SUMMARY}
      </p>
      <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, maxWidth: 680, margin: "8px 0 0" }}>{PROBLEM}</p>
      <p style={{ fontSize: 15, color: C.ink, fontWeight: 500, lineHeight: 1.7, maxWidth: 680, margin: "6px 0 0" }}>{SOLUTION}</p>
    </>
  );
}
