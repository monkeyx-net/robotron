/**
 * The arcade's heroes screen, laid out from MAME snapshots (robotron-re
 * REVERSE.md Phase 21 "Heroes table", tools/attract_snap_probe.lua and
 * tools/gameover_probe.lua):
 *
 * - The whole screen is concentric rings, each 2 px thick and dithered on a
 *   checkerboard: ring k runs from (6+2k, 6+2k) to (284-2k, 232-2k), k = 0..56.
 *   Ring k takes ring (k mod 8)'s colour from a 21-step rainbow ramp, and the
 *   ramp moves one ring every 3 frames.
 * - The rectangle wipe: from black, the rings are drawn outward in 8-ring bands,
 *   then erased from the centre out, leaving rings 0-7 as the frame. WIPE holds
 *   the MAME frames, since the ROM's timing depends on how busy the CPU is.
 * - ROBOTRON HEROES: 10 rows in the tall font, two columns of 5.
 * - ALL TIME HEROES: #1 in the tall font, then #2-37 in the small font in
 *   three columns of 12.
 * - The two headings take ring 6's colour. Both tables are red and pulse through
 *   pink to white and back (24 frames) on a 56-frame cycle, ALL TIME HEROES
 *   28 frames after ROBOTRON HEROES.
 */
import * as PIXI from 'pixi.js';
import { BitmapFont } from './BitmapFont';
import { loadTable, loadAllTime, HighScoreRow } from './HighScoreEntry';

const RAMP = [
    0xAE00FF, 0x8926FF, 0x7626FF, 0x5126FF, 0x0000FF, 0x0051FF, 0x0076A0, 0x00FF00,
    0x76D900, 0xFFD900, 0xFFAE00, 0xFF8900, 0xFF7600, 0xFF5100, 0xFF005F, 0xFF005F,
    0xFF00A0, 0xFF00A0, 0xFF00FF, 0xFF00FF, 0xD900FF,
];
const RING_FRAMES = 3;
const RINGS = 57, FRAME_RINGS = 8, RING_W = 2;
const FRAME_X0 = 6, FRAME_Y0 = 6, FRAME_X1 = 284, FRAME_Y1 = 232;
const HEADING_RING = 6;

/**
 * The wipe, one entry per frame from the first black frame (MAME, after GAME OVER):
 * [ramp step, then lit rings as first,last pairs]. The text appears on the next
 * frame, at ramp step 2.
 */
const WIPE: number[][] = [
    [0], [0], [0], [0],
    [0], [0], [0], [2, 55,55],
    [2, 55,55], [3, 47,47,54,55], [3, 46,47,54,55], [3, 46,47,54,55],
    [4, 45,47,53,55], [4, 45,47,53,55], [4, 38,39,45,47,53,55], [5, 36,39,44,47,52,55],
    [5, 36,39,44,47,52,55], [5, 36,39,44,47,52,55], [5, 30,31,36,39,44,47,52,55], [6, 29,31,35,39,43,47,51,55],
    [6, 27,31,35,39,43,47,51,55], [6, 27,31,35,39,43,47,51,55], [7, 26,31,34,39,42,47,50,55], [7, 22,23,26,31,34,39,42,47,50,55],
    [7, 21,23,26,31,34,39,42,47,50,55], [7, 20,23,26,31,34,39,42,47,50,55], [8, 18,23,25,31,33,39,41,47,49,55], [8, 17,23,25,31,33,39,41,47,49,55],
    [8, 17,23,25,31,33,39,41,47,49,55], [8, 14,15,17,23,25,31,33,39,41,47,49,55], [8, 13,15,17,23,25,31,33,39,41,47,49,55], [9, 12,56],
    [9, 11,56], [9, 10,56], [9, 8,56], [9, 7,56],
    [10, 6,56], [10, 5,56], [10, 4,56], [10, 3,56],
    [10, 2,56], [10, 1,56], [11, 0,56], [11, 0,52],
    [12, 0,50], [12, 0,48], [12, 0,46], [12, 0,44],
    [13, 0,42], [13, 0,40], [13, 0,38], [14, 0,36],
    [14, 0,34], [14, 0,32], [15, 0,30], [15, 0,29],
    [15, 0,27], [16, 0,25], [16, 0,24], [16, 0,22],
    [16, 0,21], [17, 0,19], [17, 0,18], [17, 0,17],
    [17, 0,15], [17, 0,14], [18, 0,13], [18, 0,12],
    [18, 0,10], [18, 0,9], [18, 0,8], [19, 0,7],
    [19, 0,7], [19, 0,7], [19, 0,7], [19, 0,7],
    [20, 0,7], [20, 0,7], [20, 0,7], [20, 0,7],
    [0, 0,7], [0, 0,7], [0, 0,7], [0, 0,7],
    [1, 0,7], [1, 0,7], [1, 0,7],];
const TABLE_RAMP_START = 2;

/**
 * Game over erases the frozen playfield right to left before the wipe (the ROM
 * clears video memory column by column): x where the cleared part starts, per frame.
 */
export const ERASE_FROM_X = [284, 272, 216, 158, 104, 46];

const RED = 0xFF0000;
/** red -> pink -> white -> pink -> red, one entry per frame of the pulse */
const PULSE = [
    ...Array(4).fill(0xFF515F), ...Array(4).fill(0xFF89A0), ...Array(8).fill(0xFFFFFF),
    ...Array(4).fill(0xFF89A0), ...Array(4).fill(0xFF515F),
];
const PULSE_CYCLE = 56, HEROES_PULSE_AT = 3, ALL_TIME_PULSE_AT = 31;

const TALL = { font: 'alt' as const, tracking: 0 };
const SMALL = { font: 'main' as const, tracking: 0 };

let tick: ((t: PIXI.Ticker) => void) | null = null;

function pulse(frame: number, at: number): number {
    const p = (((frame - at) % PULSE_CYCLE) + PULSE_CYCLE) % PULSE_CYCLE;
    return p < PULSE.length ? PULSE[p] : RED;
}

/** One ring: lit where (x + y) is even, in white so it can be tinted. */
function ring(k: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const x0 = FRAME_X0 + k * RING_W, y0 = FRAME_Y0 + k * RING_W;
    const x1 = FRAME_X1 - k * RING_W, y1 = FRAME_Y1 - k * RING_W;
    for (let y = y0; y <= y1; y++) {
        const edgeRow = y < y0 + RING_W || y > y1 - RING_W;
        for (let x = x0; x <= x1; x++) {
            if ((x + y) % 2) continue;
            if (edgeRow || x < x0 + RING_W || x > x1 - RING_W) g.rect(x, y, 1, 1);
        }
    }
    return g.fill(0xFFFFFF);
}

/** Ring geometry is fixed, so it is built once and reused. */
let ringContexts: PIXI.GraphicsContext[] | null = null;
function ringContext(k: number): PIXI.GraphicsContext {
    if (!ringContexts) ringContexts = [];
    if (!ringContexts[k]) {
        const g = ring(k);
        ringContexts[k] = g.context;
    }
    return ringContexts[k];
}

export const HeroesScreen = {
    /** Frames of the rectangle wipe before the tables appear. */
    WIPE_FRAMES: WIPE.length,

    /** Build the screen into `c` (cleared first), play the wipe and start the colour cycling. */
    show(c: PIXI.Container): void {
        HeroesScreen.stop();
        c.removeChildren().forEach(ch => ch.destroy({ children: true }));

        const rings = Array.from({ length: RINGS }, (_, k) => c.addChild(new PIXI.Graphics(ringContext(k))));
        const table = c.addChild(new PIXI.Container());
        const headings: PIXI.Container[] = [];
        const heroesText: PIXI.Container[] = [];
        const allTimeText: PIXI.Container[] = [];

        const text = (s: string, x: number, y: number, opts: typeof TALL | typeof SMALL, into: PIXI.Container[]) => {
            const t = BitmapFont.createText(s, { ...opts, tint: RED });
            t.x = x;
            t.y = y;
            table.addChild(t);
            into.push(t);
        };
        // right-aligned so the last lit column is `right`; glyph cells carry a blank column
        const right = (s: string, rightX: number, y: number, opts: typeof TALL | typeof SMALL, into: PIXI.Container[]) =>
            text(s, rightX + 2 - BitmapFont.measure(s, opts), y, opts, into);

        // headings word by word at MAME's x (the ROM's spaces vary in width)
        for (const [w, x] of [['ROBOTRON', 100], ['HEROES', 152]] as const) text(w, x, 30, TALL, headings);
        for (const [w, x] of [['ALL', 100], ['TIME', 123], ['HEROES', 152]] as const) text(w, x, 103, TALL, headings);

        const heroes = loadTable();
        heroes.forEach((r: HighScoreRow, i: number) => {
            const col = Math.floor(i / 5) * 104, y = 46 + (i % 5) * 9;
            right(`${i + 1})`, 60 + col, y, TALL, heroesText);
            text(r.initials, 66 + col, y, TALL, heroesText);
            right(String(r.score), 134 + col, y, TALL, heroesText);
        });

        const allTime = loadAllTime();
        const top = allTime[0];
        right('1)', 44, 115, TALL, allTimeText);
        right(String(top.score), 106, 115, TALL, allTimeText);
        // The ROM fits 3 initials before the score; a longer operator-length name goes after it.
        if (top.initials.length <= 4) text(top.initials, 48, 115, TALL, allTimeText);
        else text(top.initials, 112, 115, TALL, allTimeText);
        allTime.slice(1).forEach((r: HighScoreRow, j: number) => {
            const col = Math.floor(j / 12) * 80, y = 129 + (j % 12) * 7;
            right(`${j + 2})`, 44 + col, y, SMALL, allTimeText);
            text(r.initials, 48 + col, y, SMALL, allTimeText);
            right(String(r.score), 96 + col, y, SMALL, allTimeText);
        });

        const tintRings = (step: number) =>
            rings.forEach((g, k) => { if (g.visible) g.tint = RAMP[(step + (k % FRAME_RINGS)) % RAMP.length]; });
        const paintWipe = (frame: number) => {
            const [step, ...lit] = WIPE[frame];
            rings.forEach((g, k) => {
                let on = false;
                for (let i = 0; i < lit.length; i += 2) if (k >= lit[i] && k <= lit[i + 1]) on = true;
                g.visible = on;
            });
            tintRings(step);
        };
        const paintTable = (frame: number) => {
            const step = TABLE_RAMP_START + Math.floor(frame / RING_FRAMES);
            tintRings(step);
            const heading = RAMP[(step + HEADING_RING) % RAMP.length];
            const h = pulse(frame, HEROES_PULSE_AT), a = pulse(frame, ALL_TIME_PULSE_AT);
            const tintAll = (list: PIXI.Container[], tint: number) =>
                list.forEach(t => t.children.forEach(ch => { (ch as PIXI.Sprite).tint = tint; }));
            tintAll(headings, heading);
            tintAll(heroesText, h);
            tintAll(allTimeText, a);
        };
        const paint = (frame: number) => {
            if (frame < WIPE.length) {
                table.visible = false;
                paintWipe(frame);
                return;
            }
            if (!table.visible) {
                table.visible = true;
                rings.forEach((g, k) => { g.visible = k < FRAME_RINGS; });
            }
            paintTable(frame - WIPE.length);
        };
        let frames = 0, shown = -1;
        paint(0);
        tick = (t: PIXI.Ticker) => {
            frames += t.deltaTime;
            const f = Math.floor(frames);
            if (f !== shown) { shown = f; paint(f); }
        };
        PIXI.Ticker.shared.add(tick);
    },

    stop(): void {
        if (tick) { PIXI.Ticker.shared.remove(tick); tick = null; }
    },
};
