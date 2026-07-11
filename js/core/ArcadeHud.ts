import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { BitmapFont } from './BitmapFont';
import { ArcadeAtlas } from './ArcadeAtlas';

/**
 * In-canvas arcade HUD, replacing the old HTML DOM score/lives display.
 * Layout mirrors the original (see MAME snapshots / REVERSE.md Ph7):
 *  - P1 score: right-aligned digits ending near x=66, y=8
 *  - lives: small player icons in a row right of the score
 *  - wave number: bottom center next to "WAVE" label
 */

let container: PIXI.Container | null = null;
let scoreText: PIXI.Container | null = null;
let waveText: PIXI.Container | null = null;
let livesRow: PIXI.Container | null = null;
let last = { score: -1, lives: -1, wave: -1 };

export const ArcadeHud = {
    init(stage: PIXI.Container): void {
        if (container) return;
        container = new PIXI.Container();
        container.zIndex = 1100;
        container.visible = false;  // shown by updateUI when a game is running
        scoreText = new PIXI.Container();
        scoreText.y = 4;   // above the arena border
        waveText = new PIXI.Container();
        waveText.y = GameConfig.GAME_HEIGHT - 7;  // below the arena border
        livesRow = new PIXI.Container();
        livesRow.x = 72;
        livesRow.y = 1;
        container.addChild(scoreText, waveText, livesRow);
        stage.addChild(container);
    },

    update(score: number, lives: number, wave: number): void {
        if (!container || !scoreText || !waveText || !livesRow) return;
        if (score !== last.score) {
            const s = String(score);
            BitmapFont.setText(scoreText, s, { tint: 0xFF4444 });
            scoreText.x = 66 - BitmapFont.measure(s);
            last.score = score;
        }
        if (lives !== last.lives) {
            livesRow.removeChildren().forEach(c => c.destroy());
            const tex = ArcadeAtlas.texture('player_0');
            const shown = Math.max(0, Math.min(lives - 1, 8));
            for (let i = 0; i < shown; i++) {
                if (tex) {
                    const icon = new PIXI.Sprite(tex);
                    icon.scale.set(0.75);
                    icon.x = i * 8;
                    livesRow.addChild(icon);
                } else {
                    const g = new PIXI.Graphics();
                    g.rect(i * 8, 0, 5, 8).fill(0xFF4444);
                    livesRow.addChild(g);
                }
            }
            last.lives = lives;
        }
        if (wave !== last.wave) {
            const label = `${wave}  WAVE`;
            BitmapFont.setText(waveText, label, { tint: 0x44FF44 });
            waveText.x = (GameConfig.GAME_WIDTH - BitmapFont.measure(label)) / 2;
            last.wave = wave;
        }
    },

    setVisible(v: boolean): void {
        if (container) container.visible = v;
    },
};
