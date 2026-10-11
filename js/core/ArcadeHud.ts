import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { BitmapFont } from './BitmapFont';
import { ColorCycles } from './ColorCycles';
import { TwoPlayer } from './TwoPlayer';

/**
 * In-canvas arcade HUD, laid out from MAME snapshots of 1- and 2-player games
 * (robotron-re REVERSE.md Phase 21 "HUD"):
 *  - scores in the tall (alt) font at y 7, right-aligned to end at x 82 (P1)
 *    and x 210 (P2). The player whose turn it is has their score in cycling
 *    palette entry A; the waiting player's is red.
 *  - spare men as the ROM's 5x7 life icon every 8 px from x 86 (P1) / 214 (P2)
 *  - bottom line at y 231: P1's wave number ending at x 125, "WAVE" from
 *    x 134, and in 2-player games P2's wave number from x 160, in entry A.
 */

const SCORE_RIGHT = [83, 211];
const ICONS_X = [86, 214];
const ICON_PITCH = 8;
const MAX_ICONS = 7;
const TOP_Y = 7;
const BOTTOM_Y = 231;
const WAVE_RIGHT_P1 = 126, WAVE_LABEL_X = 134, WAVE_LEFT_P2 = 160;
const WAITING_RED = 0xFF0000;
// glyph cells already carry their blank column; MAME shows no extra gap
const NO_GAP = { tracking: 0 };
const SCORE_FONT = { font: 'alt' as const, tracking: 0 };

// The life icon, copied from MAME: o = orange $FF5100, B = cycling entry B,
// g = grey $8989A0, m = magenta $FF00FF.
const ICON = ['.ooo.', 'BB.BB', 'BB.BB', '..o..', 'gg.gg', 'm.g.m', '.g.g.'];
const ICON_FIXED: Record<string, number> = { o: 0xFF5100, g: 0x8989A0, m: 0xFF00FF };

interface Side { score: PIXI.Container; icons: PIXI.Container; bodies: PIXI.Graphics[]; wave: PIXI.Container; }

let container: PIXI.Container | null = null;
let sides: Side[] = [];
let waveLabel: PIXI.Container | null = null;
let last = '';
let active = 0;

function makeIcon(): { icon: PIXI.Container; body: PIXI.Graphics } {
    const icon = new PIXI.Container();
    const fixed = new PIXI.Graphics();
    const body = new PIXI.Graphics();
    ICON.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c === 'B') body.rect(x, y, 1, 1);
            else if (ICON_FIXED[c] !== undefined) fixed.rect(x, y, 1, 1).fill(ICON_FIXED[c]);
        }
    });
    body.fill(0xFFFFFF);
    icon.addChild(fixed, body);
    return { icon, body };
}

function tintAll(): void {
    if (!container || !container.visible) return;
    const a = ColorCycles.color(0xA) ?? 0xFFFFFF;
    const b = ColorCycles.color(0xB) ?? 0x0000FF;
    sides.forEach((s, i) => {
        const t = i === active ? a : WAITING_RED;
        s.score.children.forEach(c => { (c as PIXI.Sprite).tint = t; });
        s.bodies.forEach(g => { g.tint = b; });
        s.wave.children.forEach(c => { (c as PIXI.Sprite).tint = a; });
    });
    waveLabel?.children.forEach(c => { (c as PIXI.Sprite).tint = a; });
}

function setIcons(s: Side, men: number): void {
    s.icons.removeChildren().forEach(c => c.destroy({ children: true }));
    s.bodies = [];
    for (let i = 0; i < Math.max(0, Math.min(men, MAX_ICONS)); i++) {
        const { icon, body } = makeIcon();
        icon.x = i * ICON_PITCH;
        s.icons.addChild(icon);
        s.bodies.push(body);
    }
}

export const ArcadeHud = {
    init(stage: PIXI.Container): void {
        if (container) return;
        container = new PIXI.Container();
        container.zIndex = 1100;
        container.visible = false;  // shown by updateUI when a game is running
        sides = [0, 1].map(i => {
            const s: Side = { score: new PIXI.Container(), icons: new PIXI.Container(), bodies: [], wave: new PIXI.Container() };
            s.score.y = TOP_Y;
            s.icons.x = ICONS_X[i];
            s.icons.y = TOP_Y;
            s.wave.y = BOTTOM_Y;
            container!.addChild(s.score, s.icons, s.wave);
            return s;
        });
        waveLabel = BitmapFont.createText('WAVE', NO_GAP);
        waveLabel.x = WAVE_LABEL_X;
        waveLabel.y = BOTTOM_Y;
        container.addChild(waveLabel);
        stage.addChild(container);
        PIXI.Ticker.shared.add(tintAll);
    },

    /** Current player's score, men (including the one in play) and wave; the other player comes from TwoPlayer. */
    update(score: number, lives: number, wave: number): void {
        if (!container || !GameConfig) return;
        active = TwoPlayer.currentPlayer();
        const other = TwoPlayer.otherPlayer();
        const rows: ({ score: number; men: number; wave: number } | null)[] = [null, null];
        rows[active] = { score, men: lives - 1, wave };
        if (other) rows[1 - active] = { score: other.score, men: other.lives - 1, wave: other.wave };
        const key = JSON.stringify([rows, active]);
        if (key === last) return;
        last = key;
        rows.forEach((r, i) => {
            const s = sides[i];
            s.score.visible = s.icons.visible = s.wave.visible = !!r;
            if (!r) return;
            const text = String(r.score).padStart(2, '0');   // MAME shows a zero score as "00"
            BitmapFont.setText(s.score, text, SCORE_FONT);
            s.score.x = SCORE_RIGHT[i] - BitmapFont.measure(text, SCORE_FONT);
            setIcons(s, r.men);
            const w = String(r.wave);
            BitmapFont.setText(s.wave, w, NO_GAP);
            s.wave.x = i === 0 ? WAVE_RIGHT_P1 - BitmapFont.measure(w, NO_GAP) : WAVE_LEFT_P2;
        });
        tintAll();
    },

    setVisible(v: boolean): void {
        if (container) container.visible = v;
        if (v) tintAll();
    },
};
