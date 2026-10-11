import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { obstaclesContainer, obstacles } from './main';
import { gameState } from './gameState';
import { Electrode } from './obstacleClasses';
import { electrodeLook } from './core/ElectrodeShapes';
import { ColorCycles } from './core/ColorCycles';

export function createElectrode(x: number, y: number, width: number, height: number, color: number = 0xFFFF00): Electrode | null {
    if (!PIXI || !obstaclesContainer || !obstacles) {
        console.warn("Obstacles.createElectrode: Missing PIXI, obstaclesContainer, or obstacles array.");
        return null;
    }
    // ROM look for this wave (js/core/ElectrodeShapes.ts): one of 9 shapes on a
    // 10-wave cycle, drawn pixel for pixel in white, centred here, and tinted
    // each frame with the colour of its cycling palette entry.
    const look = electrodeLook(gameState.wave);
    const g = new PIXI.Graphics();
    const h = look.rows.length, w = look.rows[0].length;
    look.rows.forEach((row, y) => {
        for (let x = 0; x < w; x++) if (row[x] === '#') g.rect(x - w / 2, y - h / 2, 1, 1);
    });
    g.fill(0xFFFFFF);
    g.tint = ColorCycles.color(look.entry) ?? color;
    const electrodeSprite: PIXI.Sprite | PIXI.Graphics = g;

    const electrode = new Electrode(electrodeSprite, x, y, width, height, color);
    (electrode as any).paletteEntry = look.entry;
    obstaclesContainer.addChild(electrode.sprite);
    obstacles.push(electrode);
    return electrode;
}

export function updateObstacles(_delta: number): void {
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
            const c = ColorCycles.color((obstacle as any).paletteEntry);
            if (c !== null) (obstacle.sprite as PIXI.Graphics).tint = c;
        }
    }
}

export const Obstacles = {
    createElectrode,
    updateObstacles
};
