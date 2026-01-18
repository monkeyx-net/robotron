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
    constructor(sprite: PIXI.Graphics, x: number, y: number, width: number, height: number, color: number) {
        super(sprite, 'electrode', true);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.beginFill(color);
        this.sprite.drawRect(-width/2, -height/2, width, height);
        this.sprite.endFill();
    }

    update(delta: number): void {
        // Electrode-specific update logic will be handled in obstacles.ts for now
    }
}