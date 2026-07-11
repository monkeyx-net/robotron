import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';

/**
 * The arcade playfield border — a 2px rectangle around the play area whose
 * color changes every wave, cycling through the Williams palette order used
 * by the original (red, yellow, blue, green, magenta, cyan, white...).
 */

const WAVE_COLORS = [
    0xFF0000, // red
    0xFFFF00, // yellow
    0x0000FF, // blue
    0x00FF00, // green
    0xFF00FF, // magenta
    0x00FFFF, // cyan
    0xFFFFFF, // white
    0xFF8800, // orange
];

let gfx: PIXI.Graphics | null = null;

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

export const ArcadeBorder = {
    init(parent: PIXI.Container): void {
        if (gfx) return;
        gfx = new PIXI.Graphics();
        gfx.zIndex = 1000;
        parent.addChild(gfx);
        draw(WAVE_COLORS[0]);
    },

    setWave(wave: number): void {
        draw(WAVE_COLORS[(Math.max(1, wave) - 1) % WAVE_COLORS.length]);
    },

    setVisible(v: boolean): void {
        if (gfx) gfx.visible = v;
    },
};
