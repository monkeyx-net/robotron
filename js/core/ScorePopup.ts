import * as PIXI from 'pixi.js';
import { app, effectsContainer } from '../main';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';

/**
 * Arcade-style point popups: the award value drawn in the ROM font at the
 * spot where it was earned (human rescues, spheroid kills), held briefly,
 * then removed. Lives in effectsContainer, so wave/game resets that clear
 * effects also clear any popup still on screen.
 */

const POPUP_FRAMES = 90;   // ~1.5 s at 60 FPS
const POPUP_TINT = 0xFFFFFF;

export function show(x: number, y: number, points: number, tint: number = POPUP_TINT): void {
    if (!effectsContainer || !app?.ticker) return;

    const text = String(points);
    const popup = BitmapFont.createText(text, { font: 'main', tint });
    popup.x = Math.round(x - BitmapFont.measure(text, { font: 'main' }) / 2);
    popup.y = Math.round(y - BitmapFont.lineHeight('main') / 2);
    popup.zIndex = 1000;
    effectsContainer.addChild(popup);

    let frames = 0;
    const tick = (ticker: PIXI.Ticker) => {
        if (popup.destroyed) {
            app.ticker.remove(tick);
            return;
        }
        if (gameState.currentGameState === 'PAUSED') return;
        frames += ticker.deltaTime;
        if (frames >= POPUP_FRAMES) {
            app.ticker.remove(tick);
            popup.parent?.removeChild(popup);
            popup.destroy({ children: true });
        }
    };
    app.ticker.add(tick);
}

export const ScorePopup = { show };
