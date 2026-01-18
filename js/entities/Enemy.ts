/**
 * Enemy - Base enemy class and specific enemy implementations using GameObject architecture
 * 
 * This module provides the base Enemy class and specific enemy types that use the new 
 * GameObject component system for improved modularity and maintainability.
 */

import * as PIXI from 'pixi.js';
import { GameObject, Component, SpriteRenderer, Collider, Rigidbody } from '../core/GameObject';
import { Vector2 } from '../utils/Vector2';
import { Constants } from '../utils/Constants';
import { gameEvents } from '../core/EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../core/ErrorHandler';

/**
 * Base enemy AI component interface
 */
export interface EnemyAI extends Component {
    target: GameObject | null;
    aggroRange: number;
    attackRange: number;
    
    findTarget(): GameObject | null;
    moveTowardsTarget(deltaTime: number): void;
    attack(): void;
}

/**
 * Enemy health component for managing health and damage
 */
export class EnemyHealth implements Component {
    name: string = 'enemyHealth';
    gameObject: GameObject;
    enabled: boolean = true;
    
    maxHealth: number;
    currentHealth: number;
    points: number;
    isIndestructible: boolean;
    
    constructor(gameObject: GameObject, maxHealth: number, points: number, isIndestructible: boolean = false) {
        this.gameObject = gameObject;
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.points = points;
        this.isIndestructible = isIndestructible;
    }
    
    /**
     * Take damage
     */
    takeDamage(amount: number): boolean {
        if (this.isIndestructible) return false;
        
        this.currentHealth -= amount;
        
        // Emit damage event
        gameEvents.emit({
            type: 'enemy:damaged',
            timestamp: Date.now(),
            source: 'EnemyHealth',
            data: {
                enemyId: this.gameObject.id,
                enemyType: this.gameObject.name,
                damage: amount,
                currentHealth: this.currentHealth,
                maxHealth: this.maxHealth
            }
        });
        
        if (this.currentHealth <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }
    
    /**
     * Enemy death
     */
    private die(): void {
        // Emit death event
        gameEvents.emit({
            type: 'enemy:died',
            timestamp: Date.now(),
            source: 'EnemyHealth',
            data: {
                enemyId: this.gameObject.id,
                enemyType: this.gameObject.name,
                points: this.points,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        // Destroy the game object
        this.gameObject.destroy();
    }
    
    /**
     * Heal the enemy
     */
    heal(amount: number): void {
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
    }
    
    /**
     * Get health percentage
     */
    getHealthPercentage(): number {
        return this.currentHealth / this.maxHealth;
    }
    
    /**
     * Handle collision with projectiles
     */
    onCollisionEnter(other: GameObject): void {
        if (other.tag === 'playerProjectile') {
            this.takeDamage(1);
        }
    }
}

/**
 * Enemy movement component for basic movement patterns
 */
export class EnemyMovement implements Component {
    name: string = 'enemyMovement';
    gameObject: GameObject;
    enabled: boolean = true;
    
    speed: number;
    movementPattern: 'chase' | 'wander' | 'patrol' | 'static';
    target: GameObject | null = null;
    
    // Wander behavior
    wanderDirection: Vector2;
    wanderTimer: number = 0;
    wanderChangeInterval: number = 2000; // milliseconds
    
    // Patrol behavior
    patrolPoints: Vector2[] = [];
    currentPatrolIndex: number = 0;
    
    constructor(gameObject: GameObject, speed: number, pattern: 'chase' | 'wander' | 'patrol' | 'static' = 'chase') {
        this.gameObject = gameObject;
        this.speed = speed;
        this.movementPattern = pattern;
        this.wanderDirection = Vector2.random().normalize();
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        switch (this.movementPattern) {
            case 'chase':
                this.chaseMovement(deltaTime);
                break;
            case 'wander':
                this.wanderMovement(deltaTime);
                break;
            case 'patrol':
                this.patrolMovement(deltaTime);
                break;
            case 'static':
                // No movement
                break;
        }
        
        this.keepInBounds();
    }
    
    /**
     * Chase movement towards target
     */
    private chaseMovement(deltaTime: number): void {
        if (!this.target) {
            this.findTarget();
            return;
        }
        
        const direction = new Vector2(
            this.target.transform.position.x - this.gameObject.transform.position.x,
            this.target.transform.position.y - this.gameObject.transform.position.y
        );
        
        if (direction.magnitude() > 0) {
            direction.normalize();
            
            const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
            if (rigidbody) {
                rigidbody.setVelocity(
                    direction.x * this.speed,
                    direction.y * this.speed
                );
            }
        }
    }
    
    /**
     * Wander movement pattern
     */
    private wanderMovement(deltaTime: number): void {
        this.wanderTimer += deltaTime;
        
        if (this.wanderTimer >= this.wanderChangeInterval) {
            this.wanderDirection = Vector2.random().normalize();
            this.wanderTimer = 0;
        }
        
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        if (rigidbody) {
            rigidbody.setVelocity(
                this.wanderDirection.x * this.speed,
                this.wanderDirection.y * this.speed
            );
        }
    }
    
    /**
     * Patrol movement pattern
     */
    private patrolMovement(deltaTime: number): void {
        if (this.patrolPoints.length === 0) return;
        
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        const direction = new Vector2(
            targetPoint.x - this.gameObject.transform.position.x,
            targetPoint.y - this.gameObject.transform.position.y
        );
        
        if (direction.magnitude() < 10) {
            // Reached patrol point, move to next
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        } else {
            direction.normalize();
            
            const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
            if (rigidbody) {
                rigidbody.setVelocity(
                    direction.x * this.speed,
                    direction.y * this.speed
                );
            }
        }
    }
    
    /**
     * Find a target (usually the player)
     */
    private findTarget(): void {
        // This would typically find the player or nearest target
        // For now, we'll emit an event to request a target
        gameEvents.emit({
            type: 'enemy:request_target',
            timestamp: Date.now(),
            source: 'EnemyMovement',
            data: {
                enemyId: this.gameObject.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
    }
    
    /**
     * Set the target to chase
     */
    setTarget(target: GameObject): void {
        this.target = target;
    }
    
    /**
     * Set patrol points
     */
    setPatrolPoints(points: Vector2[]): void {
        this.patrolPoints = points;
        this.currentPatrolIndex = 0;
    }
    
    /**
     * Keep enemy within game bounds
     */
    private keepInBounds(): void {
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        const padding = 10;
        
        const transform = this.gameObject.transform;
        const newX = Math.max(padding, Math.min(bounds.WIDTH - padding, transform.position.x));
        const newY = Math.max(padding, Math.min(bounds.HEIGHT - padding, transform.position.y));
        
        if (newX !== transform.position.x || newY !== transform.position.y) {
            transform.setPosition(newX, newY);
            
            // If we hit a boundary while wandering, change direction
            if (this.movementPattern === 'wander') {
                this.wanderDirection = Vector2.random().normalize();
                this.wanderTimer = 0;
            }
        }
    }
}

/**
 * Enemy shooting component for enemies that can shoot
 */
export class EnemyShooting implements Component {
    name: string = 'enemyShooting';
    gameObject: GameObject;
    enabled: boolean = true;
    
    shootRate: number;
    lastShootTime: number = 0;
    range: number;
    target: GameObject | null = null;
    
    constructor(gameObject: GameObject, shootRate: number, range: number = 200) {
        this.gameObject = gameObject;
        this.shootRate = shootRate;
        this.range = range;
    }
    
    update(): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        if (!this.target) {
            this.findTarget();
            return;
        }
        
        const currentTime = Date.now();
        if (currentTime - this.lastShootTime < this.shootRate) return;
        
        const distance = this.gameObject.transform.position.distanceTo(this.target.transform.position);
        if (distance <= this.range) {
            this.shoot();
            this.lastShootTime = currentTime;
        }
    }
    
    /**
     * Shoot at the target
     */
    private shoot(): void {
        if (!this.target) return;
        
        const direction = new Vector2(
            this.target.transform.position.x - this.gameObject.transform.position.x,
            this.target.transform.position.y - this.gameObject.transform.position.y
        );
        
        if (direction.magnitude() > 0) {
            direction.normalize();
            
            // Emit shooting event
            gameEvents.emit({
                type: 'enemy:shoot',
                timestamp: Date.now(),
                source: 'EnemyShooting',
                data: {
                    enemyId: this.gameObject.id,
                    position: {
                        x: this.gameObject.transform.position.x,
                        y: this.gameObject.transform.position.y
                    },
                    direction: {
                        x: direction.x,
                        y: direction.y
                    }
                }
            });
        }
    }
    
    /**
     * Find a target to shoot at
     */
    private findTarget(): void {
        // This would typically find the player
        gameEvents.emit({
            type: 'enemy:request_target',
            timestamp: Date.now(),
            source: 'EnemyShooting',
            data: {
                enemyId: this.gameObject.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
    }
    
    /**
     * Set the target to shoot at
     */
    setTarget(target: GameObject): void {
        this.target = target;
    }
}

/**
 * Base Enemy factory for creating enemy game objects
 */
export class EnemyFactory {
    /**
     * Create a basic enemy
     */
    static createEnemy(
        name: string,
        texture: PIXI.Texture,
        x: number,
        y: number,
        health: number,
        points: number,
        speed: number,
        movementPattern: 'chase' | 'wander' | 'patrol' | 'static' = 'chase',
        isIndestructible: boolean = false
    ): GameObject {
        // Create the base game object
        const enemy = new GameObject(name);
        enemy.tag = 'enemy';
        enemy.layer = 2;
        
        // Set initial position
        enemy.transform.setPosition(x, y);
        
        // Add sprite renderer
        const spriteRenderer = new SpriteRenderer(enemy, texture);
        enemy.addComponent(spriteRenderer);
        
        // Add collider
        const collider = new Collider(enemy, 16, 16); // Default size, can be adjusted
        enemy.addComponent(collider);
        
        // Add rigidbody for physics
        const rigidbody = new Rigidbody(enemy);
        rigidbody.drag = 0.9; // Some drag for smooth movement
        enemy.addComponent(rigidbody);
        
        // Add enemy-specific components
        const enemyHealth = new EnemyHealth(enemy, health, points, isIndestructible);
        enemy.addComponent(enemyHealth);
        
        const enemyMovement = new EnemyMovement(enemy, speed, movementPattern);
        enemy.addComponent(enemyMovement);
        
        return enemy;
    }
    
    /**
     * Create a shooting enemy
     */
    static createShootingEnemy(
        name: string,
        texture: PIXI.Texture,
        x: number,
        y: number,
        health: number,
        points: number,
        speed: number,
        shootRate: number,
        shootRange: number = 200,
        movementPattern: 'chase' | 'wander' | 'patrol' | 'static' = 'chase'
    ): GameObject {
        const enemy = this.createEnemy(name, texture, x, y, health, points, speed, movementPattern);
        
        // Add shooting component
        const enemyShooting = new EnemyShooting(enemy, shootRate, shootRange);
        enemy.addComponent(enemyShooting);
        
        return enemy;
    }
}

/**
 * Specific enemy type factories
 */
export class GruntFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const grunt = EnemyFactory.createEnemy(
            'Grunt',
            texture,
            x, y,
            1, // health
            100, // points
            100, // speed
            'chase' // movement pattern
        );
        
        grunt.tag = 'grunt';
        return grunt;
    }
}

export class HulkFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const hulk = EnemyFactory.createEnemy(
            'Hulk',
            texture,
            x, y,
            Infinity, // health (indestructible)
            300, // points
            80, // speed
            'chase', // movement pattern
            true // indestructible
        );
        
        hulk.tag = 'hulk';
        
        // Hulks are larger
        const collider = hulk.getComponent<Collider>('collider');
        if (collider) {
            collider.setSize(24, 24);
        }
        
        return hulk;
    }
}

export class SpheroidFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const spheroid = EnemyFactory.createEnemy(
            'Spheroid',
            texture,
            x, y,
            2, // health
            1000, // points
            60, // speed
            'wander' // movement pattern
        );
        
        spheroid.tag = 'spheroid';
        
        // Add spawning behavior (this would be a custom component)
        // For now, we'll just mark it as a spawner
        spheroid.name = 'Spheroid_Spawner';
        
        return spheroid;
    }
}

export class EnforcerFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const enforcer = EnemyFactory.createShootingEnemy(
            'Enforcer',
            texture,
            x, y,
            2, // health
            150, // points
            120, // speed
            800, // shoot rate (ms)
            250 // shoot range
        );
        
        enforcer.tag = 'enforcer';
        return enforcer;
    }
}

export class BrainFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const brain = EnemyFactory.createShootingEnemy(
            'Brain',
            texture,
            x, y,
            3, // health
            500, // points
            40, // speed
            1200, // shoot rate (ms)
            300 // shoot range
        );
        
        brain.tag = 'brain';
        
        // Brains have special reprogramming abilities
        brain.name = 'Brain_Reprogrammer';
        
        return brain;
    }
}

export class TankFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const tank = EnemyFactory.createShootingEnemy(
            'Tank',
            texture,
            x, y,
            4, // health
            200, // points
            30, // speed (slow but tough)
            600, // shoot rate (ms)
            400 // shoot range (long range)
        );
        
        tank.tag = 'tank';
        
        // Tanks are larger and tougher
        const collider = tank.getComponent<Collider>('collider');
        if (collider) {
            collider.setSize(20, 20);
        }
        
        return tank;
    }
}

export class QuarkFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const quark = EnemyFactory.createEnemy(
            'Quark',
            texture,
            x, y,
            2, // health
            1000, // points
            90, // speed
            'wander' // movement pattern
        );
        
        quark.tag = 'quark';
        
        // Add spawning behavior for sub-quarks
        quark.name = 'Quark_Spawner';
        
        return quark;
    }
}

export class SubQuarkFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const subQuark = EnemyFactory.createEnemy(
            'SubQuark',
            texture,
            x, y,
            1, // health
            100, // points
            150, // speed (fast)
            'chase' // movement pattern
        );
        
        subQuark.tag = 'subQuark';
        
        // Sub-quarks are smaller
        const collider = subQuark.getComponent<Collider>('collider');
        if (collider) {
            collider.setSize(12, 12);
        }
        
        return subQuark;
    }
}

export class ProgEnemyFactory {
    static create(texture: PIXI.Texture, x: number, y: number): GameObject {
        const prog = EnemyFactory.createEnemy(
            'ProgEnemy',
            texture,
            x, y,
            1, // health
            25, // points (converted humans are worth less)
            80, // speed
            'chase' // movement pattern
        );
        
        prog.tag = 'progEnemy';
        return prog;
    }
}