import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { playerContainer, playerTexture, player } from './main';
import { ArcadeAtlas } from './core/ArcadeAtlas';
// Removed old InputManager - using unified input manager instead
import { inputManager, InputAction } from './core/InputManager';
import { gameState } from './gameState';
import { Projectiles } from './projectiles';
import { GameObject } from './gameObject';
import { Vector2 } from './utils/Vector2';
import { gameEvents } from './core/EventSystem';
import { Constants } from './utils/Constants';

/**
 * Player state interface for better state management
 */
export interface PlayerState {
    isAlive: boolean;
    invulnerabilityTime: number;
    lives: number;
    score: number;
    lastShootTime: number;
    isDemoPlayer: boolean;
}

/**
 * Player input component for handling different input types
 */
export class PlayerInputComponent {
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    handleKeyboardInput(): Vector2 {
        if (!this.player.state.isAlive || gameState.currentGameState !== 'PLAYING') {
            return new Vector2(0, 0);
        }

        // Use the new unified input manager
        const movement = inputManager.getMovementVector();
        
        // Debug logging (can be removed later)
        if (movement.magnitude() > 0) {
            console.log('Player movement input detected:', movement);
        }
        
        return movement;
    }

    handleShootingInput(): Vector2 {
        if (!this.player.state.isAlive || gameState.currentGameState !== 'PLAYING') {
            return new Vector2(0, 0);
        }

        const currentTime = Date.now();
        if (currentTime - this.player.state.lastShootTime < (Constants.PLAYER_CONSTANTS?.SHOOT_RATE || 100)) {
            return new Vector2(0, 0);
        }

        // Use the new unified input manager for shooting
        const shootDirection = inputManager.getShootingVector();
        if (shootDirection.magnitude() > 0) {
            this.player.state.lastShootTime = currentTime;
        }

        return shootDirection;
    }

    handleGamepadInput(): { movement: Vector2; shooting: Vector2 } {
        if (!this.player.state.isAlive || !inputManager.isGamepadConnected() || gameState.currentGameState !== 'PLAYING') {
            return { movement: new Vector2(0, 0), shooting: new Vector2(0, 0) };
        }

        // Use the new unified input manager for both movement and shooting
        const movement = inputManager.getMovementVector();

        let shooting = new Vector2(0, 0);
        const currentTime = Date.now();

        if (currentTime - this.player.state.lastShootTime >= (Constants.PLAYER_CONSTANTS?.SHOOT_RATE || 100)) {
            const shootDirection = inputManager.getShootingVector();
            if (shootDirection.magnitude() > 0) {
                shooting = shootDirection;
                this.player.state.lastShootTime = currentTime;
            }
        }

        return { movement, shooting };
    }
}

/**
 * Player movement component for handling physics and movement
 */
export class PlayerMovementComponent {
    private player: Player;
    private currentVelocity: Vector2 = new Vector2(0, 0);

    constructor(player: Player) {
        this.player = player;
    }

    updateMovement(inputDirection: Vector2, deltaTime: number): void {
        if (!this.player.state.isAlive) {
            this.currentVelocity.set(0, 0);
            return;
        }

        // Apply input to velocity
        const speed = Constants.PLAYER_CONSTANTS?.SPEED || 2;
        this.currentVelocity = inputDirection.clone().multiply(speed);

        // Update position directly using sprite
        if (this.player.sprite) {
            this.player.sprite.x += this.currentVelocity.x * deltaTime;
            this.player.sprite.y += this.currentVelocity.y * deltaTime;
        }

        // Apply boundary constraints
        this.constrainToBounds();

        // Emit movement event if player moved
        if (this.currentVelocity.magnitude() > 0 && this.player.sprite) {
            gameEvents.emit({
                type: 'player:moved',
                timestamp: Date.now(),
                source: 'Player',
                data: {
                    position: { x: this.player.sprite.x, y: this.player.sprite.y },
                    velocity: { x: this.currentVelocity.x, y: this.currentVelocity.y }
                }
            });
        }
    }

    private constrainToBounds(): void {
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        const padding = 5;

        if (this.player.sprite) {
            const newX = Math.max(padding, Math.min(bounds.WIDTH - padding, this.player.sprite.x));
            const newY = Math.max(padding, Math.min(bounds.HEIGHT - padding, this.player.sprite.y));

            this.player.sprite.x = newX;
            this.player.sprite.y = newY;
        }
    }
}

/**
 * Player shooting component for handling projectile creation
 */
export class PlayerShootingComponent {
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    shoot(direction: Vector2): void {
        if (!this.player.state.isAlive || direction.magnitude() === 0) {
            return;
        }

        // Create projectile using sprite position
        if (this.player.sprite) {
            Projectiles.createPlayerProjectile(
                this.player.sprite.x,
                this.player.sprite.y,
                direction.x,
                direction.y
            );

            // Emit shooting event
            gameEvents.emit({
                type: 'player:shot',
                timestamp: Date.now(),
                source: 'Player',
                data: {
                    position: { x: this.player.sprite.x, y: this.player.sprite.y },
                    direction: { x: direction.x, y: direction.y }
                }
            });
        }
    }
}

/**
 * Enhanced Player class with component-based architecture
 */
export class Player extends GameObject {
    public state: PlayerState;
    private inputComponent: PlayerInputComponent;
    private movementComponent: PlayerMovementComponent;
    private shootingComponent: PlayerShootingComponent;
    private shieldEffect: PIXI.Graphics | null = null;

    // Add velocity tracking for legacy compatibility
    private velocity: Vector2 = new Vector2(0, 0);

    // Legacy properties for backward compatibility
    get dx(): number { return this.velocity.x; }
    set dx(value: number) { this.velocity.x = value; }
    get dy(): number { return this.velocity.y; }
    set dy(value: number) { this.velocity.y = value; }
    get lastShootTime(): number { return this.state.lastShootTime; }
    get isAlive(): boolean { return this.state.isAlive; }
    get isDemoPlayer(): boolean { return this.state.isDemoPlayer; }
    set isDemoPlayer(value: boolean) { this.state.isDemoPlayer = value; }

    constructor(sprite: PIXI.Sprite, type: string = 'player') {
        super(sprite, type);

        // Initialize player state
        this.state = {
            isAlive: true,
            invulnerabilityTime: 0,
            lives: Constants.PLAYER_CONSTANTS?.INITIAL_LIVES || 3,
            score: 0,
            lastShootTime: 0,
            isDemoPlayer: false
        };

        // Initialize components
        this.inputComponent = new PlayerInputComponent(this);
        this.movementComponent = new PlayerMovementComponent(this);
        this.shootingComponent = new PlayerShootingComponent(this);

        // Emit player created event
        gameEvents.emit({
            type: 'player:created',
            timestamp: Date.now(),
            source: 'Player',
            data: {
                id: `player_${Date.now()}`,
                position: { x: this.sprite?.x || 0, y: this.sprite?.y || 0 }
            }
        });
    }

    handleKeyboardInput(): void {
        // Use new component-based input handling
        const movement = this.inputComponent.handleKeyboardInput();
        const shooting = this.inputComponent.handleShootingInput();

        // Store movement for legacy compatibility
        this.velocity = movement.clone().multiply(Constants.PLAYER_CONSTANTS?.SPEED || 2);

        // Handle shooting
        if (shooting.magnitude() > 0) {
            this.shootingComponent.shoot(shooting);
        }
    }

    handleGamepadInput(): boolean {
        // Use new component-based gamepad handling
        const { movement, shooting } = this.inputComponent.handleGamepadInput();

        let gamepadInputProcessed = false;

        // Handle movement
        if (movement.magnitude() > 0) {
            this.velocity = movement.clone().multiply(Constants.PLAYER_CONSTANTS?.SPEED || 2);
            gamepadInputProcessed = true;
        }

        // Handle shooting
        if (shooting.magnitude() > 0) {
            this.shootingComponent.shoot(shooting);
            gamepadInputProcessed = true;
        }

        return gamepadInputProcessed;
    }

    update(delta: number): void {
        if (!this.isAlive || !this.sprite || this._destroyed || !GameConfig) {
            return;
        }
        if (gameState.currentGameState !== 'PLAYING') return;

        // Arcade movement (REVERSE.md Ph9): fixed 1px-per-frame steps in
        // 8 directions — no acceleration, no analog speed.
        this.sprite.x += Math.sign(this.dx) * delta;
        this.sprite.y += Math.sign(this.dy) * delta;

        this.sprite.x = Math.max(5, Math.min(GameConfig.GAME_WIDTH - 5, this.sprite.x));
        this.sprite.y = Math.max(5, Math.min(GameConfig.GAME_HEIGHT - 5, this.sprite.y));

        if (gameState.playerInvulnerableTime > 0) {
            const invulnerablePhase = (gameState.playerInvulnerableTime / 1000) * Math.PI * 2 * 2;
            this.sprite.alpha = 0.6 + Math.sin(invulnerablePhase * 3) * 0.4;

            if (!this.shieldEffect || (this.shieldEffect as any)._destroyed) {
                this.shieldEffect = new PIXI.Graphics();
                this.shieldEffect.beginFill(0x00FFFF, 0.25);
                this.shieldEffect.drawCircle(0, 0, 10);
                this.shieldEffect.endFill();
                this.sprite.addChild(this.shieldEffect);
            }

            if (this.shieldEffect && !(this.shieldEffect as any)._destroyed) {
                const shieldScale = 1.0 + Math.sin(invulnerablePhase * 2) * 0.15;
                this.shieldEffect.scale.set(shieldScale);
                this.shieldEffect.rotation = invulnerablePhase * 0.5;
                this.shieldEffect.alpha = 0.3 + Math.sin(invulnerablePhase * 5) * 0.2;
            }
        } else {
            this.sprite.alpha = 1.0;
            if (this.shieldEffect && !(this.shieldEffect as any)._destroyed) {
                this.sprite.removeChild(this.shieldEffect);
                this.shieldEffect.destroy();
                this.shieldEffect = null;
            }
        }
    }
}

export function createPlayer(): Player {
    if (!PIXI || !playerTexture || !playerContainer || !GameConfig) {
        console.warn("Player.createPlayer: Missing dependencies.");
        // Return a dummy player or throw an error if player creation is critical
        const dummySprite = new PIXI.Sprite(); // Create a minimal dummy sprite
        return new Player(dummySprite);
    }

    if (player && player.sprite && !(player.sprite as any)._destroyed) {
        player.destroy(); // Use the destroy method from GameObject
    }

    // ROM-extracted player frames (walk/fire-direction poses); falls back
    // to the legacy player.png when the atlas is unavailable.
    // 12 frames = 3-frame walk x 4 directions; use the down-facing walk
    // cycle (frames 0-2) as the base animation.
    const atlasFrames = ArcadeAtlas.frames('player');
    let playerSprite: PIXI.Sprite;
    if (atlasFrames.length) {
        const anim = new PIXI.AnimatedSprite(atlasFrames.slice(0, 3));
        anim.animationSpeed = 0.12;
        anim.play();
        playerSprite = anim;
    } else {
        playerSprite = new PIXI.Sprite(playerTexture);
    }
    playerSprite.anchor.set(0.5);
    playerSprite.x = GameConfig.GAME_WIDTH / 2;
    playerSprite.y = GameConfig.GAME_HEIGHT / 2;
    playerContainer.addChild(playerSprite);

    return new Player(playerSprite);
}

export const PlayerModule = {
    createPlayer,
    handlePlayerKeyboardInput: (playerInstance: Player) => playerInstance.handleKeyboardInput(),
    handlePlayerGamepadInput: (playerInstance: Player) => playerInstance.handleGamepadInput(),
    updatePlayer: (playerInstance: Player, delta: number) => playerInstance.update(delta)
};
