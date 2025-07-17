import * as PIXI from 'pixi.js';
import { GameObject } from './gameObject';

export class Projectile extends GameObject {
    dx: number;
    dy: number;
    bouncesLeft?: number;

    constructor(sprite: PIXI.Graphics, type: string, dx: number, dy: number, bouncesLeft?: number) {
        super(sprite, type);
        this.dx = dx;
        this.dy = dy;
        this.bouncesLeft = bouncesLeft;
    }

    update(delta: number): void {
        this.sprite.x += this.dx * delta;
        this.sprite.y += this.dy * delta;
    }
}