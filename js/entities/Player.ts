/**
 * Player - Player entity implementation using GameObject architecture
 * 
 * This module provides the Player class that uses the new GameObject component system
 * and implements player-specific behavior including movement, shooting, and input handling.
 */

import * as PIXI from 'pixi.js';
import { GameObject, Component, SpriteRenderer, Collider, Rigidbody } from '../core/GameObject';
import { Vector2 } from '../utils/Vector2';
import { Constants } from '../utils/Constants';
import { gameEvents } from '../core/EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../core/ErrorHandler';
import { UnifiedInputManager } from '../core/InputManager';

/**
 * Player input component for handling keyboard and gamepad input
 */
export class PlayerInput implements Component {
    name: string = 'playerInput';
    gameObject: GameObject;
    enabled: boolean = true;

    // Movement
    moveDirection: Vector2 = new Vector2(0, 0);
    shootDirection: Vector2 = new Vector2(0, 0);
    isMoving: boolean = false;
    isShooting: boolean = false;

    private inputManager: UnifiedInputManager;

    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.inputManager = UnifiedInputManager.getInstance();
    }

    update(): void {
        if (!this.enabled || !this.gameObject.active) return;

        // Update input manager state (older manager builds exposed update();
        // call it only when present so the type doesn't lie about the API)
        (this.inputManager as { update?: () => void }).update?.();

        // Get input from the unified input manager
        this.moveDirection = this.inputManager.getMovementVector();
        this.shootDirection = this.inputManager.getShootingVector();

        this.isMoving = this.moveDirection.magnitude() > 0;
        this.isShooting = this.shootDirection.magnitude() > 0;
    }
    
    
    /**
     * Get normalized move direction
     */
    getNormalizedMoveDirection(): Vector2 {
        if (!this.isMoving) return new Vector2(0, 0);
        
        const normalized = new Vector2(this.moveDirection.x, this.moveDirection.y);
        if (normalized.magnitude() > 1) {
            normalized.normalize();
        }
        return normalized;
    }
    
    /**
     * Get normalized shoot direction
     */
    getNormalizedShootDirection(): Vector2 {
        if (!this.isShooting) return new Vector2(0, 0);
        
        const normalized = new Vector2(this.shootDirection.x, this.shootDirection.y);
        if (normalized.magnitude() > 0) {
            normalized.normalize();
        }
        return normalized;
    }
    
}

/**
 * Player controller component for player-specific behavior
 */
export class PlayerController implements Component {
    name: string = 'playerController';
    gameObject: GameObject;
    enabled: boolean = true;
    
    // Player state
    health: number;
    lives: number;
    isInvulnerable: boolean = false;
    invulnerabilityTime: number = 0;
    score: number = 0;
    
    // Shooting
    shootCooldown: number = 0;
    shootRate: number;
    lastShootTime: number = 0;
    
    // Movement
    speed: number;
    
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.health = 1; // One-hit death in Robotron
        this.lives = Constants.PLAYER_CONSTANTS?.INITIAL_LIVES || 3;
        this.shootRate = Constants.PLAYER_CONSTANTS?.SHOOT_RATE || 150; // milliseconds
        this.speed = Constants.PLAYER_CONSTANTS?.SPEED || 200;
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        // Update invulnerability
        if (this.isInvulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.setInvulnerable(false);
            }
        }
        
        // Handle movement
        this.handleMovement(deltaTime);
        
        // Handle shooting
        this.handleShooting();
        
        // Keep player within bounds
        this.keepInBounds();
    }
    
    /**
     * Handle player movement
     */
    handleMovement(_deltaTime: number): void {
        const input = this.gameObject.getComponent<PlayerInput>('playerInput');
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        
        if (!input || !rigidbody) return;
        
        const moveDir = input.getNormalizedMoveDirection();
        if (moveDir.magnitude() > 0) {
            rigidbody.setVelocity(
                moveDir.x * this.speed,
                moveDir.y * this.speed
            );
        } else {
            rigidbody.setVelocity(0, 0);
        }
    }
    
    /**
     * Handle player shooting
     */
    handleShooting(): void {
        const input = this.gameObject.getComponent<PlayerInput>('playerInput');
        if (!input || !input.isShooting) return;
        
        const currentTime = Date.now();
        if (currentTime - this.lastShootTime < this.shootRate) return;
        
        const shootDir = input.getNormalizedShootDirection();
        if (shootDir.magnitude() > 0) {
            this.shoot(shootDir);
            this.lastShootTime = currentTime;
        }
    }
    
    /**
     * Shoot a projectile
     */
    shoot(direction: Vector2): void {
        try {
            // Emit shooting event for the projectile system to handle
            gameEvents.emit({
                type: 'player:shoot',
                timestamp: Date.now(),
                source: 'PlayerController',
                data: {
                    position: {
                        x: this.gameObject.transform.position.x,
                        y: this.gameObject.transform.position.y
                    },
                    direction: {
                        x: direction.x,
                        y: direction.y
                    },
                    playerId: this.gameObject.id
                }
            });
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.GAME_LOGIC,
                ErrorSeverity.LOW,
                { gameObject: this.gameObject.name },
                'PlayerController.shoot'
            );
        }
    }
    
    /**
     * Keep player within game bounds
     */
    keepInBounds(): void {
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        const padding = 10;
        
        const transform = this.gameObject.transform;
        const newX = Math.max(padding, Math.min(bounds.WIDTH - padding, transform.position.x));
        const newY = Math.max(padding, Math.min(bounds.HEIGHT - padding, transform.position.y));
        
        if (newX !== transform.position.x || newY !== transform.position.y) {
            transform.setPosition(newX, newY);
        }
    }
    
    /**
     * Take damage
     */
    takeDamage(amount: number = 1): void {
        if (this.isInvulnerable) return;
        
        this.health -= amount;
        
        if (this.health <= 0) {
            this.die();
        } else {
            // Set invulnerability period
            this.setInvulnerable(true, 2000); // 2 seconds
        }
        
        // Emit damage event
        gameEvents.emit({
            type: 'player:damaged',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                health: this.health,
                lives: this.lives
            }
        });
    }
    
    /**
     * Player death
     */
    die(): void {
        this.lives--;
        
        // Emit death event
        gameEvents.emit({
            type: 'player:died',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                lives: this.lives,
                score: this.score
            }
        });
        
        if (this.lives > 0) {
            // Respawn
            this.respawn();
        } else {
            // Game over
            gameEvents.emit({
                type: 'game:over',
                timestamp: Date.now(),
                source: 'PlayerController',
                data: {
                    finalScore: this.score
                }
            });
        }
    }
    
    /**
     * Respawn the player
     */
    respawn(): void {
        this.health = 1;
        this.setInvulnerable(true, 3000); // 3 seconds of invulnerability
        
        // Reset position to center
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        this.gameObject.transform.setPosition(bounds.WIDTH / 2, bounds.HEIGHT / 2);
        
        // Emit respawn event
        gameEvents.emit({
            type: 'player:respawned',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
    }
    
    /**
     * Set invulnerability state
     */
    setInvulnerable(invulnerable: boolean, duration: number = 0): void {
        this.isInvulnerable = invulnerable;
        if (invulnerable && duration > 0) {
            this.invulnerabilityTime = duration;
        }
        
        // Update sprite renderer for visual feedback
        const spriteRenderer = this.gameObject.getComponent<SpriteRenderer>('spriteRenderer');
        if (spriteRenderer) {
            if (invulnerable) {
                // Make player semi-transparent when invulnerable
                spriteRenderer.setAlpha(0.6);
            } else {
                spriteRenderer.setAlpha(1.0);
            }
        }
    }
    
    /**
     * Add score
     */
    addScore(points: number): void {
        this.score += points;
        
        // Emit score event
        gameEvents.emit({
            type: 'player:score_changed',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                score: this.score,
                pointsAdded: points
            }
        });
    }
    
    /**
     * Handle collision with other game objects
     */
    onCollisionEnter(other: GameObject): void {
        if (!this.enabled || this.isInvulnerable) return;
        
        // Handle different collision types based on tags
        switch (other.tag) {
            case 'enemy':
            case 'enemyProjectile':
                this.takeDamage(1);
                break;
            case 'human':
                // Rescue human
                this.rescueHuman(other);
                break;
            case 'powerup':
                // Handle powerup
                this.collectPowerup(other);
                break;
        }
    }
    
    /**
     * Rescue a human
     */
    private rescueHuman(human: GameObject): void {
        // Award points for rescue
        this.addScore(1000);
        
        // Emit rescue event
        gameEvents.emit({
            type: 'human:rescued',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                humanId: human.id
            }
        });
    }
    
    /**
     * Collect a powerup
     */
    private collectPowerup(powerup: GameObject): void {
        // Emit powerup collected event
        gameEvents.emit({
            type: 'powerup:collected',
            timestamp: Date.now(),
            source: 'PlayerController',
            data: {
                playerId: this.gameObject.id,
                powerupId: powerup.id,
                powerupType: powerup.name
            }
        });
    }
}

/**
 * Player factory for creating player game objects
 */
export class PlayerFactory {
    /**
     * Create a new player game object
     */
    static createPlayer(texture: PIXI.Texture, x: number = 400, y: number = 300): GameObject {
        // Create the base game object
        const player = new GameObject('Player');
        player.tag = 'player';
        player.layer = 1;
        
        // Set initial position
        player.transform.setPosition(x, y);
        
        // Add sprite renderer
        const spriteRenderer = new SpriteRenderer(player, texture);
        player.addComponent(spriteRenderer);
        
        // Add collider
        const collider = new Collider(player, 16, 16); // Adjust size as needed
        player.addComponent(collider);
        
        // Add rigidbody for physics
        const rigidbody = new Rigidbody(player);
        rigidbody.drag = 0.8; // Add some drag for responsive movement
        player.addComponent(rigidbody);
        
        // Add player-specific components
        const playerInput = new PlayerInput(player);
        player.addComponent(playerInput);
        
        const playerController = new PlayerController(player);
        player.addComponent(playerController);
        
        // Emit player created event
        gameEvents.emit({
            type: 'player:created',
            timestamp: Date.now(),
            source: 'PlayerFactory',
            data: {
                playerId: player.id,
                position: { x, y }
            }
        });
        
        return player;
    }
}

/**
 * Legacy compatibility interface for existing code
 */
export interface LegacyPlayerInterface {
    sprite: PIXI.Container;
    x: number;
    y: number;
    dx: number;
    dy: number;
    isAlive: boolean;
    lastShootTime: number;
    update(deltaTime: number): void;
    destroy(): void;
}

/**
 * Legacy player wrapper for backward compatibility
 */
export class LegacyPlayerWrapper implements LegacyPlayerInterface {
    private gameObject: GameObject;
    private playerController: PlayerController;
    private spriteRenderer: SpriteRenderer;
    
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.playerController = gameObject.getComponent<PlayerController>('playerController')!;
        this.spriteRenderer = gameObject.getComponent<SpriteRenderer>('spriteRenderer')!;
    }
    
    get sprite(): PIXI.Container {
        return this.spriteRenderer.sprite;
    }
    
    get x(): number {
        return this.gameObject.transform.position.x;
    }
    
    set x(value: number) {
        this.gameObject.transform.position.x = value;
    }
    
    get y(): number {
        return this.gameObject.transform.position.y;
    }
    
    set y(value: number) {
        this.gameObject.transform.position.y = value;
    }
    
    get dx(): number {
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        return rigidbody ? rigidbody.velocity.x : 0;
    }
    
    get dy(): number {
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        return rigidbody ? rigidbody.velocity.y : 0;
    }
    
    get isAlive(): boolean {
        return this.playerController.health > 0;
    }
    
    get lastShootTime(): number {
        return this.playerController.lastShootTime;
    }
    
    update(deltaTime: number): void {
        this.gameObject.update(deltaTime);
    }
    
    destroy(): void {
        this.gameObject.destroy();
    }
}