/**
 * HighScoreDisplayState - Handles the high score display screen state
 * 
 * Shows the high score screen as part of the attract mode sequence
 */

import { BaseGameState } from '../GameStateManager';
import { GameConfig } from '../../config';
import { UI } from '../../ui';
import { gameState } from '../../gameState';
import { loadHighScore, clearEntities } from '../../gameLogic';

export class HighScoreDisplayState extends BaseGameState {
    private attractModeTimer: number = 0;
    
    constructor() {
        super('HIGH_SCORE_DISPLAY_SCREEN');
    }
    
    public enter(_data?: any): void {
        console.log('HighScoreDisplayState: Entering high score display');
        
        // Hide message box
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
        
        // Update game state
        gameState.currentGameState = 'HIGH_SCORE_DISPLAY_SCREEN';
        
        // Hide other screens
        if (UI.hideTitleScreen) {
            UI.hideTitleScreen();
        }
        this.hideDemoPlayScreen();
        
        // Clear entities and load high score
        clearEntities();
        loadHighScore();
        
        // Setup high score display screen UI
        if (UI.setupHighScoreDisplayScreen) {
            UI.setupHighScoreDisplayScreen();
        }
        
        // Initialize timer
        this.attractModeTimer = GameConfig.HIGH_SCORE_DURATION || 180;
        
        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }
        
        // Emit state-specific event
        this.emitStateEvent('entered');
    }
    
    public exit(_data?: any): void {
        console.log('HighScoreDisplayState: Exiting high score display');
        
        // Hide high score display screen UI
        if (UI.hideHighScoreDisplayScreen) {
            UI.hideHighScoreDisplayScreen();
        }
        
        // Emit state-specific event
        this.emitStateEvent('exited');
    }
    
    public update(deltaTime: number): void {
        // Normalize delta time for consistent timing
        const normalizedDelta = deltaTime / (1000 / 60);
        
        // Update attract mode timer
        this.attractModeTimer -= normalizedDelta;
        if (this.attractModeTimer <= 0) {
            // Transition to demo play
            this.requestTransition('DEMO_PLAY');
        }
    }
    
    public render(): void {
        // High score display rendering is handled by UI system
        // This method can be used for additional rendering if needed
    }
    
    public handleInput(inputEvent: any): void {
        // Handle start game input
        if (inputEvent.type === 'input:start' && inputEvent.data.pressed) {
            console.log('HighScoreDisplayState: Start game input received');
            this.startGame();
        }
        
        // Handle select input (also starts game)
        if (inputEvent.type === 'input:select' && inputEvent.data.pressed) {
            console.log('HighScoreDisplayState: Select input received');
            this.startGame();
        }
        
        // Handle keyboard input for game start
        if (inputEvent.type === 'keydown') {
            const key = inputEvent.data.key;
            if (key === 'Enter' || key === ' ' || key === 'Escape') {
                console.log('HighScoreDisplayState: Keyboard start input received:', key);
                this.startGame();
            }
        }
    }
    
    /**
     * Start the game from high score display screen
     */
    private startGame(): void {
        console.log('HighScoreDisplayState: Starting game');
        
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
     * Hide demo play screen elements
     */
    private hideDemoPlayScreen(): void {
        // Import demo play container dynamically to avoid circular dependencies
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
            console.warn('HighScoreDisplayState: Could not hide demo play screen:', error);
        });
    }
}