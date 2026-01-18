/**
 * PlayingState - Handles the main gameplay state
 * 
 * Manages active gameplay, player input, entity updates, and collision detection
 */

import { BaseGameState } from '../GameStateManager';
import { gameState } from '../../gameState';
import { UI } from '../../ui';
import { Player, createPlayer } from '../../player';
import { Projectiles } from '../../projectiles';
import { Enemies } from '../../enemies';
import { Humans } from '../../humans';
import { Obstacles } from '../../obstacles';
import { Effects } from '../../effects';
import { checkCollisions, checkForExtraLife, checkWaveCompletion, updateBonusDecay, startNextWave, clearEntities } from '../../gameLogic';
import { collisionIntegration } from '../CollisionIntegration';
import { gameEvents } from '../EventSystem';
import { GameConfig } from '../../config';

export class PlayingState extends BaseGameState {
    private player: Player | null = null;
    
    constructor() {
        super('PLAYING');
    }
    
    public enter(): void {
        console.log('PlayingState: Entering gameplay');
        
        // Validate game state before entering
        if (gameState.lives <= 0) {
            console.log('PlayingState: Invalid game state detected (lives <= 0), will reset to new game');
        }
        
        // Update game state
        gameState.currentGameState = 'PLAYING';
        
        // Hide attract mode screens
        if (UI.hideTitleScreen) {
            UI.hideTitleScreen();
        }
        if (UI.hideHighScoreDisplayScreen) {
            UI.hideHighScoreDisplayScreen();
        }
        this.hideDemoPlayScreen();
        
        // Hide message box
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
        
        // Initialize game for playing
        this.initializeGameplay();
        
        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }
        
        // Emit state-specific event
        this.emitStateEvent('entered');
        
        // Emit game started event
        gameEvents.emit({
            type: 'game:started',
            timestamp: Date.now(),
            source: this.name,
            data: {
                score: gameState.score,
                lives: gameState.lives,
                wave: gameState.wave
            }
        });
    }
    
    public exit(): void {
        console.log('PlayingState: Exiting gameplay');
        
        // Clear all entities including the player
        clearEntities();
        
        // Clean up player reference
        if (this.player) {
            this.player = null;
        }
        
        // Set global player reference to null
        import('../../main').then(({ setPlayer }) => {
            if (setPlayer) {
                setPlayer(null);
            }
        }).catch(error => {
            console.warn('PlayingState: Could not clear global player:', error);
        });
        
        // Emit state-specific event
        this.emitStateEvent('exited');
    }
    
    public update(deltaTime: number): void {
        // Check if player exists and is alive
        if (!this.player) {
            console.error('PlayingState: No player object in PLAYING state');
            this.requestTransition('GAME_OVER');
            return;
        }
        
        if (!this.player.isAlive) {
            console.log('PlayingState: Player died');
            
            // Check if player has lives remaining
            if (gameState.lives > 0) {
                // Respawn player or show respawn screen
                this.handlePlayerDeath();
            } else {
                // Game over
                this.requestTransition('GAME_OVER');
            }
            return;
        }
        
        // Update player invulnerability
        if (gameState.playerInvulnerableTime > 0) {
            gameState.playerInvulnerableTime -= deltaTime;
            if (gameState.playerInvulnerableTime < 0) {
                gameState.playerInvulnerableTime = 0;
            }
        }
        
        // Update game entities
        const normalizedDelta = deltaTime / (1000 / 60); // Convert to expected delta format
        
        // Update player
        this.player.handleKeyboardInput();
        this.player.update(normalizedDelta);
        
        // Update projectiles
        Projectiles.updatePlayerProjectiles(normalizedDelta);
        Projectiles.updateEnemyProjectiles(normalizedDelta);
        
        // Update enemies
        Enemies.updateEnemies(normalizedDelta);
        
        // Update humans and progs
        Humans.updateHumansAndProgs(normalizedDelta);
        
        // Update obstacles
        Obstacles.updateObstacles(normalizedDelta);
        
        // Update bonus decay
        updateBonusDecay(normalizedDelta);
        
        // Update effects
        Effects.updateEffects(normalizedDelta);
        
        // Collision detection
        checkCollisions();
        
        // Register objects with new collision system for testing
        try {
            import('../../main').then(({ playerProjectiles, enemyProjectiles, enemies, humansAndProgs, obstacles }) => {
                collisionIntegration.registerGameObjects(
                    playerProjectiles,
                    enemyProjectiles,
                    enemies,
                    humansAndProgs,
                    obstacles,
                    this.player as any // Cast to any to avoid type issues for now
                );
                
                // Run new collision system (currently in testing mode)
                collisionIntegration.checkCollisions();
            }).catch(error => {
                console.warn('PlayingState: Could not register collision objects:', error);
            });
        } catch (error) {
            console.warn('PlayingState: Collision integration error:', error);
        }
        
        // Check for extra life
        checkForExtraLife();
        
        // Check wave completion
        checkWaveCompletion();
    }
    
    public render(): void {
        // Gameplay rendering is handled by the game systems
        // This method can be used for additional rendering if needed
    }
    
    public handleInput(inputEvent: any): void {
        // Handle pause input
        if (inputEvent.type === 'input:pause' && inputEvent.data.pressed) {
            console.log('PlayingState: Pause input received');
            this.requestTransition('PAUSED');
        }
        
        // Handle escape key for pause
        if (inputEvent.type === 'keydown' && inputEvent.data.key === 'Escape') {
            console.log('PlayingState: Escape key pressed for pause');
            this.requestTransition('PAUSED');
        }
        
        // Player input is handled directly by the player object
        // through the unified input manager
    }
    
    /**
     * Initialize gameplay when entering playing state
     */
    private initializeGameplay(): void {
        // Create player if not exists
        if (!this.player) {
            this.player = createPlayer();
            if (!this.player) {
                console.error('PlayingState: Failed to create player');
                this.requestTransition('GAME_OVER');
                return;
            }
            
            // Set global player reference
            import('../../main').then(({ setPlayer }) => {
                if (setPlayer) {
                    setPlayer(this.player);
                }
            }).catch(error => {
                console.warn('PlayingState: Could not set global player:', error);
            });
        }
        
        // Initialize game variables if starting new game or if game state is invalid
        if (gameState.wave === 0 || gameState.lives <= 0 || !gameState.wave) {
            console.log('PlayingState: Starting new game (wave:', gameState.wave, 'lives:', gameState.lives, ')');
            this.startNewGame();
        } else {
            // Continue existing game
            console.log('PlayingState: Continuing existing game', {
                wave: gameState.wave,
                score: gameState.score,
                lives: gameState.lives
            });
        }
        
        // Update UI
        if (UI.updateScoreDisplay) {
            UI.updateScoreDisplay();
        }
        // Use updateUI for lives and wave display
        if (UI.updateUI) {
            UI.updateUI();
        }
    }
    
    /**
     * Start a new game
     */
    private startNewGame(): void {
        console.log('PlayingState: Starting new game');

        // Reset game variables to match original game configuration
        gameState.score = 0;
        gameState.lives = GameConfig.INITIAL_LIVES; // Use config value (30 in original game)
        gameState.wave = 1;
        gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
        gameState.humanRescueBonusDecayTimer = 0;
        gameState.nextExtraLifeScore = GameConfig.EXTRA_LIFE_SCORE_INTERVAL;
        gameState.playerInvulnerableTime = 0;

        console.log(`Starting new game with ${gameState.lives} lives (from GameConfig.INITIAL_LIVES)`);

        // Start first wave
        startNextWave();

        // Emit new game event
        gameEvents.emit({
            type: 'game:new_game_started',
            timestamp: Date.now(),
            source: this.name,
            data: {
                initialLives: gameState.lives,
                startingWave: gameState.wave
            }
        });
    }
    
    /**
     * Handle player death
     */
    private handlePlayerDeath(): void {
        console.log('PlayingState: Handling player death');
        
        // Decrease lives
        gameState.lives--;
        
        // Emit player death event
        gameEvents.emit({
            type: 'game:player_died',
            timestamp: Date.now(),
            source: this.name,
            data: {
                remainingLives: gameState.lives,
                score: gameState.score,
                wave: gameState.wave
            }
        });
        
        if (gameState.lives > 0) {
            // Respawn player
            this.respawnPlayer();
        } else {
            // Game over
            this.requestTransition('GAME_OVER');
        }
    }
    
    /**
     * Respawn the player
     */
    private respawnPlayer(): void {
        console.log('PlayingState: Respawning player');
        
        // Create new player
        this.player = createPlayer();
        if (!this.player) {
            console.error('PlayingState: Failed to respawn player');
            this.requestTransition('GAME_OVER');
            return;
        }
        
        // Set invulnerability time
        gameState.playerInvulnerableTime = 3000; // 3 seconds of invulnerability
        
        // Set global player reference
        import('../../main').then(({ setPlayer }) => {
            if (setPlayer) {
                setPlayer(this.player);
            }
        }).catch(error => {
            console.warn('PlayingState: Could not set global player after respawn:', error);
        });
        
        // Update UI
        if (UI.updateUI) {
            UI.updateUI();
        }
        
        // Emit respawn event
        gameEvents.emit({
            type: 'game:player_respawned',
            timestamp: Date.now(),
            source: this.name,
            data: {
                remainingLives: gameState.lives,
                invulnerabilityTime: gameState.playerInvulnerableTime
            }
        });
    }
    
    /**
     * Hide demo play screen elements
     */
    private hideDemoPlayScreen(): void {
        import('../../main').then(({ demoPlayContainer, demoPlayer, setDemoPlayer }) => {
            if (demoPlayContainer) {
                demoPlayContainer.visible = false;
            }
            
            if (demoPlayer && demoPlayer.sprite && !(demoPlayer.sprite as any)._destroyed) {
                demoPlayer.destroy();
            }
            
            if (setDemoPlayer) {
                setDemoPlayer(null);
            }
        }).catch(error => {
            console.warn('PlayingState: Could not hide demo play screen:', error);
        });
    }
}