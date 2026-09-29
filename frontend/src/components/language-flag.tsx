import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Small inline-SVG flags for the language switchers (no external images). English uses the
 * Union Jack, Kinyarwanda the flag of Rwanda, French the flag of France. Decorative only — the
 * control around it carries the language name for assistive tech.
 */
export function LanguageFlag({ locale, className }: { locale: string; className?: string }) {
  const id = useId();
  const frame = cn("h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10", className);

  if (locale === "rw") {
    return (
      <svg aria-hidden viewBox="0 0 1080 720" preserveAspectRatio="xMidYMid slice" className={frame}>
        <rect width="1080" height="720" fill="#00A1DE" />
        <rect y="360" width="1080" height="180" fill="#FAD201" />
        <rect y="540" width="1080" height="180" fill="#20603D" />
        {/* The sun, simplified to its disc and ring at this size. */}
        <circle cx="840" cy="180" r="92" fill="#E5BE01" />
        <circle cx="840" cy="180" r="64" fill="#00A1DE" />
        <circle cx="840" cy="180" r="50" fill="#E5BE01" />
      </svg>
    );
  }

  if (locale === "fr") {
    return (
      <svg aria-hidden viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" className={frame}>
        <rect width="1" height="2" fill="#002395" />
        <rect x="1" width="1" height="2" fill="#FFFFFF" />
        <rect x="2" width="1" height="2" fill="#ED2939" />
      </svg>
    );
  }

  // English — Union Jack. Clip-path ids are per-instance (several switchers can be on a page).
  const outer = `${id}-flag`;
  const diagonals = `${id}-diag`;
  return (
    <svg aria-hidden viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className={frame}>
      <clipPath id={outer}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={diagonals}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${outer})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${diagonals})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
