// Main-menu branding: an emblem (cat ears + crescent moon + paw) and a layered
// scenery backdrop (stars, moon glow, forest silhouettes). Colors come from
// theme tokens (--scene-*, --moon, --emblem-*) so both themes share the art.

/** Round emblem: cat-ear badge with a crescent moon and a paw print. */
export function BrandEmblem({ size = 92 }: { size?: number }) {
  return (
    <svg className="brand-emblem" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {/* ears */}
      <path d="M18 44 L24 8 L46 28 Z" fill="var(--emblem-ear)" stroke="var(--icon-line)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M82 44 L76 8 L54 28 Z" fill="var(--emblem-ear)" stroke="var(--icon-line)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M25 34 L27 17 L37 27 Z" fill="var(--emblem-ear-in)" />
      <path d="M75 34 L73 17 L63 27 Z" fill="var(--emblem-ear-in)" />
      {/* head badge */}
      <circle cx="50" cy="56" r="38" fill="var(--emblem-bg)" stroke="var(--icon-line)" strokeWidth="3" />
      <circle cx="50" cy="56" r="31" fill="var(--emblem-sky)" />
      {/* tiny stars */}
      <circle cx="34" cy="42" r="1.6" fill="var(--scene-star)" />
      <circle cx="42" cy="33" r="1.1" fill="var(--scene-star)" />
      <circle cx="69" cy="70" r="1.3" fill="var(--scene-star)" />
      {/* crescent moon */}
      <path d="M67 34a15 15 0 1 0 6 20 12 12 0 1 1-6-20z" fill="var(--moon)" />
      {/* paw */}
      <g fill="var(--emblem-paw)">
        <ellipse cx="44" cy="68" rx="9" ry="7.5" />
        <circle cx="33" cy="58" r="3.6" />
        <circle cx="39.5" cy="52.5" r="3.6" />
        <circle cx="48.5" cy="52.5" r="3.6" />
        <circle cx="55" cy="58" r="3.6" />
      </g>
    </svg>
  );
}

/** Layered menu backdrop: stars, moon glow and two rows of forest silhouettes. */
export function HomeScenery() {
  const stars: [number, number, number][] = [
    [22, 30, 1.4], [60, 14, 1], [96, 44, 1.2], [140, 20, 1.6], [180, 56, 1], [214, 26, 1.2],
    [252, 12, 1], [300, 40, 1.4], [334, 22, 1], [40, 80, 1], [120, 70, 1.1], [270, 84, 1],
  ];
  // Tree silhouettes: x, height
  const far: [number, number][] = [[0, 46], [30, 58], [62, 42], [92, 64], [128, 50], [160, 60], [196, 44], [228, 66], [262, 50], [296, 60], [330, 48], [360, 56]];
  const near: [number, number][] = [[-6, 70], [36, 54], [74, 78], [118, 58], [250, 60], [292, 82], [338, 62]];
  const tree = (x: number, h: number, base: number) =>
    `M${x} ${base} L${x + 14} ${base - h} L${x + 28} ${base} Z M${x + 4} ${base - h * 0.45} L${x + 14} ${base - h - 10} L${x + 24} ${base - h * 0.45} Z`;
  return (
    <svg className="home-scenery" viewBox="0 0 360 640" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--moon)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="scene-stars">
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--scene-star)" style={{ animationDelay: `${(i % 5) * 0.7}s` }} />
        ))}
      </g>
      <circle cx="300" cy="78" r="70" fill="url(#moonGlow)" />
      <circle cx="300" cy="78" r="20" fill="var(--moon)" />
      <circle cx="292" cy="72" r="4" fill="var(--moon-shade)" />
      <circle cx="306" cy="86" r="2.6" fill="var(--moon-shade)" />
      <path d={far.map(([x, h]) => tree(x, h, 640)).join(' ')} fill="var(--scene-far)" />
      <path d="M0 640 Q90 600 180 616 T360 606 V640 Z" fill="var(--scene-far)" />
      <path d={near.map(([x, h]) => tree(x, h, 640)).join(' ')} fill="var(--scene-near)" />
    </svg>
  );
}
