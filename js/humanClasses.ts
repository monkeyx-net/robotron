import * as PIXI from 'pixi.js';
import { GameObject } from './gameObject';

export class Human extends GameObject {
    humanType: string;
    isEvil: boolean;
    isRescued: boolean;
    isStopped: boolean;
    speed: number;
    targetX: number;
    targetY: number;
    wanderTimer: number;
    stopTimer: number;
    reprogramTimer: number;
    flashTimer: number;
    createdAt: number;

    constructor(sprite: PIXI.Sprite, x: number, y: number, humanType: string, speed: number) {
        super(sprite, 'human');
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.humanType = humanType;
        this.isEvil = false;
        this.isRescued = false;
        this.isStopped = false;
        this.speed = speed;
        this.targetX = x;
        this.targetY = y;
        this.wanderTimer = Math.random() * 120 + 60; // 1-3 seconds in frame-based units
        this.stopTimer = Math.random() * 1500 + 500;
        this.reprogramTimer = 0;
        this.flashTimer = 0;
        this.createdAt = Date.now();
    }

    update(delta: number): void {
        // Human-specific update logic will be handled in humans.ts for now
    }
}

export class Prog extends GameObject {
    health: number;
    points: number;
    flashTimer: number;
    isEvil: boolean;
    reprogramTimer: number;

    constructor(sprite: PIXI.Graphics, x: number, y: number, points: number) {
        super(sprite, 'prog');
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.health = 1;
        this.points = points;
        this.flashTimer = 0;
        this.isEvil = false;
        this.reprogramTimer = 0;
    }

    update(delta: number): void {
        // Prog-specific update logic will be handled in humans.ts for now
    }
}