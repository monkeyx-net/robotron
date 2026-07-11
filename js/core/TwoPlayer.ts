import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';

/**
 * Arcade 2-player alternating mode. Each player has independent score,
 * lives, wave and rescue bonus; play swaps to the other player on death
 * (the incoming player's wave restarts fresh, like the arcade). The game
 * ends when both players are out of lives.
 */

interface PlayerSlot {
    score: number;
    lives: number;
    wave: number;
    rescueBonus: number;
    nextExtraLifeScore: number;
}

let playerCount = 1;
let current = 0;
let slots: PlayerSlot[] = [];

function snapshotCurrent(): void {
    slots[current] = {
        score: gameState.score,
        lives: gameState.lives,
        wave: gameState.wave,
        rescueBonus: gameState.currentHumanRescueBonus,
        nextExtraLifeScore: gameState.nextExtraLifeScore,
    };
}

function restore(idx: number): void {
    const s = slots[idx];
    gameState.score = s.score;
    gameState.lives = s.lives;
    // startNextWave() increments first, so park one below the stored wave
    gameState.wave = Math.max(0, s.wave - 1);
    gameState.currentHumanRescueBonus = s.rescueBonus;
    gameState.nextExtraLifeScore = s.nextExtraLifeScore;
    current = idx;
}

export const TwoPlayer = {
    /** Begin a game. count = 1 or 2. Call before the first startNextWave(). */
    startGame(count: number): void {
        playerCount = count === 2 ? 2 : 1;
        current = 0;
        const fresh = (): PlayerSlot => ({
            score: 0,
            lives: GameConfig.INITIAL_LIVES,
            wave: 1,
            rescueBonus: GameConfig.INITIAL_HUMAN_RESCUE_BONUS,
            nextExtraLifeScore: GameConfig.EXTRA_LIFE_SCORE_INTERVAL,
        });
        slots = playerCount === 2 ? [fresh(), fresh()] : [fresh()];
    },

    isTwoPlayer(): boolean { return playerCount === 2; },
    currentPlayer(): number { return current; },
    /** Scores for HUD display: [p1, p2?]. */
    scores(): number[] {
        const out = slots.map(s => s.score);
        if (out.length) out[current] = gameState.score;
        return out;
    },

    /**
     * Called after a death that leaves the current player with 0 lives OR
     * on every death in 2P mode. Returns:
     *  'continue'  — same player respawns (1P with lives left)
     *  'swap'      — control passes to the other player (caller shows the
     *                interstitial then restarts the incoming player's wave)
     *  'game_over' — nobody has lives left
     */
    onDeath(): 'continue' | 'swap' | 'game_over' {
        if (playerCount === 1) {
            return gameState.lives > 0 ? 'continue' : 'game_over';
        }
        snapshotCurrent();
        const other = 1 - current;
        if (slots[other].lives > 0) {
            restore(other);
            return 'swap';
        }
        if (gameState.lives > 0) return 'continue';
        return 'game_over';
    },

    /** Highest score across both players (for game-over/high-score flow). */
    allScores(): number[] {
        snapshotCurrent();
        return slots.map(s => s.score);
    },

    /** In-canvas "PLAYER 1/2" interstitial; resolves after `ms`. */
    showInterstitial(stage: PIXI.Container, ms = 1800): Promise<void> {
        const c = new PIXI.Container();
        c.zIndex = 2100;
        const text = `PLAYER ${current + 1}`;
        const t = BitmapFont.createText(text, { font: 'alt', tint: 0xFFFF44 });
        t.x = (GameConfig.GAME_WIDTH - BitmapFont.measure(text, { font: 'alt' })) / 2;
        t.y = GameConfig.GAME_HEIGHT / 2 - 4;
        c.addChild(t);
        stage.addChild(c);
        return new Promise(res => setTimeout(() => {
            stage.removeChild(c);
            c.destroy({ children: true });
            res();
        }, ms));
    },
};
