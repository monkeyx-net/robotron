import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { obstaclesContainer, obstacles } from './main';
import { gameState } from './gameState';
import { Obstacle, Electrode } from './obstacleClasses';

export function createElectrode(x: number, y: number, width: number, height: number, color: number = 0xFFFF00): Electrode | null {
    if (!PIXI || !obstaclesContainer || !obstacles) {
        console.warn("Obstacles.createElectrode: Missing PIXI, obstaclesContainer, or obstacles array.");
        return null;
    }
    const electrodeSprite = new PIXI.Graphics();
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

            electrode.sprite.alpha = 0.7 + (baseFlash + rapidFlash) * 0.3;

            const colorPhase = (1 + Math.sin(flashPhase * 0.5)) * 0.5;
            // Convert RGB to hex manually (PIXI.utils.rgb2hex deprecated in v8)
            const r = Math.floor(255 * 1);
            const g = Math.floor(255 * 1);
            const b = Math.floor(255 * (0.6 + colorPhase * 0.4));
            electrode.sprite.tint = (r << 16) | (g << 8) | b;
        }
    }
}

export const Obstacles = {
    createElectrode,
    updateObstacles
};
