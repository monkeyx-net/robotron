import * as PIXI from 'pixi.js';
import { GameObject as NewGameObject } from './core/GameObject';
import { GameConfig } from './config';

// Legacy GameObject class for backward compatibility
// This will be gradually replaced by the new GameObject class
export class GameObject {
    sprite: PIXI.Sprite | PIXI.Graphics | PIXI.Container;
    type: string;
    isAlive: boolean;
    _destroyed: boolean;
    /** logical position; sprite position is synced from this each update */
    position: { x: number; y: number };
    previousPosition: { x: number; y: number };

    constructor(sprite: PIXI.Sprite | PIXI.Graphics | PIXI.Container, type: string) {
        this.sprite = sprite;
        this.type = type;
        this.isAlive = true;
        this._destroyed = false;
        this.position = { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
        this.previousPosition = { x: this.position.x, y: this.position.y };
    }

    update(_delta: number): void {
        // Base update logic, to be overridden by subclasses
    }

    destroy(): void {
        if (this.sprite && !this._destroyed) {
            if (this.sprite.parent) {
                this.sprite.parent.removeChild(this.sprite);
            }
            this.sprite.destroy();
            this._destroyed = true;
            this.isAlive = false;
        }
    }
}

/**
 * True when an entity or its PIXI sprite is destroyed/unusable. PIXI v8
 * throws on property access of destroyed display objects, so update loops
 * must check this BEFORE touching sprite.x/y — checking only the legacy
 * `_destroyed` flag freezes every entity in the loop when any sprite is
 * destroyed without that flag being set.
 */
export function isEntityGone(e: any): boolean {
    return !e || e._destroyed || !e.sprite || e.sprite.destroyed === true
        || (e.sprite as any)._destroyed === true;
}

/**
 * Half-extents of a center-anchored sprite, for playfield clamping.
 * Falls back to 4px when dimensions aren't readable (e.g. empty container).
 */
export function spriteHalfExtents(sprite: PIXI.Container): { hw: number; hh: number } {
    let hw = 4, hh = 4;
    try {
        if (sprite.width > 0) hw = sprite.width / 2;
        if (sprite.height > 0) hh = sprite.height / 2;
    } catch { /* destroyed or boundless sprite: keep fallback */ }
    return { hw, hh };
}

/**
 * Clamp a center-anchored sprite position so its bounding box stays inside
 * the arena border (GameConfig.PLAYFIELD) — entities must not overlap the
 * border line, matching the arcade.
 */
export function clampToPlayfield(pos: { x: number; y: number }, sprite: PIXI.Container): void {
    const pf = GameConfig.PLAYFIELD;
    const { hw, hh } = spriteHalfExtents(sprite);
    pos.x = Math.max(pf.LEFT + hw, Math.min(pf.RIGHT - hw, pos.x));
    pos.y = Math.max(pf.TOP + hh, Math.min(pf.BOTTOM - hh, pos.y));
}

// Export the new GameObject class as well for gradual migration
export { NewGameObject };

/**
 * The ROM's velocity mover ($DD09): each axis moves only if the sprite stays
 * inside the playfield; a blocked axis just doesn't move that frame.
 */
export function moveBlockedAtWalls(pos: { x: number; y: number }, sprite: PIXI.Container, dx: number, dy: number): void {
    const pf = GameConfig.PLAYFIELD;
    const { hw, hh } = spriteHalfExtents(sprite);
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx - hw >= pf.LEFT && nx + hw <= pf.RIGHT) pos.x = nx;
    if (ny - hh >= pf.TOP && ny + hh <= pf.BOTTOM) pos.y = ny;
}
