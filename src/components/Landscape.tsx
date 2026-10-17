// Calm illustrated landscape (rolling hills, a winding path, sunrise) drawn in the brand colors.
// Used where a photo would go until the owner uploads real photography in Admin > Settings.
export function Landscape({ className = "", variant = "sunrise" }: { className?: string; variant?: "sunrise" | "lake" | "path" }) {
  const sky = variant === "lake" ? ["#E9F1F4", "#F7EBDD"] : ["#F9E6CF", "#F7F3EB"];
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" className={className} role="presentation" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
        <radialGradient id={`glow-${variant}`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFF4DC" /><stop offset="0.45" stopColor="#F9D9A6" stopOpacity="0.7" /><stop offset="1" stopColor="#F9D9A6" stopOpacity="0" /></radialGradient>
        <linearGradient id={`path-${variant}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EAD9C6" /><stop offset="1" stopColor="#F4E9DC" /></linearGradient>
      </defs>
      <rect width="1200" height="600" fill={`url(#sky-${variant})`} />
      <circle cx={variant === "path" ? 340 : 820} cy="250" r="260" fill={`url(#glow-${variant})`} />
      <circle cx={variant === "path" ? 340 : 820} cy="250" r="58" fill="#FCE8C2" />
      <path d="M0 330 C 160 270, 300 300, 430 280 S 700 230, 860 270 S 1090 250, 1200 280 L1200 600 L0 600Z" fill="#C9D9DE" opacity="0.8" />
      <path d="M0 370 C 200 320, 360 360, 520 330 S 820 300, 980 340 S 1150 330, 1200 340 L1200 600 L0 600Z" fill="#A9C3B2" />
      {variant === "lake" && <path d="M0 430 C 300 410, 700 420, 1200 405 L1200 470 C 800 480, 400 475, 0 480Z" fill="#BFD6DF" opacity="0.9" />}
      <path d="M0 420 C 220 380, 420 430, 640 400 S 1000 380, 1200 410 L1200 600 L0 600Z" fill="#87A893" />
      <path d="M0 480 C 260 450, 520 500, 760 470 S 1080 450, 1200 470 L1200 600 L0 600Z" fill="#6B8F7A" />
      {variant !== "lake" && <path d="M640 600 C 600 560, 700 530, 660 500 S 590 470, 640 450 S 700 430, 690 418 L 700 418 C 720 432, 660 452, 668 470 S 760 505, 720 530 S 760 580, 800 600Z" fill={`url(#path-${variant})`} opacity="0.95" />}
      <path d="M0 540 C 300 520, 600 560, 900 535 S 1150 530, 1200 540 L1200 600 L0 600Z" fill="#4F6F5D" />
      <g fill="#46664F" opacity="0.9">
        <circle cx="140" cy="452" r="22" /><rect x="137" y="460" width="6" height="26" />
        <circle cx="1040" cy="436" r="26" /><rect x="1037" y="446" width="6" height="30" />
        <circle cx="1085" cy="448" r="18" /><rect x="1082" y="455" width="5" height="22" />
      </g>
    </svg>
  );
}
