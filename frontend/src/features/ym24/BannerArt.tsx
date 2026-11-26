export default function BannerArt() {
  return (
    <svg
      className="ym24-banner-art"
      viewBox="0 0 420 200"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
    >
      {/* sun */}
      <circle cx="340" cy="52" r="20" fill="#e7a06c" />

      {/* hills, back to front */}
      <path d="M0 200 L0 140 C80 100 160 120 240 110 C320 100 380 80 420 90 L420 200 Z" fill="#3f6d52" />
      <path d="M0 200 L0 165 C90 130 170 150 250 135 C330 120 380 125 420 115 L420 200 Z" fill="#a9c4a0" />
      <path d="M0 200 L0 185 C100 160 180 175 260 160 C330 148 380 150 420 142 L420 200 Z" fill="#e4e2b6" />
      <path d="M0 200 L0 196 C120 180 200 190 280 178 C340 170 390 172 420 168 L420 200 Z" fill="#6f9a7c" />

      {/* sprout */}
      <path d="M250 130 C250 104 252 88 250 70" stroke="#e4e2b6" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M250 92 C225 92 215 74 218 62 C240 64 252 77 250 92 Z" fill="#e4e2b6" />
      <path d="M251 80 C272 80 285 64 283 50 C262 52 250 64 251 80 Z" fill="#e4e2b6" />
    </svg>
  );
}