import { DUR, BPM, CUES, HOLDS, DROPS } from './timeline.js';
export { DUR };

export default function score(S) {
  S.tempo(BPM);
  S.space({ room: 0.78, damp: 0.38 });

  const drums = S.bus('drums', { gain: 0.56 });
  const bass = S.bus('bass', { gain: 0.44, duck: 0.45 });
  const keysBus = S.bus('keys', { gain: 0.58, reverb: 0.36, delay: 0.14, delayTime: S.beat(0.75), duck: 0.38, highpass: 160 });
  const malletBus = S.bus('mallet', { gain: 0.64, reverb: 0.26, delay: 0.20, delayTime: S.beat(0.5), duck: 0.32, highpass: 240 });
  const padBus = S.bus('pad', { gain: 0.26, reverb: 0.45, duck: 0.45, highpass: 200 });
  const sfx = S.bus('sfx', { gain: 0.80, reverb: 0.20 });

  const dLydian = S.scale('D4', 'lydian');
  const dBass = S.scale('D2', 'lydian');

  // Harmonic progression across 22.5 bars (120 BPM)
  const chordForBar = bar => {
    if (bar < 2) return ['D3', 'maj7', 0];
    if (bar < 4) return ['E3', 'add9', 1];
    if (bar < 6) return ['C#3', 'min7', -1];
    if (bar < 8) return ['B2', 'min7', -2];
    if (bar < 10) return ['G2', 'maj7#11', -4];
    if (bar < 12) return ['A2', 'sus4', -3];
    if (bar < 14) return ['D3', 'maj7', 0];
    if (bar < 16) return ['C#3', 'min7', -1];
    if (bar < 18) return ['G2', 'maj7', -4];    // Zen Pure Mode warmth
    if (bar < 20) return ['B2', 'min7', -2];    // Library Drawer return
    return ['D3', 'maj7', 0];                   // Resolution hold
  };

  const inHold = t => HOLDS.some(([a, b]) => t >= a - 0.05 && t <= b + 0.1);
  const inPreDrop = t => DROPS.some(d => t >= d - S.beat(1.5) && t < d - 0.02) || (t >= S.beat(62.5) && t < S.beat(64) - 0.02);
  const inZen = t => t >= S.beat(64) && t < S.beat(76);

  const totalBeats = Math.round(DUR / S.beat(1)); // 90 beats

  // Subtle archival room ambience texture
  padBus.add(S.ambience(DUR, { kind: 'room', amount: 0.18 }), 0, { gain: 0.3 });

  // Phrase-level warm electric keys & sustained atmospheric pad
  for (let bar = 0; bar < 22; bar++) {
    const t = S.bar(bar);
    const [root, q] = chordForBar(bar);
    const isFinalBar = bar >= 20;
    const dur = isFinalBar ? Math.max(0.5, DUR - t - 0.4) : S.bar(1) * 0.96;

    // Pad blooms smoothly every 2 bars (except after beat 84 let resolve chord ring naturally)
    if (bar % 2 === 0 && t < S.beat(84)) {
      const pDur = Math.min(S.bar(2) * 0.95, DUR - t - 0.3);
      padBus.add(S.pad(S.chord(root, q), pDur, { cutoff: inZen(t) ? 1100 : 1950, attack: 0.45, release: 1.0 }), t, {
        gain: inZen(t) ? 0.55 : 0.72,
      });
    }

    // Warm keys stab on every bar downbeat up to beat 83 (resolution chord)
    if (t <= S.beat(83)) {
      keysBus.add(S.keys(S.chord(root, q), Math.min(S.bar(1) * 0.9, dur), { decay: isFinalBar ? 2.4 : 1.35, index: 1.6 }), t, {
        gain: inZen(t) ? 0.48 : 0.68,
      });
    }
  }

  // Final resolve bell & warm Dmaj9 chord at beat 83.0 -> clean natural decay across HOLDS
  const tResolve = S.beat(83);
  keysBus.add(S.keys(S.chord('D3', 'maj9'), 4.2, { decay: 2.6, index: 1.4 }), tResolve, { gain: 0.75 });
  padBus.add(S.pad(S.chord('D4', 'maj7'), 4.6, { cutoff: 1450, attack: 0.25, release: 1.8 }), tResolve, { gain: 0.48 });

  // Beat-by-beat rhythmic pulse: wooden marimba ostinato + subtle electronic groove
  const motif = [0, 2, 4, 6, 4, 2, 1, 3];
  for (let beat = 0; beat < totalBeats; beat++) {
    const t = S.beat(beat);
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    const [root, , degOffset] = chordForBar(bar);

    if (inHold(t)) continue;

    const zen = inZen(t);
    const preDrop = inPreDrop(t);
    const intro = beat < 4;

    // 1. Marimba + Kalimba interlocking pulse (Signature Prism clockwork texture)
    if (!preDrop) {
      for (let sub = 0; sub < 2; sub++) {
        const st = t + sub * S.beat(0.5);
        if (st >= S.beat(83)) break;
        const idx = (beat * 2 + sub) % motif.length;
        const note = dLydian(motif[idx] + degOffset);
        const accent = sub === 0 && beatInBar === 0 ? 0.78 : sub === 0 ? 0.58 : 0.42;
        malletBus.add(
          S.mallet(note, 0.7, { material: zen ? 'vibes' : 'marimba', decay: zen ? 0.75 : 0.34, bright: zen ? 0.35 : 0.52, seed: 10 + beat * 3 + sub }),
          st,
          { gain: accent * (intro ? 0.65 : 1), pan: ((beat + sub) % 2 === 0 ? -0.28 : 0.28) },
        );
      }
    }

    // 2. Crisp minimal percussion (drops cleanly out in intro < Beat 4, pre-drops, Zen Pure Mode, and Holds)
    if (!intro && !preDrop && !zen && beat < 83) {
      // Soft deep kick on 1 & 3 (plus driving 4-on-floor during Dual-Column / QA peak Beats 28..57)
      const peakSection = beat >= 28 && beat < 57;
      if (beatInBar === 0 || beatInBar === 2 || peakSection) {
        drums.add(S.kick({ tone: 46, decay: 0.28, click: 0.32, drive: 0.2 }), t, { gain: beatInBar === 0 ? 0.68 : 0.56 });
        S.duck(t, 0.85);
      }
      // Subtle woody rim backbeat on 2 & 4
      if (beatInBar === 1 || beatInBar === 3) {
        drums.add(S.rim({ tone: 1.05, decay: 0.022, seed: 20 + beat }), t, { gain: 0.58, pan: -0.15 });
      }
      // Offbeat crisp 8th hi-hat & occasional 16th shaker glint
      drums.add(S.hat({ decay: 0.032, tone: 1.1, seed: 30 + beat }), t + S.beat(0.5), { gain: 0.34, pan: 0.22 });
      if (peakSection && beatInBar % 2 === 1) {
        drums.add(S.shaker({ decay: 0.045, seed: 40 + beat }), t + S.beat(0.25), { gain: 0.24, pan: -0.25 });
      }
    } else if (zen) {
      // Gentle sparse finger-shaker tick in Zen Pure Reading so the pulse still breathes subtly
      if (beatInBar === 0 || beatInBar === 2) {
        drums.add(S.shaker({ decay: 0.04, tone: 0.9, seed: 80 + beat }), t, { gain: 0.16, pan: 0.15 });
      }
    }

    // 3. Rounded Bass Foundation
    if (!intro && !preDrop && beat < 83) {
      if (zen) {
        if (beatInBar === 0) {
          bass.add(S.sub(root.replace('3', '2'), S.beat(2.5), { harm: 0.25 }), t, { gain: 0.35 });
        }
      } else if (beatInBar === 0 || beatInBar === 2) {
        const bNote = S.midi(root) > 45 ? S.midi(root) - 12 : S.midi(root);
        const fifth = dBass(degOffset + (beatInBar === 2 ? 4 : 0));
        bass.add(S.bass(beatInBar === 0 ? bNote : fifth, S.beat(0.85), { cutoff: 520, envAmt: 2.5, sub: 0.28, drive: 0.2 }), t + S.beat(0.5), {
          gain: 0.56,
        });
      }
    }
  }

  // Subtle air swells leading into Drops & Scene 1 Impact
  sfx.add(S.riser(S.beat(2.0), { from: 220, to: 2600, noise: 0.35 }), S.beat(0.0), { gain: 0.32 });
  sfx.add(S.riser(S.beat(1.5), { from: 260, to: 2200, noise: 0.28 }), S.beat(41.5), { gain: 0.26 });

  // Tactile UI SFX synced 1:1 to visual CUES
  for (const c of CUES) {
    if (c.sfx === 'click') {
      sfx.add(S.click({ tone: 1.05, seed: Math.round(c.t * 100) }), c.t, { gain: 0.55 });
    } else if (c.sfx === 'tick') {
      sfx.add(S.tick({ tone: 1.0 }), c.t, { gain: 0.32, pan: Math.sin(c.t * 3) * 0.3 });
    } else if (c.sfx === 'pop') {
      sfx.add(S.pop('E6', { decay: 0.06 }), c.t, { gain: 0.52, pan: 0.12 });
    } else if (c.sfx === 'whoosh') {
      sfx.add(S.whoosh(0.48, { from: 320, to: 3600, peak: 0.7, pan: 0.65 }), c.t - 0.48 * 0.7, { gain: 0.55 });
    } else if (c.sfx === 'bell') {
      sfx.add(S.bell('D6', 1.9, { ratio: 3.0, index: 2.2, decay: 0.9 }), c.t, { gain: 0.38, pan: -0.1 });
    } else if (c.sfx === 'impact') {
      sfx.add(S.impact({ size: 0.8 }), c.t, { gain: 0.75 });
      drums.add(S.crash({ dur: 1.8 }), c.t, { gain: 0.22 });
      S.duck(c.t, 0.9);
    }
  }
}
