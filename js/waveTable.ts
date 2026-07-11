/**
 * Arcade-authentic per-wave enemy compositions.
 *
 * Captured from the original ROM running in MAME by logging the per-wave
 * counter RAM ($BE68 grunts, $BE6D hulks, $BE6E brains, $BE6F spheroids,
 * $BE71 quarks, $BE70 live-tank cap) and the human pointer table ($B354,
 * max live count over each wave's first 2s) at wave init — two
 * independent runs agreed byte-for-byte (robotron-re capture pipeline).
 *
 * Waves 5/10 are brain waves, 7/12 quark waves; the pattern escalates and
 * repeats past the captured range.
 */

export interface WaveDef {
    grunts: number;
    electrodes: number;
    hulks: number;
    brains: number;
    spheroids: number;
    quarks: number;
    /** max simultaneous quark-spawned tanks */
    tankCap: number;
    humans: number;
}

// Waves 1-12, ROM-captured (electrodes approximated: not in counter RAM).
const WAVES: WaveDef[] = [
    { grunts: 15, electrodes: 20, hulks: 0,  brains: 0,  spheroids: 0, quarks: 0,  tankCap: 0,  humans: 3 },  // 1
    { grunts: 17, electrodes: 16, hulks: 5,  brains: 0,  spheroids: 1, quarks: 0,  tankCap: 0,  humans: 3 }, // 2
    { grunts: 22, electrodes: 20, hulks: 6,  brains: 0,  spheroids: 3, quarks: 0,  tankCap: 0,  humans: 6 }, // 3
    { grunts: 34, electrodes: 24, hulks: 7,  brains: 0,  spheroids: 4, quarks: 0,  tankCap: 0,  humans: 6 }, // 4
    { grunts: 20, electrodes: 0,  hulks: 7,  brains: 15, spheroids: 1, quarks: 0,  tankCap: 0,  humans: 16 }, // 5 brain wave
    { grunts: 32, electrodes: 24, hulks: 7,  brains: 0,  spheroids: 4, quarks: 0,  tankCap: 0,  humans: 10 }, // 6
    { grunts: 0,  electrodes: 0,  hulks: 12, brains: 0,  spheroids: 0, quarks: 20, tankCap: 10, humans: 12 },  // 7 quark wave
    { grunts: 35, electrodes: 28, hulks: 12, brains: 0,  spheroids: 5, quarks: 0,  tankCap: 0,  humans: 9 }, // 8
    { grunts: 59, electrodes: 32, hulks: 8,  brains: 0,  spheroids: 5, quarks: 0,  tankCap: 0,  humans: 9 },  // 9
    { grunts: 25, electrodes: 0,  hulks: 4,  brains: 20, spheroids: 1, quarks: 0,  tankCap: 0,  humans: 22 }, // 10 brain wave
    { grunts: 35, electrodes: 28, hulks: 8,  brains: 0,  spheroids: 5, quarks: 0,  tankCap: 0,  humans: 9 }, // 11
    { grunts: 0,  electrodes: 0,  hulks: 13, brains: 0,  spheroids: 0, quarks: 20, tankCap: 12, humans: 12 },  // 12 quark wave
];

/**
 * Composition for a 1-based wave number. Past the captured range the
 * 5-wave cadence repeats (waves 8-12 pattern), like the arcade's cycling
 * late game.
 */
export function getWaveDef(wave: number): WaveDef {
    const w = Math.max(1, wave);
    if (w <= WAVES.length) return WAVES[w - 1];
    // repeat the wave 8-12 block (grunt, grunt-heavy, brain, grunt, quark)
    const idx = 7 + ((w - 13) % 5);
    return WAVES[idx];
}
