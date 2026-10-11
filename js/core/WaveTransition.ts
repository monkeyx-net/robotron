import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { app, gameContentContainer, enemies, player } from '../main';
import { gameState } from '../gameState';
import { SoundManager } from '../soundManager';
import { ArcadeBorder } from './ArcadeBorder';
import { isEntityGone } from '../gameObject';

/**
 * Arcade wave-clear sequence, timed against the original ROM in MAME
 * (snapshots every 6 frames + sound-latch log):
 *
 *   0      last enemy dies: playfield wiped, border erased, wave-clear sound
 *   2-32   a rectangle outline spawns at the center every frame and grows
 *          ~3.8px per side per frame, colors sweeping red→yellow→green→
 *          cyan→blue; rings sweep off the arena by ~frame 60
 *   54-60  red outline redraws top-down, then the screen goes black
 *   66     next wave is laid out (new border color)
 *   66     humans and electrodes simply appear
 *   66-114 enemies "beam in" one by one at random moments: each sprite's
 *          pixel rows (or, for some, its columns) start spread across the
 *          arena and collapse onto it in a fraction of a second
 *   ~114   player converges from a starburst; play resumes (~2.2 s)
 */

const RING_SPAWN_START = 2;
const RING_SPAWN_END = 32;
const RING_GROWTH = 3.8;
const RING_START_HALF_W = 30;
const FLASH_START = 54;
const FLASH_END = 60;
const SPAWN_AT = 66;
const BEAM_DELAY_MAX = 30;            // enemies start beaming at random within this window
const BEAM_DUR_MIN = 10, BEAM_DUR_MAX = 18;   // per-enemy collapse time (frames)
const BEAM_SPREAD_MIN = 10, BEAM_SPREAD_MAX = 20;   // initial row/column spacing
const BEAM_HORIZONTAL_CHANCE = 0.25;  // some arcade enemies collapse sideways
const STAR_FRAMES = 20;
const STAR_SPREAD = 20;   // initial pixel spread for the player starburst

let active = false;

function ringColor(i: number, frame: number): number {
    // The arcade palette-cycles the rings: every ring shifts together from
    // red (~0.3 s) through yellow/green to cyan/blue (~0.8 s); newer
    // (inner) rings run slightly ahead and neighbours alternate in shade.
    const hue = Math.max(0, (frame - 16) * 7) + i * 1.5 + (i % 3) * 14;
    const c = new PIXI.Color({ h: Math.min(hue, 245), s: 100, v: i % 2 ? 100 : 80 });
    return c.toNumber();
}

function arenaRect() {
    const pf = GameConfig.PLAYFIELD;
    return { x0: pf.LEFT - 3, y0: pf.TOP - 3, x1: pf.RIGHT + 3, y1: pf.BOTTOM + 3 };
}

interface Beam {
    target: PIXI.Container; layer: PIXI.Container; rows: PIXI.Sprite[];
    owned: PIXI.Texture[]; generated?: PIXI.Texture;
    cx: number; cy: number;   // sprite center in layer coords
}

type SliceMode = 'rows' | 'cols' | 'pixels';

/** Slice a display object into 1px rows, columns or pixels for the beam effects. */
function sliceInto(target: PIXI.Container, mode: SliceMode): Beam | null {
    if (!target.parent || target.destroyed) return null;
    let base: PIXI.Texture;
    let generated: PIXI.Texture | undefined;
    let ox: number, oy: number;
    let tint = 0xFFFFFF;
    if (target instanceof PIXI.Sprite && target.texture?.source) {
        base = target.texture;
        ox = -target.anchor.x * base.frame.width;
        oy = -target.anchor.y * base.frame.height;
        tint = target.tint as number;
    } else {
        const lb = target.getLocalBounds();
        if (lb.width <= 0 || lb.height <= 0) return null;
        generated = app.renderer.generateTexture({ target, resolution: 1 });
        base = generated;
        ox = lb.x; oy = lb.y;
    }
    const f = base.frame;
    const layer = new PIXI.Container();
    layer.position.copyFrom(target.position);
    layer.scale.copyFrom(target.scale);
    const rows: PIXI.Sprite[] = [];
    const owned: PIXI.Texture[] = [];
    const w = Math.round(f.width), h = Math.round(f.height);
    const cells = mode === 'pixels' ? w * h : mode === 'cols' ? w : h;
    for (let i = 0; i < cells; i++) {
        const cx = mode === 'pixels' ? i % w : mode === 'cols' ? i : 0;
        const cy = mode === 'pixels' ? Math.floor(i / w) : mode === 'rows' ? i : 0;
        const tex = new PIXI.Texture({
            source: base.source,
            frame: new PIXI.Rectangle(f.x + cx, f.y + cy, mode === 'rows' ? w : 1, mode === 'cols' ? h : 1),
        });
        owned.push(tex);
        const s = new PIXI.Sprite(tex);
        s.tint = tint;
        // home offset relative to the sprite's center
        (s as any).homeX = ox + cx;
        (s as any).homeY = oy + cy;
        layer.addChild(s);
        rows.push(s);
    }
    target.parent.addChild(layer);
    target.visible = false;
    return { target, layer, rows, owned, generated, cx: ox + w / 2, cy: oy + h / 2 };
}

function placeBeam(b: Beam, spreadX: number, spreadY: number): void {
    const pf = GameConfig.PLAYFIELD;
    for (const s of b.rows) {
        const hx = (s as any).homeX, hy = (s as any).homeY;
        s.x = b.cx + (hx - b.cx) * spreadX;
        s.y = b.cy + (hy - b.cy) * spreadY;
        const gx = b.layer.x + s.x, gy = b.layer.y + s.y;
        s.visible = gy >= pf.TOP - 2 && gy <= pf.BOTTOM + 2 && gx >= pf.LEFT - 2 && gx <= pf.RIGHT + 2;
    }
}

function finishBeam(b: Beam): void {
    b.layer.parent?.removeChild(b.layer);
    b.layer.destroy({ children: true });
    b.owned.forEach(t => t.destroy(false));
    b.generated?.destroy(true);
    if (!b.target.destroyed) b.target.visible = true;
}

/** Run `step(frame)` each 60 Hz frame until it returns true. */
function animate(step: (frame: number) => boolean): void {
    let frame = 0;
    const tick = (ticker: PIXI.Ticker) => {
        if (gameState.currentGameState === 'PAUSED') return;
        frame += ticker.deltaTime;
        if (step(frame)) app.ticker.remove(tick);
    };
    app.ticker.add(tick);
}

/**
 * Beam the freshly spawned wave in, then the player; calls onDone when
 * play should resume. The caller keeps the state non-PLAYING meanwhile so
 * nothing moves.
 */
export function materialize(onDone: () => void): void {
    // Humans and electrodes are simply there; only enemies beam in.
    const enemySprites = enemies.filter(e => !isEntityGone(e)).map(e => e.sprite as PIXI.Container);
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const beams = enemySprites.map(t => {
        const horizontal = Math.random() < BEAM_HORIZONTAL_CHANCE;
        const b = sliceInto(t, horizontal ? 'cols' : 'rows');
        if (!b) return null;
        b.layer.visible = false;
        return { b, horizontal, delay: rand(0, BEAM_DELAY_MAX),
                 dur: rand(BEAM_DUR_MIN, BEAM_DUR_MAX), spread: rand(BEAM_SPREAD_MIN, BEAM_SPREAD_MAX), done: false };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    const playerSprite = player && !isEntityGone(player) ? player.sprite : null;
    if (playerSprite) playerSprite.visible = false;
    let star: Beam | null = null;
    let starStart = -1;

    animate(frame => {
        if (gameState.currentGameState !== 'WAVE_TRANSITION') {
            beams.forEach(x => { if (!x.done) finishBeam(x.b); });
            if (star) finishBeam(star);
            return true;
        }
        let pending = 0;
        for (const x of beams) {
            if (x.done) continue;
            const p = (frame - x.delay) / x.dur;
            if (p < 0) { pending++; continue; }
            if (p >= 1) { finishBeam(x.b); x.done = true; continue; }
            pending++;
            x.b.layer.visible = true;
            const spread = 1 + (x.spread - 1) * (1 - p);
            placeBeam(x.b, x.horizontal ? spread : 1, x.horizontal ? 1 : spread);
        }
        if (pending > 0) return false;
        if (playerSprite && !playerSprite.destroyed) {
            if (starStart < 0) { starStart = frame; star = sliceInto(playerSprite, 'pixels'); }
            const p = Math.min(1, (frame - starStart) / STAR_FRAMES);
            const spread = 1 + (STAR_SPREAD - 1) * (1 - p);
            if (star) placeBeam(star, spread, spread);
            if (p < 1) return false;
            if (star) finishBeam(star);
        }
        onDone();
        return true;
    });
}

/**
 * Wave cleared: wipe the playfield, play the zoom/ring sequence, then call
 * spawnNextWave() and beam it in; onDone() resumes play.
 */
export function start(clearField: () => void, spawnNextWave: () => void, onDone: () => void): void {
    if (active) return;
    active = true;
    clearField();
    if (player && !isEntityGone(player)) player.sprite.visible = false;
    ArcadeBorder.setVisible(false);
    SoundManager.play('waveComplete');

    const fx = new PIXI.Graphics();
    fx.zIndex = 1500;
    gameContentContainer.addChild(fx);
    const a = arenaRect();
    const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
    const maxHW = (a.x1 - a.x0) / 2, maxHH = (a.y1 - a.y0) / 2;

    const cleanup = () => {
        fx.parent?.removeChild(fx);
        fx.destroy();
        active = false;
    };

    animate(frame => {
        if (gameState.currentGameState !== 'WAVE_TRANSITION') {
            cleanup();
            ArcadeBorder.setVisible(true);
            return true;
        }
        fx.clear();
        if (frame < FLASH_START) {
            const f = Math.floor(frame);
            for (let born = RING_SPAWN_START; born < Math.min(f + 1, RING_SPAWN_END); born++) {
                const age = f - born;
                const hw = RING_START_HALF_W + age * RING_GROWTH;
                const hh = age * RING_GROWTH;
                if (hw > maxHW || hh > maxHH) continue;   // swept off the arena
                fx.rect(cx - hw, cy - hh, hw * 2, Math.max(hh * 2, 1))
                  .stroke({ width: 2, color: ringColor(born - RING_SPAWN_START, frame), alignment: 0.5 });
            }
        } else if (frame < FLASH_END) {
            // red outline redrawn top-down
            const p = (frame - FLASH_START) / (FLASH_END - FLASH_START);
            const down = (a.y1 - a.y0) * p;
            fx.rect(a.x0, a.y0, a.x1 - a.x0, 2).fill(0xFF0000);
            fx.rect(a.x0, a.y0, 2, down).fill(0xFF0000);
            fx.rect(a.x1 - 2, a.y0, 2, down).fill(0xFF0000);
        } else if (frame >= SPAWN_AT) {
            cleanup();
            ArcadeBorder.setVisible(true);
            spawnNextWave();
            materialize(onDone);
            return true;
        }
        return false;
    });
}

export const WaveTransition = { start, materialize, isActive: () => active };
