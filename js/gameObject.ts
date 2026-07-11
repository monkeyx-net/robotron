import * as PIXI from 'pixi.js';
import { GameObject as NewGameObject } from './core/GameObject';

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

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, type: string) {
        this.sprite = sprite;
        this.type = type;
        this.isAlive = true;
        this._destroyed = false;
        this.position = { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
        this.previousPosition = { x: this.position.x, y: this.position.y };
    }

    update(delta: number): void {
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

// Export the new GameObject class as well for gradual migration
export { NewGameObject };