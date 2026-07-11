import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { obstaclesContainer, obstacles } from './main';
import { gameState } from './gameState';
import { Obstacle, Electrode } from './obstacleClasses';
import { ArcadeAtlas } from './core/ArcadeAtlas';

export function createElectrode(x: number, y: number, width: number, height: number, color: number = 0xFFFF00): Electrode | null {
    if (!PIXI || !obstaclesContainer || !obstacles) {
        console.warn("Obstacles.createElectrode: Missing PIXI, obstaclesContainer, or obstacles array.");
        return null;
    }
    // Per-wave electrode style from the ROM atlas (10 captured variants).
    // Their pixels use color-cycled palette entries (baked near-white), so
    // apply the per-wave color as a tint — wave 1 is orange, wave 2 magenta
    // etc., matching MAME reference frames.
    const WAVE_TINTS = [0xFF8822, 0xFF44FF, 0x44FFFF, 0xFFFF44, 0x44FF44, 0xFF4444, 0xFFFFFF, 0x8888FF];
    const variant = ArcadeAtlas.texture(`electrode_${(Math.max(1, gameState.wave) - 1) % 10}`);
    const electrodeSprite: PIXI.Sprite | PIXI.Graphics = variant
        ? (() => {
            const s = new PIXI.Sprite(variant);
            s.anchor.set(0.5);
            s.tint = WAVE_TINTS[(Math.max(1, gameState.wave) - 1) % WAVE_TINTS.length];
            return s;
        })()
        : new PIXI.Graphics();
    const electrode = new Electrode(electrodeSprite, x, y, width, height, color);
    obstaclesContainer.addChild(electrode.sprite);
    obstacles.push(electrode);
    return electrode;
}

export function updateObstacles(delta: number): void {
    if (typeof gameState.currentGameState === 'undefined' || (gameState.currentGameState !== 'PLAYING' && gameState.currentGameState !== 'DEMO_PLAY')) {
        return;
    }
    if (!obstacles || !GameConfig) {
        return;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        if (!obstacle || obstacle._destroyed) {
            obstacles.splice(i, 1);
            continue;
        }
        if (obstacle.type === 'electrode') {
            const electrode = obstacle as Electrode;
            electrode.flashTimer += GameConfig.ELECTRODE_FLASH_RATE * delta;
            const flashPhase = electrode.flashTimer % (Math.PI * 4);
            const baseFlash = Math.sin(flashPhase);
            const rapidFlash = Math.sin(flashPhase * 3) * 0.3;

            // alpha flicker only — the ROM sprites carry their own colors
            electrode.sprite.alpha = 0.7 + (baseFlash + rapidFlash) * 0.3;
        }
    }
}

export const Obstacles = {
    createElectrode,
    updateObstacles
};
