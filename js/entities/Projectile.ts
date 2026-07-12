/**
 * Projectile - Projectile system using GameObject architecture with object pooling
 * 
 * This module provides a projectile system that uses the new GameObject component system
 * with object pooling for improved performance and memory management.
 */

import * as PIXI from 'pixi.js';
import { GameObject, Component, SpriteRenderer, Collider, Rigidbody } from '../core/GameObject';
import { Vector2 } from '../utils/Vector2';
import { Constants } from '../utils/Constants';
import { gameEvents } from '../core/EventSystem';
import { ObjectPool } from '../utils/ObjectPool';

/**
 * Projectile controller component for projectile-specific behavior
 */
export class ProjectileController implements Component {
    name: string = 'projectileController';
    gameObject: GameObject;
    enabled: boolean = true;
    
    // Projectile properties
    damage: number;
    lifetime: number;
    maxLifetime: number;
    bounces: number;
    maxBounces: number;
    owner: string; // 'player' or 'enemy'
    
    constructor(gameObject: GameObject, damage: number = 1, lifetime: number = 3000, bounces: number = 0) {
        this.gameObject = gameObject;
        this.damage = damage;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.bounces = bounces;
        this.maxBounces = bounces;
        this.owner = 'player';
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        // Update lifetime
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.destroyProjectile();
            return;
        }
        
        // Check bounds and handle bouncing
        this.handleBounds();
    }
    
    /**
     * Handle projectile bounds and bouncing
     */
    private handleBounds(): void {
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        const transform = this.gameObject.transform;
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        
        if (!rigidbody) return;
        
        let bounced = false;
        
        // Check horizontal bounds
        if (transform.position.x <= 0 || transform.position.x >= bounds.WIDTH) {
            if (this.bounces > 0) {
                rigidbody.velocity.x *= -1;
                this.bounces--;
                bounced = true;
                
                // Keep within bounds
                transform.position.x = Math.max(1, Math.min(bounds.WIDTH - 1, transform.position.x));
            } else {
                this.destroyProjectile();
                return;
            }
        }
        
        // Check vertical bounds
        if (transform.position.y <= 0 || transform.position.y >= bounds.HEIGHT) {
            if (this.bounces > 0) {
                rigidbody.velocity.y *= -1;
                this.bounces--;
                bounced = true;
                
                // Keep within bounds
                transform.position.y = Math.max(1, Math.min(bounds.HEIGHT - 1, transform.position.y));
            } else {
                this.destroyProjectile();
                return;
            }
        }
        
        // Emit bounce event
        if (bounced) {
            gameEvents.emit({
                type: 'projectile:bounced',
                timestamp: Date.now(),
                source: 'ProjectileController',
                data: {
                    projectileId: this.gameObject.id,
                    position: {
                        x: transform.position.x,
                        y: transform.position.y
                    },
                    bouncesLeft: this.bounces
                }
            });
        }
    }
    
    /**
     * Handle collision with other objects
     */
    onCollisionEnter(other: GameObject): void {
        if (!this.enabled) return;
        
        // Don't collide with owner type
        if ((this.owner === 'player' && other.tag === 'player') ||
            (this.owner === 'enemy' && other.tag.includes('enemy'))) {
            return;
        }
        
        // Handle collision based on what we hit
        switch (other.tag) {
            case 'player':
                if (this.owner === 'enemy') {
                    this.hitTarget(other);
                }
                break;
            case 'enemy':
            case 'grunt':
            case 'hulk':
            case 'spheroid':
            case 'enforcer':
            case 'brain':
            case 'tank':
            case 'quark':
            case 'subQuark':
            case 'progEnemy':
                if (this.owner === 'player') {
                    this.hitTarget(other);
                }
                break;
            case 'wall':
            case 'obstacle':
                this.hitObstacle(other);
                break;
        }
    }
    
    /**
     * Handle hitting a target
     */
    private hitTarget(target: GameObject): void {
        // Emit hit event
        gameEvents.emit({
            type: 'projectile:hit_target',
            timestamp: Date.now(),
            source: 'ProjectileController',
            data: {
                projectileId: this.gameObject.id,
                targetId: target.id,
                damage: this.damage,
                owner: this.owner,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        this.destroyProjectile();
    }
    
    /**
     * Handle hitting an obstacle
     */
    private hitObstacle(obstacle: GameObject): void {
        // Emit obstacle hit event
        gameEvents.emit({
            type: 'projectile:hit_obstacle',
            timestamp: Date.now(),
            source: 'ProjectileController',
            data: {
                projectileId: this.gameObject.id,
                obstacleId: obstacle.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        this.destroyProjectile();
    }
    
    /**
     * Destroy the projectile
     */
    private destroyProjectile(): void {
        // Emit destroy event
        gameEvents.emit({
            type: 'projectile:destroyed',
            timestamp: Date.now(),
            source: 'ProjectileController',
            data: {
                projectileId: this.gameObject.id,
                owner: this.owner
            }
        });
        
        // Return to pool instead of destroying
        ProjectilePool.release(this.gameObject);
    }
    
    /**
     * Reset projectile for reuse
     */
    reset(): void {
        this.lifetime = this.maxLifetime;
        this.bounces = this.maxBounces;
        this.enabled = true;
    }
    
    /**
     * Set projectile properties
     */
    setProperties(damage: number, lifetime: number, bounces: number, owner: string): void {
        this.damage = damage;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.bounces = bounces;
        this.maxBounces = bounces;
        this.owner = owner;
    }
}

/**
 * Projectile factory for creating different types of projectiles
 */
export class ProjectileFactory {
    /**
     * Create a basic projectile
     */
    static createProjectile(
        texture: PIXI.Texture,
        x: number,
        y: number,
        direction: Vector2,
        speed: number,
        damage: number = 1,
        lifetime: number = 3000,
        bounces: number = 0,
        owner: string = 'player'
    ): GameObject {
        // Create the base game object
        const projectile = new GameObject('Projectile');
        projectile.tag = owner === 'player' ? 'playerProjectile' : 'enemyProjectile';
        projectile.layer = 3;
        
        // Set initial position
        projectile.transform.setPosition(x, y);
        
        // Add sprite renderer
        const spriteRenderer = new SpriteRenderer(projectile, texture);
        projectile.addComponent(spriteRenderer);
        
        // Add collider
        const collider = new Collider(projectile, 4, 4, true); // Small trigger collider
        projectile.addComponent(collider);
        
        // Add rigidbody for physics
        const rigidbody = new Rigidbody(projectile);
        rigidbody.drag = 0; // No drag for projectiles
        rigidbody.setVelocity(direction.x * speed, direction.y * speed);
        projectile.addComponent(rigidbody);
        
        // Add projectile controller
        const projectileController = new ProjectileController(projectile, damage, lifetime, bounces);
        projectileController.owner = owner;
        projectile.addComponent(projectileController);
        
        return projectile;
    }
    
    /**
     * Create a player projectile
     */
    static createPlayerProjectile(x: number, y: number, direction: Vector2): GameObject {
        // Create a simple yellow rectangle texture
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xFFFF00);
        graphics.drawRect(-1, -2, 2, 4);
        graphics.endFill();
        const texture = PIXI.RenderTexture.create({ width: 4, height: 8 });
        
        return this.createProjectile(
            texture,
            x, y,
            direction,
            Constants.PROJECTILE_CONSTANTS?.PLAYER_SPEED || 400,
            1, // damage
            3000, // lifetime
            0, // bounces
            'player'
        );
    }
    
    /**
     * Create an enforcer projectile
     */
    static createEnforcerProjectile(x: number, y: number, direction: Vector2): GameObject {
        // Create a cyan diamond texture
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x00FFFF);
        graphics.moveTo(0, -3);
        graphics.lineTo(2, 0);
        graphics.lineTo(0, 3);
        graphics.lineTo(-2, 0);
        graphics.closePath();
        graphics.endFill();
        const texture = PIXI.RenderTexture.create({ width: 6, height: 8 });
        
        return this.createProjectile(
            texture,
            x, y,
            direction,
            Constants.PROJECTILE_CONSTANTS?.ENFORCER_SPEED || 300,
            1, // damage
            4000, // lifetime
            0, // bounces
            'enemy'
        );
    }
    
    /**
     * Create a brain projectile
     */
    static createBrainProjectile(x: number, y: number, direction: Vector2): GameObject {
        // Create a pink circle texture
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xFF88FF);
        graphics.drawCircle(0, 0, 3);
        graphics.endFill();
        const texture = PIXI.RenderTexture.create({ width: 8, height: 8 });
        
        return this.createProjectile(
            texture,
            x, y,
            direction,
            Constants.PROJECTILE_CONSTANTS?.BRAIN_SPEED || 250,
            1, // damage
            5000, // lifetime
            0, // bounces
            'enemy'
        );
    }
    
    /**
     * Create a tank shell
     */
    static createTankShell(x: number, y: number, direction: Vector2): GameObject {
        // Create a gray circle texture
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x888888);
        graphics.drawCircle(0, 0, 4);
        graphics.endFill();
        const texture = PIXI.RenderTexture.create({ width: 10, height: 10 });
        
        return this.createProjectile(
            texture,
            x, y,
            direction,
            Constants.PROJECTILE_CONSTANTS?.TANK_SHELL_SPEED || 200,
            2, // damage
            8000, // lifetime
            Constants.PROJECTILE_CONSTANTS?.TANK_SHELL_BOUNCES || 3, // bounces
            'enemy'
        );
    }
}

/**
 * Object pool for projectiles to improve performance
 */
class ProjectileObjectPool {
    private playerProjectilePool: ObjectPool<GameObject>;
    private enemyProjectilePool: ObjectPool<GameObject>;
    
    constructor() {
        // Create pools with initial capacity
        this.playerProjectilePool = new ObjectPool<GameObject>(
            () => this.createPooledPlayerProjectile(),
            50, // initial capacity
            200, // max capacity
            10 // expansion size
        );
        
        this.enemyProjectilePool = new ObjectPool<GameObject>(
            () => this.createPooledEnemyProjectile(),
            30, // initial capacity
            150, // max capacity
            10 // expansion size
        );
    }
    
    /**
     * Get a player projectile from the pool
     */
    getPlayerProjectile(x: number, y: number, direction: Vector2): GameObject {
        const projectile = this.playerProjectilePool.acquire();
        
        // Set position and velocity
        projectile.transform.setPosition(x, y);
        const rigidbody = projectile.getComponent<Rigidbody>('rigidbody');
        if (rigidbody) {
            const speed = Constants.PROJECTILE_CONSTANTS?.PLAYER_SPEED || 400;
            rigidbody.setVelocity(direction.x * speed, direction.y * speed);
        }
        
        // Reset controller
        const controller = projectile.getComponent<ProjectileController>('projectileController');
        if (controller) {
            controller.reset();
        }
        
        projectile.setActive(true);
        return projectile;
    }
    
    /**
     * Get an enemy projectile from the pool
     */
    getEnemyProjectile(
        x: number,
        y: number,
        direction: Vector2,
        type: 'enforcer' | 'brain' | 'tank' = 'enforcer'
    ): GameObject {
        const projectile = this.enemyProjectilePool.acquire();
        
        // Set position and velocity
        projectile.transform.setPosition(x, y);
        const rigidbody = projectile.getComponent<Rigidbody>('rigidbody');
        const controller = projectile.getComponent<ProjectileController>('projectileController');
        
        if (rigidbody && controller) {
            let speed: number;
            let damage: number;
            let lifetime: number;
            let bounces: number;
            
            switch (type) {
                case 'brain':
                    speed = Constants.PROJECTILE_CONSTANTS?.BRAIN_SPEED || 250;
                    damage = 1;
                    lifetime = 5000;
                    bounces = 0;
                    break;
                case 'tank':
                    speed = Constants.PROJECTILE_CONSTANTS?.TANK_SHELL_SPEED || 200;
                    damage = 2;
                    lifetime = 8000;
                    bounces = Constants.PROJECTILE_CONSTANTS?.TANK_SHELL_BOUNCES || 3;
                    break;
                default: // enforcer
                    speed = Constants.PROJECTILE_CONSTANTS?.ENFORCER_SPEED || 300;
                    damage = 1;
                    lifetime = 4000;
                    bounces = 0;
                    break;
            }
            
            rigidbody.setVelocity(direction.x * speed, direction.y * speed);
            controller.setProperties(damage, lifetime, bounces, 'enemy');
            controller.reset();
        }
        
        projectile.setActive(true);
        return projectile;
    }
    
    /**
     * Release a projectile back to the pool
     */
    release(projectile: GameObject): void {
        projectile.setActive(false);
        
        const controller = projectile.getComponent<ProjectileController>('projectileController');
        if (controller && controller.owner === 'player') {
            this.playerProjectilePool.release(projectile);
        } else {
            this.enemyProjectilePool.release(projectile);
        }
    }
    
    /**
     * Create a pooled player projectile
     */
    private createPooledPlayerProjectile(): GameObject {
        return ProjectileFactory.createPlayerProjectile(0, 0, new Vector2(1, 0));
    }
    
    /**
     * Create a pooled enemy projectile
     */
    private createPooledEnemyProjectile(): GameObject {
        return ProjectileFactory.createEnforcerProjectile(0, 0, new Vector2(1, 0));
    }
    
    /**
     * Get pool statistics
     */
    getStats(): { playerPool: any; enemyPool: any } {
        return {
            playerPool: this.playerProjectilePool.getStats(),
            enemyPool: this.enemyProjectilePool.getStats()
        };
    }
}

/**
 * Global projectile pool instance
 */
export const ProjectilePool = new ProjectileObjectPool();

/**
 * Projectile manager for handling projectile lifecycle
 */
export class ProjectileManager {
    private activeProjectiles: Set<GameObject> = new Set();
    
    /**
     * Create a player projectile
     */
    createPlayerProjectile(x: number, y: number, direction: Vector2): GameObject {
        const projectile = ProjectilePool.getPlayerProjectile(x, y, direction);
        this.activeProjectiles.add(projectile);
        
        // Emit creation event
        gameEvents.emit({
            type: 'projectile:created',
            timestamp: Date.now(),
            source: 'ProjectileManager',
            data: {
                projectileId: projectile.id,
                owner: 'player',
                position: { x, y },
                direction: { x: direction.x, y: direction.y }
            }
        });
        
        return projectile;
    }
    
    /**
     * Create an enemy projectile
     */
    createEnemyProjectile(
        x: number,
        y: number,
        direction: Vector2,
        type: 'enforcer' | 'brain' | 'tank' = 'enforcer'
    ): GameObject {
        const projectile = ProjectilePool.getEnemyProjectile(x, y, direction, type);
        this.activeProjectiles.add(projectile);
        
        // Emit creation event
        gameEvents.emit({
            type: 'projectile:created',
            timestamp: Date.now(),
            source: 'ProjectileManager',
            data: {
                projectileId: projectile.id,
                owner: 'enemy',
                type: type,
                position: { x, y },
                direction: { x: direction.x, y: direction.y }
            }
        });
        
        return projectile;
    }
    
    /**
     * Update all active projectiles
     */
    update(deltaTime: number): void {
        for (const projectile of this.activeProjectiles) {
            if (!projectile.active) {
                this.activeProjectiles.delete(projectile);
                continue;
            }
            
            projectile.update(deltaTime);
        }
    }
    
    /**
     * Get the number of active projectiles
     */
    getActiveProjectileCount(): number {
        return this.activeProjectiles.size;
    }
    
    /**
     * Get pool statistics
     */
    getPoolStats(): any {
        return ProjectilePool.getStats();
    }
    
    /**
     * Clear all projectiles
     */
    clearAll(): void {
        for (const projectile of this.activeProjectiles) {
            ProjectilePool.release(projectile);
        }
        this.activeProjectiles.clear();
    }
}

/**
 * Global projectile manager instance
 */
export const projectileManager = new ProjectileManager();

/**
 * Legacy compatibility functions
 */
export const LegacyProjectiles = {
    createPlayerProjectile: (x: number, y: number, dx: number, dy: number) => {
        const direction = new Vector2(dx, dy).normalize();
        return projectileManager.createPlayerProjectile(x, y, direction);
    },
    
    createEnforcerProjectile: (x: number, y: number, targetX: number, targetY: number) => {
        const direction = new Vector2(targetX - x, targetY - y).normalize();
        return projectileManager.createEnemyProjectile(x, y, direction, 'enforcer');
    },
    
    createBrainProjectile: (x: number, y: number, targetX: number, targetY: number) => {
        const direction = new Vector2(targetX - x, targetY - y).normalize();
        return projectileManager.createEnemyProjectile(x, y, direction, 'brain');
    },
    
    createTankShell: (x: number, y: number, targetX: number, targetY: number) => {
        const direction = new Vector2(targetX - x, targetY - y).normalize();
        return projectileManager.createEnemyProjectile(x, y, direction, 'tank');
    }
};