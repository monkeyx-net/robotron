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
    const w = GameConfig.GAME_WIDTH;
    const h = GameConfig.GAME_HEIGHT;
    gfx.clear();
    // two nested 1px rectangles = 2px arcade border
    gfx.rect(0, 0, w, 2).fill(color);
    gfx.rect(0, h - 2, w, 2).fill(color);
    gfx.rect(0, 0, 2, h).fill(color);
    gfx.rect(w - 2, 0, 2, h).fill(color);
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
