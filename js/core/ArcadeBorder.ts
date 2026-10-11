import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';

/**
 * The arcade playfield border — a 2px rectangle around the play area whose
 * color depends on the wave. Colors sampled from the original ROM running
 * in MAME (pixel at the top border, every wave 1-14): a 10-wave cycle where
 * wave 4 flickers through magenta/purple shades, wave 9's border is black
 * (invisible), and wave 10 color-cycles through a rainbow.
 */

type BorderStyle =
    | { kind: 'solid'; color: number }
    | { kind: 'flicker'; colors: number[] }   // random shade every step
    | { kind: 'cycle'; colors: number[] };    // steps through in order

const STEP_FRAMES = 6;   // MAME: color changes every 0.1 s

const WAVE_STYLES: BorderStyle[] = [
    { kind: 'solid', color: 0xFF5100 },   // 1 orange-red
    { kind: 'solid', color: 0xFFFF00 },   // 2 yellow
    { kind: 'solid', color: 0xFF0000 },   // 3 red
    { kind: 'flicker', colors: [0xFF005F, 0xFF00A0, 0xFF00FF, 0xD900FF, 0xAE00FF,
                                0x8900FF, 0x7600FF, 0x5100FF, 0x2600FF, 0xFF0000] }, // 4
    { kind: 'solid', color: 0x0000FF },   // 5 blue
    { kind: 'solid', color: 0xFF00FF },   // 6 magenta
    { kind: 'solid', color: 0xFF7600 },   // 7 orange
    { kind: 'solid', color: 0x8989A0 },   // 8 grey-lavender
    { kind: 'solid', color: 0x000000 },   // 9 black — no visible border
    { kind: 'cycle', colors: [0x00FFFF, 0x51FF5F, 0xAEAE00, 0xFF7600, 0xFF2600,
                              0xAE0000, 0x760000, 0x260000, 0x0000FF, 0x0089FF] }, // 10
];

let gfx: PIXI.Graphics | null = null;
let style: BorderStyle = WAVE_STYLES[0];
let frames = 0;
let step = -1;

function draw(color: number): void {
    if (!gfx) return;
    // Inset arena rectangle: the border encloses the playfield only —
    // score row above it, WAVE label below it (matches the cabinet).
    const pf = GameConfig.PLAYFIELD;
    const x0 = pf.LEFT - 3, y0 = pf.TOP - 3;
    const x1 = pf.RIGHT + 3, y1 = pf.BOTTOM + 3;
    gfx.clear();
    gfx.rect(x0, y0, x1 - x0, 2).fill(color);
    gfx.rect(x0, y1 - 2, x1 - x0, 2).fill(color);
    gfx.rect(x0, y0, 2, y1 - y0).fill(color);
    gfx.rect(x1 - 2, y0, 2, y1 - y0).fill(color);
}

function tick(ticker: PIXI.Ticker): void {
    if (!gfx || style.kind === 'solid') return;
    frames += ticker.deltaTime;
    const s = Math.floor(frames / STEP_FRAMES);
    if (s === step) return;
    step = s;
    const colors = style.colors;
    draw(style.kind === 'cycle'
        ? colors[s % colors.length]
        : colors[Math.floor(Math.random() * colors.length)]);
}

export const ArcadeBorder = {
    init(parent: PIXI.Container): void {
        if (gfx) return;
        gfx = new PIXI.Graphics();
        gfx.zIndex = 1000;
        parent.addChild(gfx);
        ArcadeBorder.setWave(1);
        PIXI.Ticker.shared.add(tick);
    },

    setWave(wave: number): void {
        style = WAVE_STYLES[(Math.max(1, wave) - 1) % WAVE_STYLES.length];
        frames = 0;
        step = -1;
        if (style.kind === 'solid') draw(style.color);
        else draw(style.colors[0]);
    },

    setVisible(v: boolean): void {
        if (gfx) gfx.visible = v;
    },
};
