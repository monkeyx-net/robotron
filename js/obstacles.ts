import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { obstaclesContainer, obstacles } from './main';
import { gameState } from './gameState';
import { Electrode } from './obstacleClasses';
import { electrodeLook, ElectrodeFrame } from './core/ElectrodeShapes';
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
    drawFrame(g, look.frames[0]);
    g.tint = ColorCycles.color(look.entry) ?? color;
    const electrodeSprite: PIXI.Sprite | PIXI.Graphics = g;

    const electrode = new Electrode(electrodeSprite, x, y, width, height, color);
    (electrode as any).paletteEntry = look.entry;
    (electrode as any).look = look;
    obstaclesContainer.addChild(electrode.sprite);
    obstacles.push(electrode);
    return electrode;
}

/** Draw one ROM frame in white, centred on the graphic's origin. */
function drawFrame(g: PIXI.Graphics, frame: ElectrodeFrame): void {
    const h = frame.rows.length, w = frame.rows[0].length;
    g.clear();
    frame.rows.forEach((row, y) => {
        for (let x = 0; x < w; x++) if (row[x] === '#') g.rect(x - w / 2, y - h / 2, 1, 1);
    });
    g.fill(0xFFFFFF);
}

/**
 * Electrodes playing their death: out of `obstacles` (so nothing collides with
 * them) but still drawn, as the ROM does ($7AA9 unlinks the electrode and hands
 * its sprite to a process at $3AD9/$3AE0).
 */
interface DyingElectrode { electrode: Electrode; frame: number; left: number; }
const dying: DyingElectrode[] = [];

/**
 * Destroy an electrode (shot, or a grunt walked into it): it leaves the
 * obstacle list at once, then holds its resting frame for 6 frames, shrinks
 * through frames 1 and 2 (3 and 2 frames) and is erased.
 */
export function killElectrode(electrode: Electrode): void {
    const i = obstacles.indexOf(electrode);
    if (i >= 0) obstacles.splice(i, 1);
    const look = (electrode as any).look;
    if (!look || !electrode.sprite || (electrode.sprite as any).destroyed) {
        electrode.sprite?.destroy();
        return;
    }
    dying.push({ electrode, frame: 0, left: look.frames[0].hold });
}

/** Drop any electrodes still dying (wave end, game reset). */
export function clearDyingElectrodes(): void {
    for (const d of dying) if (!d.electrode.sprite.destroyed) d.electrode.sprite.destroy();
    dying.length = 0;
}

function updateDying(delta: number): void {
    for (let i = dying.length - 1; i >= 0; i--) {
        const d = dying[i];
        const g = d.electrode.sprite as PIXI.Graphics;
        if (g.destroyed) { dying.splice(i, 1); continue; }
        const look = (d.electrode as any).look;
        d.left -= delta;
        while (d.left <= 0) {
            d.frame++;
            if (d.frame >= look.frames.length) break;
            d.left += look.frames[d.frame].hold;
            drawFrame(g, look.frames[d.frame]);
        }
        if (d.frame >= look.frames.length) {
            g.destroy();
            dying.splice(i, 1);
            continue;
        }
        const c = ColorCycles.color(look.entry);
        if (c !== null) g.tint = c;
    }
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
            const c = ColorCycles.color((obstacle as any).paletteEntry);
            if (c !== null) (obstacle.sprite as PIXI.Graphics).tint = c;
        }
    }
    updateDying(delta);
}

export const Obstacles = {
    createElectrode,
    killElectrode,
    clearDyingElectrodes,
    updateObstacles
};
