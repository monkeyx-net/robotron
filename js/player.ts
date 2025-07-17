import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { playerContainer, playerTexture, player } from './main';
import { InputManager } from './inputManager';
import { gameState } from './gameState';
import { Projectiles } from './projectiles';
import { GameObject } from './gameObject';

export class Player extends GameObject {
    dx: number;
    dy: number;
    lastShootTime: number;
    isAlive: boolean;
    shieldEffect: PIXI.Graphics | null;
    isDemoPlayer?: boolean; // Optional for demo player
    aiMoveTimer?: number;   // Optional for demo player
    aiShootTimer?: number;  // Optional for demo player
    shootDelay?: number;    // Optional for demo player
    speed?: number;         // Optional for demo player

    constructor(sprite: PIXI.Sprite, type: string = 'player') {
        super(sprite, type);
        this.dx = 0;
        this.dy = 0;
        this.lastShootTime = 0;
        this.isAlive = true;
        this.shieldEffect = null;
    }

    handleKeyboardInput(): void {
        if (!this.isAlive || !GameConfig || !Projectiles) {
            return;
        }
        if (gameState.currentGameState !== 'PLAYING') return;

        this.dx = 0;
        this.dy = 0;
        if (InputManager.isKeyDown('KeyW')) this.dy = -1;
        if (InputManager.isKeyDown('KeyS')) this.dy = 1;
        if (InputManager.isKeyDown('KeyA')) this.dx = -1;
        if (InputManager.isKeyDown('KeyD')) this.dx = 1;

        if (this.dx !== 0 && this.dy !== 0) {
            const length = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            this.dx /= length;
            this.dy /= length;
        }

        const currentTime = Date.now();
        if (currentTime - this.lastShootTime >= (GameConfig.PLAYER_SHOOT_RATE || 100)) {
            let shootX = 0, shootY = 0;
            if (InputManager.isKeyDown('ArrowUp')) shootY = -1;
            if (InputManager.isKeyDown('ArrowDown')) shootY = 1;
            if (InputManager.isKeyDown('ArrowLeft')) shootX = -1;
            if (InputManager.isKeyDown('ArrowRight')) shootX = 1;

            if (shootX !== 0 || shootY !== 0) {
                if (shootX !== 0 && shootY !== 0) {
                    const length = Math.sqrt(shootX * shootX + shootY * shootY);
                    shootX /= length;
                    shootY /= length;
                }
                Projectiles.createPlayerProjectile(this.sprite.x, this.sprite.y, shootX, shootY);
                this.lastShootTime = currentTime;
            }
        }
    }

    handleGamepadInput(): boolean {
        if (!this.isAlive || !GameConfig || !Projectiles || !InputManager.isGamepadConnected()) {
            return false;
        }
        if (gameState.currentGameState !== 'PLAYING') return false;

        let gamepadInputProcessed = false;

        const { x: moveX, y: moveY } = InputManager.getGamepadMovement();
        const { x: shootX, y: shootY } = InputManager.getGamepadShooting();

        if (moveX !== 0 || moveY !== 0) {
            this.dx = moveX;
            this.dy = moveY;
            const length = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            if (length > 1) {
               this.dx /= length;
               this.dy /= length;
            }
            gamepadInputProcessed = true;
        } else {
            // If no gamepad movement, ensure keyboard input can take over by not setting dx/dy to 0 here
        }

        const currentTime = Date.now();
        if (currentTime - this.lastShootTime >= (GameConfig.PLAYER_SHOOT_RATE || 100)) {
            if (shootX !== 0 || shootY !== 0) {
                const shootLength = Math.sqrt(shootX * shootX + shootY * shootY);
                if (shootLength > (GameConfig.GAMEPAD_DEADZONE || 0.2)) {
                    Projectiles.createPlayerProjectile(this.sprite.x, this.sprite.y, shootX / shootLength, shootY / shootLength);
                    this.lastShootTime = currentTime;
                    gamepadInputProcessed = true;
                }
            }
        }
        return gamepadInputProcessed;
    }

    update(delta: number): void {
        if (!this.isAlive || !this.sprite || this._destroyed || !GameConfig) {
            return;
        }
        if (gameState.currentGameState !== 'PLAYING') return;

        this.sprite.x += this.dx * (GameConfig.PLAYER_SPEED || 2) * delta;
        this.sprite.y += this.dy * (GameConfig.PLAYER_SPEED || 2) * delta;

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

    const playerSprite = new PIXI.Sprite(playerTexture);
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
