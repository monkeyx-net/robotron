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
    /** walk frames, ROM order: left 0-2, right 3-5, down 6-8, up 9-11 */
    frames: PIXI.Texture[] = [];
    /** ROM walk ($425F): current [frame, dx, dy] table, position in it, steps left */
    walkTable = 0;
    walkIdx = 0;
    walkSteps = 0;
    /** frames until the next step */
    stepTimer = 0;

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

    update(_delta: number): void {
        // Human-specific update logic will be handled in humans.ts for now
    }
}

/**
 * A reprogrammed human (ROM $5E19/$5EAB). It walks with the captured human's
 * own frames drawn as a solid silhouette in cycling palette entry A, and
 * leaves a trail of its last 6 positions in entry E (humans.ts).
 */
export class Prog extends GameObject {
    health: number;
    points: number;
    flashTimer: number;
    isEvil: boolean;
    reprogramTimer: number;
    /** silhouette walk frames, ROM order: left 0-2, right 3-5, down 6-8, up 9-11 */
    frames: PIXI.Texture[] = [];
    /** first frame of the current direction, and its x/y step (px) per pass */
    dirBase = 0;
    stepX = 0;
    stepY = 0;
    /** position in the 0,1,0,2 walk cycle */
    walk = 0;
    /** frames until the next 3-frame pass */
    passTimer = 0;
    /** target offset from the player (px), re-rolled now and then */
    offsetX = 0;
    offsetY = 0;
    /** afterimages, oldest first */
    trail: PIXI.Sprite[] = [];

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, points: number) {
        super(sprite as PIXI.Graphics, 'prog');
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

    /** Remove the afterimages (the body sprite is destroyed by its owner). */
    clearTrail(): void {
        for (const t of this.trail) if (!t.destroyed) t.destroy();
        this.trail.length = 0;
    }

    destroy(): void {
        this.clearTrail();
        super.destroy();
    }

    update(_delta: number): void {
        // Prog-specific update logic will be handled in humans.ts for now
    }
}