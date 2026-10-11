/**
 * The ROM's colour-cycling palette entries (Williams palette byte BBGGGRRR).
 * Entries A, B, D, E and F are rewritten every frame by fixed programs; anything
 * drawn in one of them changes colour with it. Electrodes use one per wave
 * (ElectrodeShapes.ts) and progs draw their body in A and their trail in E.
 *
 * The programs were logged frame by frame from the palette writes in MAME
 * (robotron-re REVERSE.md Phase 21, "Colour cycles"); they are the same on
 * every wave. Entry A shows a random entry of D's table for 6 frames, then
 * white for 2.
 */
import * as PIXI from 'pixi.js';

// MAME's levels for the 3-bit red/green and 2-bit blue guns
const RG = [0x00, 0x26, 0x51, 0x76, 0x89, 0xAE, 0xD9, 0xFF];
const BL = [0x00, 0x5F, 0xA0, 0xFF];

/** Williams palette byte (BBGGGRRR) to 0xRRGGBB. */
export function paletteRgb(b: number): number {
    return (RG[b & 7] << 16) | (RG[(b >> 3) & 7] << 8) | BL[b >> 6];
}

type Program = [number, number][];   // [palette byte, frames]

const steps = (bytes: number[], frames: number): Program => bytes.map(b => [b, frames]);

const D_TABLE = [0xFF, 0xBF, 0x3F, 0x3E, 0x3C, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
                 0x37, 0x2F, 0x27, 0x1F, 0x17, 0x47, 0x87, 0xC7, 0xC6, 0xC5, 0xCC, 0xCB, 0xCA,
                 0xDA, 0xE8, 0xF8, 0xF9, 0xFA, 0xFB, 0xFD];

const PROGRAMS: Record<string, Program> = {
    // red, orange flash
    F: [[0x07, 12], [0x2F, 6]],
    // red -> magenta, fast sweep down to blue and back, -> red
    E: [...steps([0x07, 0x47, 0x87, 0xC7], 2),
        ...steps([0xC6, 0xC5, 0xC4, 0xC3, 0xC2, 0xC1, 0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7], 1),
        ...steps([0x87, 0x47], 2)],
    // blue, green, red
    B: steps([0xC0, 0x38, 0x07], 8),
    // rainbow; holds the three reds-to-magenta steps for 4 frames
    D: D_TABLE.map(b => [b, b === 0x47 || b === 0x87 || b === 0xC7 ? 4 : 2] as [number, number]),
};
const PERIOD: Record<string, number> = {};
for (const k in PROGRAMS) PERIOD[k] = PROGRAMS[k].reduce((n, [, f]) => n + f, 0);

let frame = 0;
let running = false;
let aColor = 0xFF, aSlot = -1;

function step(ticker: PIXI.Ticker): void { frame += ticker.deltaTime; }

function programByte(entry: string, t: number): number {
    const prog = PROGRAMS[entry];
    let f = Math.floor(t) % PERIOD[entry];
    for (const [b, n] of prog) { if (f < n) return b; f -= n; }
    return prog[0][0];
}

export const ColorCycles = {
    /** Start the shared frame clock (once; color() does this on first use). */
    init(): void {
        if (running) return;
        running = true;
        PIXI.Ticker.shared.add(step);
    },

    /** Current colour (0xRRGGBB) of palette entry 0x0-0xF; non-cycling entries return null. */
    color(entry: number): number | null {
        ColorCycles.init();
        const e = entry.toString(16).toUpperCase();
        if (e === 'A') {
            // 8-frame slots: a random D colour for 6 frames, then white for 2
            const slot = Math.floor(frame / 8);
            // cosmetic: Math.random so drawing never perturbs the gameplay PRNG
            if (slot !== aSlot) { aSlot = slot; aColor = D_TABLE[Math.floor(Math.random() * D_TABLE.length)]; }
            return paletteRgb(frame % 8 < 6 ? aColor : 0xFF);
        }
        if (PROGRAMS[e]) return paletteRgb(programByte(e, frame));
        return null;
    },
};
