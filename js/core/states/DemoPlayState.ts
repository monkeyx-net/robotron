/**
 * DemoPlayState - Handles the demo play state
 * 
 * Runs an AI-controlled demo of the game as part of the attract mode
 */

import { BaseGameState } from '../GameStateManager';
import { GameConfig } from '../../config';
import { UI } from '../../ui';
import { gameState } from '../../gameState';
import { clearEntities, checkCollisions } from '../../gameLogic';
import { Player, createPlayer } from '../../player';
import { Projectiles } from '../../projectiles';
import { Enemies, createGrunt, createHulk, createBrain } from '../../enemies';
import { Humans, createHuman } from '../../humans';
import { Obstacles } from '../../obstacles';
import { Enemy } from '../../enemiesClasses';

export class DemoPlayState extends BaseGameState {
    private attractModeTimer: number = 0;
    private demoPlayer: Player | null = null;
    
    constructor() {
        super('DEMO_PLAY');
    }
    
    public enter(data?: any): void {
        console.log('DemoPlayState: Entering demo play');
        
        // Hide message box
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
        
        // Update game state
        gameState.currentGameState = 'DEMO_PLAY';
        
        // Hide other screens
        if (UI.hideTitleScreen) {
            UI.hideTitleScreen();
        }
        if (UI.hideHighScoreDisplayScreen) {
            UI.hideHighScoreDisplayScreen();
        }
        
        // Clear entities
        clearEntities();
        
        // Show demo play container
        this.showDemoPlayContainer();
        
        // Create demo player
        this.createDemoPlayer();
        
        // Create demo enemies and humans
        this.createDemoEntities();
        
        // Reset score for demo
        gameState.score = 0;
        if (UI && UI.updateScoreDisplay) {
            UI.updateScoreDisplay();
        }
        
        // Initialize timer
        this.attractModeTimer = GameConfig.DEMO_PLAY_DURATION || 450;
        
        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }
        
        // Emit state-specific event
        this.emitStateEvent('entered');
    }
    
    public exit(data?: any): void {
        console.log('DemoPlayState: Exiting demo play');
        
        // Hide demo play container
        this.hideDemoPlayContainer();
        
        // Clean up demo player
        if (this.demoPlayer && this.demoPlayer.sprite && !(this.demoPlayer.sprite as any)._destroyed) {
            this.demoPlayer.destroy();
        }
        this.demoPlayer = null;
        
        // Set global demo player to null
        import('../../main').then(({ setDemoPlayer }) => {
            if (setDemoPlayer) {
                setDemoPlayer(null);
            }
        }).catch(error => {
            console.warn('DemoPlayState: Could not clear global demo player:', error);
        });
        
        // Emit state-specific event
        this.emitStateEvent('exited');
    }
    
    public update(deltaTime: number): void {
        // Check if demo player is still alive
        if (!this.demoPlayer || !this.demoPlayer.isAlive) {
            // Demo player died, return to title screen
            this.requestTransition('TITLE_SCREEN');
            return;
        }
        
        // Update game entities with normalized delta time
        const normalizedDelta = deltaTime / (1000 / 60); // Convert to expected delta format
        
        // Update demo player AI with error handling
        try {
            this.updateDemoPlayerAI(normalizedDelta);
        } catch (error) {
            console.warn('DemoPlayState: Error updating demo player AI:', error);
            // If there's an error with the demo player, transition back to title
            this.requestTransition('TITLE_SCREEN');
            return;
        }
        
        if (this.demoPlayer instanceof Player) {
            this.demoPlayer.update(normalizedDelta);
        }
        
        if (Projectiles) {
            if (Projectiles.updatePlayerProjectiles) {
                Projectiles.updatePlayerProjectiles(normalizedDelta);
            }
            if (Projectiles.updateEnemyProjectiles) {
                Projectiles.updateEnemyProjectiles(normalizedDelta);
            }
        }
        
        if (Enemies && Enemies.updateEnemies) {
            Enemies.updateEnemies(normalizedDelta);
        }
        
        if (Humans && Humans.updateHumansAndProgs) {
            Humans.updateHumansAndProgs(normalizedDelta);
        }
        
        if (Obstacles && Obstacles.updateObstacles) {
            Obstacles.updateObstacles(normalizedDelta);
        }
        
        // Check collisions
        checkCollisions();
        
        // Update attract mode timer
        this.attractModeTimer -= normalizedDelta;
        if (this.attractModeTimer <= 0) {
            // Return to title screen
            this.requestTransition('TITLE_SCREEN');
        }
    }
    
    public render(): void {
        // Demo play rendering is handled by the game systems
        // This method can be used for additional rendering if needed
    }
    
    public handleInput(inputEvent: any): void {
        // Handle start game input
        if (inputEvent.type === 'input:start' && inputEvent.data.pressed) {
            console.log('DemoPlayState: Start game input received');
            this.startGame();
        }
        
        // Handle select input (also starts game)
        if (inputEvent.type === 'input:select' && inputEvent.data.pressed) {
            console.log('DemoPlayState: Select input received');
            this.startGame();
        }
        
        // Handle keyboard input for game start
        if (inputEvent.type === 'keydown') {
            const key = inputEvent.data.key;
            if (key === 'Enter' || key === ' ' || key === 'Escape') {
                console.log('DemoPlayState: Keyboard start input received:', key);
                this.startGame();
            }
        }
    }
    
    /**
     * Start the game from demo play
     */
    private startGame(): void {
        console.log('DemoPlayState: Starting game');
        
        // Reset game state for new game
        gameState.score = 0;
        gameState.lives = 3;
        gameState.wave = 0; // Will be set to 1 in PlayingState.startNewGame()
        gameState.currentHumanRescueBonus = 1000;
        gameState.humanRescueBonusDecayTimer = 0;
        gameState.nextExtraLifeScore = 25000;
        gameState.playerInvulnerableTime = 0;
        
        // Emit game start event
        this.emitStateEvent('game_start_requested');
        
        // Transition to playing state
        this.requestTransition('PLAYING');
    }
    
    /**
     * Show the demo play container
     */
    private showDemoPlayContainer(): void {
        import('../../main').then(({ demoPlayContainer }) => {
            if (demoPlayContainer) {
                demoPlayContainer.visible = true;
            }
        }).catch(error => {
            console.warn('DemoPlayState: Could not show demo play container:', error);
        });
    }
    
    /**
     * Hide the demo play container
     */
    private hideDemoPlayContainer(): void {
        import('../../main').then(({ demoPlayContainer }) => {
            if (demoPlayContainer) {
                demoPlayContainer.visible = false;
            }
        }).catch(error => {
            console.warn('DemoPlayState: Could not hide demo play container:', error);
        });
    }
    
    /**
     * Create the demo player with AI behavior
     */
    private createDemoPlayer(): void {
        this.demoPlayer = createPlayer();
        if (this.demoPlayer) {
            // Mark as demo player
            (this.demoPlayer as any).isDemoPlayer = true;
            
            // Set demo player properties
            (this.demoPlayer as any).speed = (GameConfig.PLAYER_SPEED || 2) * 0.4;
            
            // Position demo player
            if (this.demoPlayer.sprite) {
                this.demoPlayer.sprite.x = GameConfig.GAME_WIDTH / 4;
                this.demoPlayer.sprite.y = GameConfig.GAME_HEIGHT / 2;
            }
            
            // Initialize AI timers
            (this.demoPlayer as any).aiMoveTimer = 0;
            (this.demoPlayer as any).aiShootTimer = 0;
            (this.demoPlayer as any).shootDelay = 90;
            
            // Set global demo player reference
            import('../../main').then(({ setDemoPlayer }) => {
                if (setDemoPlayer) {
                    setDemoPlayer(this.demoPlayer);
                }
            }).catch(error => {
                console.warn('DemoPlayState: Could not set global demo player:', error);
            });
        } else {
            console.error('DemoPlayState: Failed to create demo player');
            this.requestTransition('TITLE_SCREEN');
        }
    }
    
    /**
     * Create demo entities (enemies and humans)
     */
    private createDemoEntities(): void {
        // Create demo enemies
        if (createGrunt) {
            createGrunt(GameConfig.GAME_WIDTH * 0.75, GameConfig.GAME_HEIGHT * 0.25);
        }
        if (createHulk) {
            createHulk(GameConfig.GAME_WIDTH * 0.7, GameConfig.GAME_HEIGHT * 0.6);
        }
        if (createBrain) {
            createBrain(GameConfig.GAME_WIDTH * 0.75, GameConfig.GAME_HEIGHT * 0.75);
        }
        
        // Create demo human
        if (createHuman) {
            createHuman(GameConfig.GAME_WIDTH * 0.6, GameConfig.GAME_HEIGHT * 0.3);
        }
    }
    
    /**
     * Update demo player AI behavior
     */
    private updateDemoPlayerAI(deltaTime: number): void {
        // Comprehensive validation of demo player
        if (!this.demoPlayer || 
            !this.demoPlayer.isAlive || 
            !this.demoPlayer.sprite || 
            this.demoPlayer._destroyed ||
            typeof this.demoPlayer.sprite.x !== 'number' ||
            typeof this.demoPlayer.sprite.y !== 'number') {
            return;
        }
        
        // Update movement AI
        (this.demoPlayer as any).aiMoveTimer -= deltaTime;
        if ((this.demoPlayer as any).aiMoveTimer <= 0) {
            // Random movement
            this.demoPlayer.dx = (Math.random() - 0.5) * 2;
            this.demoPlayer.dy = (Math.random() - 0.5) * 2;
            
            // Normalize movement vector
            const len = Math.hypot(this.demoPlayer.dx, this.demoPlayer.dy);
            if (len > 0) {
                this.demoPlayer.dx /= len;
                this.demoPlayer.dy /= len;
            }
            
            (this.demoPlayer as any).aiMoveTimer = 60 + Math.random() * 60;
        }
        
        // Update shooting AI
        (this.demoPlayer as any).aiShootTimer -= deltaTime;
        if ((this.demoPlayer as any).aiShootTimer <= 0) {
            // Use async/await for finding nearest enemy
            this.findNearestEnemyForDemo().then(nearestEnemy => {
                // Check if demo player is still valid
                if (!this.demoPlayer || !this.demoPlayer.sprite || this.demoPlayer._destroyed) {
                    return;
                }
                
                let shootDx = (Math.random() - 0.5) * 2;
                let shootDy = (Math.random() - 0.5) * 2;
                
                // Aim at nearest enemy if available and valid
                if (nearestEnemy && nearestEnemy.sprite && !nearestEnemy._destroyed && this.demoPlayer && this.demoPlayer.sprite) {
                    const angleToEnemy = Math.atan2(
                        nearestEnemy.sprite.y - this.demoPlayer.sprite.y,
                        nearestEnemy.sprite.x - this.demoPlayer.sprite.x
                    );
                    shootDx = Math.cos(angleToEnemy);
                    shootDy = Math.sin(angleToEnemy);
                }
                
                // Normalize shooting vector and create projectile
                const shootLen = Math.hypot(shootDx, shootDy);
                if (shootLen > 0 && Projectiles && Projectiles.createPlayerProjectile && this.demoPlayer && this.demoPlayer.sprite) {
                    Projectiles.createPlayerProjectile(
                        this.demoPlayer.sprite.x,
                        this.demoPlayer.sprite.y,
                        shootDx / shootLen,
                        shootDy / shootLen
                    );
                }
            }).catch(() => {
                // Fallback to random shooting if demo player is still valid
                if (!this.demoPlayer || !this.demoPlayer.sprite || this.demoPlayer._destroyed) {
                    return;
                }
                
                const shootDx = (Math.random() - 0.5) * 2;
                const shootDy = (Math.random() - 0.5) * 2;
                const shootLen = Math.hypot(shootDx, shootDy);
                if (shootLen > 0 && Projectiles && Projectiles.createPlayerProjectile) {
                    Projectiles.createPlayerProjectile(
                        this.demoPlayer.sprite.x,
                        this.demoPlayer.sprite.y,
                        shootDx / shootLen,
                        shootDy / shootLen
                    );
                }
            });
            
            (this.demoPlayer as any).aiShootTimer = ((this.demoPlayer as any).shootDelay || 90) + Math.random() * 30;
        }
        
        // Avoidance behavior - run away from nearby enemies
        this.findNearestEnemyForDemo().then(nearestEnemy => {
            // Check if demo player is still valid
            if (!this.demoPlayer || !this.demoPlayer.sprite || this.demoPlayer._destroyed) {
                return;
            }
            
            // Check if enemy is valid
            if (nearestEnemy && nearestEnemy.sprite && !nearestEnemy._destroyed) {
                const distance = Math.hypot(
                    this.demoPlayer.sprite.x - nearestEnemy.sprite.x,
                    this.demoPlayer.sprite.y - nearestEnemy.sprite.y
                );
                
                if (distance < 50) {
                    // Run away from enemy
                    const angleAway = Math.atan2(
                        this.demoPlayer.sprite.y - nearestEnemy.sprite.y,
                        this.demoPlayer.sprite.x - nearestEnemy.sprite.x
                    );
                    this.demoPlayer.dx = Math.cos(angleAway);
                    this.demoPlayer.dy = Math.sin(angleAway);
                }
            }
        }).catch(() => {
            // Ignore errors in avoidance behavior
        });
    }
    
    /**
     * Find the nearest enemy to the demo player
     */
    private async findNearestEnemyForDemo(): Promise<Enemy | null> {
        // Double-check demo player is still valid
        if (!this.demoPlayer || !this.demoPlayer.sprite || this.demoPlayer._destroyed) {
            return null;
        }
        
        try {
            // Get enemies from global enemies array
            const { enemies } = await import('../../main');
            if (!enemies || enemies.length === 0) {
                return null;
            }
            
            let nearest: Enemy | null = null;
            let minDistSq = Infinity;
            
            enemies.forEach(enemy => {
                // More thorough validation of enemy
                if (enemy && enemy.sprite && !enemy._destroyed && !enemy.indestructible) {
                    // Additional check that sprite has valid coordinates
                    if (typeof enemy.sprite.x === 'number' && typeof enemy.sprite.y === 'number' &&
                        this.demoPlayer && this.demoPlayer.sprite &&
                        typeof this.demoPlayer.sprite.x === 'number' && typeof this.demoPlayer.sprite.y === 'number') {
                        
                        const distSq = Math.pow(
                            this.demoPlayer.sprite.x - enemy.sprite.x, 2
                        ) + Math.pow(
                            this.demoPlayer.sprite.y - enemy.sprite.y, 2
                        );
                        
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            nearest = enemy;
                        }
                    }
                }
            });
            
            return nearest;
        } catch (error) {
            console.warn('DemoPlayState: Error finding nearest enemy:', error);
            return null;
        }
    }
}