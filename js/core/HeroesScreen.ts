/**
 * The arcade's heroes screen, laid out from MAME snapshots (robotron-re
 * REVERSE.md Phase 21 "Heroes table", tools/attract_snap_probe.lua):
 *
 * - A frame of 8 concentric rings, each 2 px thick and dithered on a
 *   checkerboard, from (6,6) to (285,233). Every 3 frames the colours of a
 *   21-step rainbow ramp move one ring outward; the two headings take ring 6's
 *   colour.
 * - ROBOTRON HEROES: 10 rows in the tall font, two columns of 5.
 * - ALL TIME HEROES: #1 in the tall font, then #2-37 in the small font in
 *   three columns of 12.
 * - Both tables are red and pulse through pink to white and back (24 frames)
 *   on a 56-frame cycle, ALL TIME HEROES 28 frames after ROBOTRON HEROES.
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
const RINGS = 8, RING_W = 2;
const FRAME_X0 = 6, FRAME_Y0 = 6, FRAME_X1 = 285, FRAME_Y1 = 233;
const HEADING_RING = 6;

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

/** One ring of the frame: lit where (x + y) is even, in white so it can be tinted. */
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

export const HeroesScreen = {
    /** Build the screen into `c` (cleared first) and start its colour cycling. */
    show(c: PIXI.Container): void {
        HeroesScreen.stop();
        c.removeChildren().forEach(ch => ch.destroy({ children: true }));

        const rings = Array.from({ length: RINGS }, (_, k) => c.addChild(ring(k)));
        const headings: PIXI.Container[] = [];
        const heroesText: PIXI.Container[] = [];
        const allTimeText: PIXI.Container[] = [];

        const text = (s: string, x: number, y: number, opts: typeof TALL | typeof SMALL, into: PIXI.Container[]) => {
            const t = BitmapFont.createText(s, { ...opts, tint: RED });
            t.x = x;
            t.y = y;
            c.addChild(t);
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

        const paint = (frame: number) => {
            const shift = Math.floor(frame / RING_FRAMES);
            rings.forEach((g, k) => { g.tint = RAMP[(shift + k) % RAMP.length]; });
            const heading = RAMP[(shift + HEADING_RING) % RAMP.length];
            const h = pulse(frame, HEROES_PULSE_AT), a = pulse(frame, ALL_TIME_PULSE_AT);
            const tintAll = (list: PIXI.Container[], tint: number) =>
                list.forEach(t => t.children.forEach(ch => { (ch as PIXI.Sprite).tint = tint; }));
            tintAll(headings, heading);
            tintAll(heroesText, h);
            tintAll(allTimeText, a);
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
