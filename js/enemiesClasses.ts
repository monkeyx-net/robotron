import * as PIXI from 'pixi.js';
import { GameObject } from './gameObject';

export class Enemy extends GameObject {
    health: number;
    points: number;
    dx: number;
    dy: number;
    speed: number;
    indestructible: boolean;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics | PIXI.Container, type: string, health: number, points: number, speed: number = 0, indestructible: boolean = false) {
        super(sprite, type);
        this.health = health;
        this.points = points;
        this.dx = 0;
        this.dy = 0;
        this.speed = speed;
        this.indestructible = indestructible;
    }

    update(delta: number): void {
        // Store previous position for interpolation
        this.previousPosition.x = this.position.x;
        this.previousPosition.y = this.position.y;
        
        // Update logical position (not sprite position directly)
        this.position.x += this.dx * delta;
        this.position.y += this.dy * delta;
        
        // Update sprite position from logical position
        // This will be handled by the RenderSystem for smooth interpolation
        this.sprite.x = this.position.x;
        this.sprite.y = this.position.y;
    }
}

export class Grunt extends Enemy {
    lastAngle: number;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number) {
        super(sprite, 'grunt', 1, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.lastAngle = Math.random() * Math.PI * 2;
    }
}

export class Hulk extends Enemy {
    wanderTimer: number;
    isCharging: boolean;
    chargeTarget: any; // Will be a Human object

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number) {
        super(sprite, 'hulk', Infinity, points, speed, true);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.wanderTimer = Math.random() * 120 + 60;
        this.isCharging = false;
        this.chargeTarget = null;
    }
}

export class Spheroid extends Enemy {
    pulseTimer: number;
    pulseRate: number;
    /** enforcers still to drop: ceil(prng_le($BE5E) / 2) */
    dropsLeft: number;
    /** frames until the next drop-timer expiry */
    dropTimer: number;
    /** past the first wait and dropping */
    dropping = false;
    /** all dropped: flying off a side edge */
    leaving = false;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, drops: number, firstDrop: number) {
        super(sprite, 'spheroid', 2, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.pulseTimer = 0;
        this.pulseRate = 0.05;
        this.dropsLeft = drops;
        this.dropTimer = firstDrop;
    }
}

export class Enforcer extends Enemy {
    shootTimer: number;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, shootDelay: number) {
        super(sprite, 'enforcer', 2, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.shootTimer = shootDelay / 2 + Math.random() * shootDelay / 2;
    }
}

export class Brain extends Enemy {
    shootTimer: number;
    reprogramTarget: any; // Will be a Human object
    reprogramTimer: number;
    reprogramProgress: number;
    /** frames until the next step ($BE63 apart) */
    stepTimer = 0;
    /** steps until the next cruise missile: prng_le($BE62) */
    missileSteps: number;

    constructor(sprite: PIXI.Container, x: number, y: number, speed: number, points: number, missileSteps: number, reprogramDuration: number) {
        super(sprite, 'brain', 3, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.shootTimer = 0;
        this.missileSteps = missileSteps;
        this.reprogramTarget = null;
        this.reprogramTimer = reprogramDuration;
        this.reprogramProgress = 0;
    }
}

export class Tank extends Enemy {
    /** 2-frame passes until the next shell ($BE64) */
    shootTimer: number;
    target: any; // Will be a Player object
    /** frames of materializing left; then a pass every 2 frames */
    materialize = 48;
    passTimer = 0;
    /** passes until it picks a new heading */
    retarget = 0;
    stepX = 0;
    stepY = 0;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, shotPasses: number) {
        super(sprite, 'tank', 4, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.shootTimer = shotPasses;
        this.target = null;
    }
}

export class Quark extends Enemy {
    /** tanks still to drop: ceil(prng_le($BE5E) / 2) */
    dropsLeft: number;
    /** frames until the next drop-timer expiry */
    dropTimer: number;
    dropping = false;
    /** all dropped: flying off the top or bottom */
    leaving = false;
    /** frames until the velocity is re-rolled */
    moveTimer = 0;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, drops: number, firstDrop: number) {
        super(sprite, 'quark', 2, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.dropsLeft = drops;
        this.dropTimer = firstDrop;
    }
}

export class ProgEnemy extends Enemy {
    lastAngle: number;
    turnTimer: number;
    turnDelay: number;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number) {
        super(sprite, 'prog_enemy', 1, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.lastAngle = Math.random() * Math.PI * 2;
        this.turnTimer = 0;
        this.turnDelay = 60 + Math.random() * 60;
    }
}
