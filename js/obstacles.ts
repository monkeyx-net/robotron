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
    // Electrodes are drawn procedurally: their ROM sprite sources live in
    // the bank-switched window, where captured pixel data is nondeterministic
    // (sometimes screen-copy blits) — an atlas frame there can end up looking
    // like a grunt. Shapes and colors follow the per-wave arcade sequence
    // (wave 1 = orange starburst, wave 2 = magenta lattice, ...).
    const WAVE_TINTS = [0xFF8822, 0xFF44FF, 0x44FFFF, 0xFFFF44, 0x44FF44, 0xFF4444, 0xFFFFFF, 0x8888FF];
    const wave = Math.max(1, gameState.wave);
    const color2 = WAVE_TINTS[(wave - 1) % WAVE_TINTS.length];
    const g = new PIXI.Graphics();
    const shape = (wave - 1) % 5;
    if (shape === 0) {
        // 8-point starburst
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i;
            g.moveTo(0, 0).lineTo(Math.cos(a) * 5, Math.sin(a) * 5).stroke({ width: 1, color: color2 });
        }
    } else if (shape === 1) {
        // crosshatch lattice square
        g.rect(-4, -4, 8, 8).stroke({ width: 1, color: color2 });
        g.moveTo(-4, -4).lineTo(4, 4).stroke({ width: 1, color: color2 });
        g.moveTo(4, -4).lineTo(-4, 4).stroke({ width: 1, color: color2 });
    } else if (shape === 2) {
        // diamond
        g.poly([0, -5, 5, 0, 0, 5, -5, 0]).fill(color2);
    } else if (shape === 3) {
        // triangle
        g.poly([0, -5, 5, 4, -5, 4]).fill(color2);
    } else {
        // solid square
        g.rect(-4, -4, 8, 8).fill(color2);
    }
    const electrodeSprite: PIXI.Sprite | PIXI.Graphics = g;

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
