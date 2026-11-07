// Small inline SVG icons for the two currencies.

export function FishIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="dried fish" role="img">
      <ellipse cx="13" cy="16" rx="11" ry="6.5" fill="#e8a858" stroke="#8a5a20" strokeWidth="2" />
      <path d="M22 16 L30 9 L30 23 Z" fill="#e8a858" stroke="#8a5a20" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11 Q13 16 10 21 M15 11 Q18 16 15 21" stroke="#c07a30" strokeWidth="1.5" fill="none" />
      <circle cx="6.5" cy="14.5" r="1.6" fill="#3a2a10" />
    </svg>
  );
}

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="fish coin" role="img">
      <circle cx="16" cy="16" r="14" fill="#ffd040" stroke="#b07a10" strokeWidth="2" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="#e8a820" strokeWidth="1.5" />
      <ellipse cx="14.5" cy="16" rx="6" ry="3.6" fill="#e8a820" />
      <path d="M19.5 16 L24 12.5 L24 19.5 Z" fill="#e8a820" />
      <circle cx="11.5" cy="15.2" r="1" fill="#8a5a00" />
    </svg>
  );
}

export function HeartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="base HP" role="img">
      <path
        d="M16 28 C4 19 2 12 6 7.5 C9.5 3.6 14 5 16 9 C18 5 22.5 3.6 26 7.5 C30 12 28 19 16 28 Z"
        fill="#ff6b7a"
        stroke="#b03040"
        strokeWidth="2"
      />
      <circle cx="10" cy="11" r="2.2" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}
