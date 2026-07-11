import * as PIXI from 'pixi.js';
import { GameObject } from './gameObject';

export class Obstacle extends GameObject {
    flashTimer: number;

    constructor(sprite: PIXI.Graphics, type: string, indestructible: boolean, flashTimer: number = 0) {
        super(sprite, type);
        this.indestructible = indestructible;
        this.flashTimer = flashTimer;
    }

    update(delta: number): void {
        // Base update logic for obstacles, can be overridden
    }
}

export class Electrode extends Obstacle {
    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, width: number, height: number, color: number) {
        super(sprite as PIXI.Graphics, 'electrode', true);
        this.sprite.x = x;
        this.sprite.y = y;
        this.position.x = x;
        this.position.y = y;
        if (sprite instanceof PIXI.Graphics) {
            sprite.beginFill(color);
            sprite.drawRect(-width/2, -height/2, width, height);
            sprite.endFill();
        }
    }

    update(delta: number): void {
        // Electrode-specific update logic will be handled in obstacles.ts for now
    }
}