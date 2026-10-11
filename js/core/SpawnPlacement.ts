/**
 * Wave-start spawn positions, as the Robotron 2084 ROM picks them (robotron-re
 * REVERSE.md Phase 21, "Spawn positions").
 *
 *  - $7199 (via $26C3): a random top-left for a sprite w bytes x h lines:
 *    x = prng_bounded($88 - w) + 6, y = prng_bounded($D2 - h) + $17.
 *  - Grunts, hulks and electrodes retry while that lands inside an exclusion
 *    box around the player's start, from a table at $3920 picked by wave
 *    ($78FE: waves 1-5 own entries, 6-9 share one, 10+ another). Electrodes
 *    shrink the box by 4 lines / 3 bytes a side ($7973). Grunts also retry
 *    while the spot overlaps anything already drawn ($DE0F).
 *  - Humans take any random point ($42F4).
 *  - Brains take a random point, then half the time move x into a 16-byte band
 *    at the left or right edge, otherwise y into a 32-line band at the top or
 *    bottom ($5B57).
 *  - Spheroids enter at x = $09 or $87 with a random y ($5168); quarks at row
 *    $1A or $DC with a random x ($8B36).
 *
 * ROM x is in bytes (2 px), y in lines; screen top-left = (2x - 6, y - 7),
 * measured in MAME. Positions returned here are sprite centres.
 */
import { prng } from './Prng';

/** prng_bounded ($D6AC): 1..n */
function bounded(n: number): number {
    return ((prng.step() * n) >> 8) + 1;
}

/** $3920 + 4 * level: [y0, y1, x0, x1] (lines, bytes); index 0 is unused */
const BOXES: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [0x40, 0xB0, 0x1A, 0x7A],
    [0x48, 0xA8, 0x1A, 0x7A],
    [0x50, 0xA0, 0x2A, 0x6A],
    [0x54, 0x9D, 0x30, 0x60],
    [0x5D, 0x96, 0x35, 0x59],
    [0x62, 0x94, 0x38, 0x5C],
];

/** $78FE: box for a wave (1-5 own, 6-9 share level 5, 10+ level 6). */
function boxFor(wave: number): [number, number, number, number] {
    const level = wave >= 10 ? 6 : Math.min(Math.max(1, wave), 5);
    return BOXES[level];
}

export interface SpawnPoint { x: number; y: number; }

/** Sprite size in ROM units: bytes wide (2 px each) and lines tall. */
function romSize(wPx: number, hPx: number): [number, number] {
    return [Math.ceil(wPx / 2), Math.ceil(hPx)];
}

function toPort(xb: number, yb: number, wPx: number, hPx: number): SpawnPoint {
    return { x: 2 * xb - 6 + wPx / 2, y: yb - 7 + hPx / 2 };
}

/** $7199: random top-left (bytes, lines) for a w x h sprite. */
function randomTopLeft(w: number, h: number): [number, number] {
    return [bounded(0x88 - w) + 6, bounded(0xD2 - h) + 0x17];
}

function inBox(xb: number, yb: number, box: [number, number, number, number]): boolean {
    const [y0, y1, x0, x1] = box;
    return yb > y0 && yb < y1 && xb > x0 && xb < x1;
}

/** Give up on extra constraints after this many tries (the ROM loops forever). */
const MAX_TRIES = 500;

export const SpawnPlacement = {
    /**
     * Grunts and hulks: outside the wave's exclusion box. `blocked` reports
     * whether a candidate centre would overlap something already placed
     * (the grunts' screen check).
     */
    outsideBox(wave: number, wPx: number, hPx: number, blocked?: (p: SpawnPoint) => boolean): SpawnPoint {
        const [w, h] = romSize(wPx, hPx);
        const box = boxFor(wave);
        let p: SpawnPoint = { x: 0, y: 0 };
        for (let i = 0; i < MAX_TRIES; i++) {
            const [xb, yb] = randomTopLeft(w, h);
            if (inBox(xb, yb, box)) continue;
            p = toPort(xb, yb, wPx, hPx);
            if (!blocked || !blocked(p)) return p;
        }
        return p;
    },

    /** Electrodes: the same box shrunk by 4 lines and 3 bytes on each side. */
    electrode(wave: number, wPx: number, hPx: number): SpawnPoint {
        const [w, h] = romSize(wPx, hPx);
        const [y0, y1, x0, x1] = boxFor(wave);
        const box: [number, number, number, number] = [y0 + 4, y1 - 4, x0 + 3, x1 - 3];
        for (;;) {
            const [xb, yb] = randomTopLeft(w, h);
            if (!inBox(xb, yb, box)) return toPort(xb, yb, wPx, hPx);
        }
    },

    /** Humans: anywhere. */
    anywhere(wPx: number, hPx: number): SpawnPoint {
        const [w, h] = romSize(wPx, hPx);
        const [xb, yb] = randomTopLeft(w, h);
        return toPort(xb, yb, wPx, hPx);
    },

    /** Brains: a random point pushed into an edge band. */
    brain(wPx: number, hPx: number): SpawnPoint {
        const [w, h] = romSize(wPx, hPx);
        let [xb, yb] = randomTopLeft(w, h);
        if (!(prng.step() & 0x80)) {
            const n = bounded(0x10);
            xb = prng.step() & 0x80 ? 0x8F - (n + w) : n + 7;
        } else {
            const n = bounded(0x20);
            yb = prng.step() & 0x80 ? 0xEA - (n + h) : n + 0x18;
        }
        return toPort(xb, yb, wPx, hPx);
    },

    /** Spheroids: the left or right edge, random height. */
    spheroid(wPx: number, hPx: number): SpawnPoint {
        const [w, h] = romSize(wPx, hPx);
        const yb = randomTopLeft(w, h)[1];
        const xb = prng.step() & 0x80 ? 0x09 : 0x87;
        return toPort(xb, yb, wPx, hPx);
    },

    /** Quarks: the top or bottom edge, random column. */
    quark(wPx: number, hPx: number): SpawnPoint {
        const yb = prng.step() & 0x80 ? 0xDC : 0x1A;
        const xb = bounded(0x7E) + 6;
        return toPort(xb, yb, wPx, hPx);
    },
};
