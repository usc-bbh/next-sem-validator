import React from "react";
import { C, HEAD } from "./theme";

// The logo and wordmark at the left of the nav. Clicking either goes to the
// RegCheck main page, staying in the app so an uploaded report isn't lost; a
// modified click (new tab or window) follows the real link instead.
export default function NavBrand({ onHome }) {
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onHome();
  };
  return (
    <a href={import.meta.env.BASE_URL} onClick={onClick} aria-label="RegCheck home"
      style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      {/* Same mark as public/favicon.svg; keep the two in step. */}
      <svg width={28} height={28} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block" }}>
        <defs>
          <linearGradient id="regcheck-mark-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A30000" />
            <stop offset="1" stopColor="#7A0000" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#regcheck-mark-grad)" />
        <path d="M13 22 L20.5 29.5 L35 15" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="35" width="22" height="3.5" rx="1.75" fill="#D4AF37" />
      </svg>
      <span className="nav-wordmark" style={{ fontSize: 15, fontWeight: 600, fontFamily: HEAD, color: C.cardinal, letterSpacing: 0.5 }}>RegCheck</span>
    </a>
  );
}
