export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const b = n => n * BEAT;
export const revealOn = (hit, dur, reveal = 0) => hit - reveal * dur;

export const DUR = b(90); // 45.0 s — 90 beats (22.5 bars @ 120 BPM)

export const SHOTS = [
  { id: 'hook-studio', t0: b(0), t1: b(13) },   // 0.0-6.5s: Prism convergence -> Studio modal & 3 modes
  { id: 'mental-dag', t0: b(13), t1: b(28) },   // 6.5-14.0s: Top Mental Model & interactive DAG zoom
  { id: 'dual-column', t0: b(28), t1: b(43) },  // 14.0-21.5s: Dual-column highlights & 4D analysis
  { id: 'qa-evidence', t0: b(43), t1: b(57) },  // 21.5-28.5s: Selection drag -> AI Q&A modal -> dashed badge
  { id: 'themes-pure', t0: b(57), t1: b(76) },  // 28.5-38.0s: Paper/Aurora/Studio flip -> 760px Pure EN <-> ZH
  { id: 'library-hold', t0: b(76), t1: b(90) }, // 38.0-45.0s: 4D Library Drawer -> Prism end card hold
];

export const CUES = [
  { t: b(0.5), sfx: 'pop' },
  { t: b(2.0), sfx: 'impact' },
  { t: b(4.0), sfx: 'click' },
  { t: b(8.0), sfx: 'whoosh' },
  { t: b(10.5), sfx: 'click' },
  { t: b(13.0), sfx: 'whoosh' },
  { t: b(19.0), sfx: 'tick' },
  { t: b(21.0), sfx: 'tick' },
  { t: b(23.0), sfx: 'tick' },
  { t: b(28.0), sfx: 'whoosh' },
  { t: b(33.0), sfx: 'tick' },
  { t: b(35.0), sfx: 'pop' },
  { t: b(43.0), sfx: 'impact' },
  { t: b(45.0), sfx: 'click' },
  { t: b(52.0), sfx: 'bell' },
  { t: b(57.0), sfx: 'whoosh' },
  { t: b(59.0), sfx: 'click' },
  { t: b(62.0), sfx: 'click' },
  { t: b(65.0), sfx: 'whoosh' },
  { t: b(70.5), sfx: 'pop' },
  { t: b(76.0), sfx: 'whoosh' },
  { t: b(79.0), sfx: 'pop' },
  { t: b(83.0), sfx: 'bell' },
];

export const HOLDS = [
  [b(83), b(90)], // End lockup quiet hold (3.5s)
];

export const DROPS = [
  b(43), // Breath before Signature Selection Q&A
];
