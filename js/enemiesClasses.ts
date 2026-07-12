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
    spawnEnforcerTimer: number;
    enforcersSpawned: number;
    maxEnforcersToSpawn: number;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, spawnDelay: number, maxSpawns: number) {
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
        this.spawnEnforcerTimer = spawnDelay;
        this.enforcersSpawned = 0;
        this.maxEnforcersToSpawn = maxSpawns;
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

    constructor(sprite: PIXI.Container, x: number, y: number, speed: number, points: number, shootDelay: number, reprogramDuration: number) {
        super(sprite, 'brain', 3, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.shootTimer = shootDelay / 2 + Math.random() * shootDelay / 2;
        this.reprogramTarget = null;
        this.reprogramTimer = reprogramDuration;
        this.reprogramProgress = 0;
    }
}

export class Tank extends Enemy {
    shootTimer: number;
    target: any; // Will be a Player object

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, shootDelay: number) {
        super(sprite, 'tank', 4, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.shootTimer = shootDelay / 2 + Math.random() * shootDelay / 2;
        this.target = null;
    }
}

export class Quark extends Enemy {
    spawnSubQuarkTimer: number;
    subQuarksSpawned: number;
    maxSubQuarksToSpawn: number;

    constructor(sprite: PIXI.Sprite | PIXI.Graphics, x: number, y: number, speed: number, points: number, spawnDelay: number, maxSpawns: number) {
        super(sprite, 'quark', 2, points, speed);
        this.sprite.x = x;
        this.sprite.y = y;
        // IMPORTANT: Update position tracking after setting sprite position
        this.position.x = x;
        this.position.y = y;
        this.previousPosition.x = x;
        this.previousPosition.y = y;
        this.spawnSubQuarkTimer = spawnDelay;
        this.subQuarksSpawned = 0;
        this.maxSubQuarksToSpawn = maxSpawns;
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
