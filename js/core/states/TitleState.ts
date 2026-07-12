/**
 * TitleState - Handles the title screen state
 * 
 * Manages the title screen display, attract mode timing, and transitions
 * to high score display or game start
 */

import { BaseGameState } from '../GameStateManager';
import { GameConfig } from '../../config';
import { UI } from '../../ui';
import { gameState } from '../../gameState';
import { loadHighScore, clearEntities } from '../../gameLogic';
import { gameEvents } from '../EventSystem';

export class TitleState extends BaseGameState {
    private attractModeTimer: number = 0;
    private insertCoinFlashTimer: number = 0;
    
    constructor() {
        super('TITLE_SCREEN');
    }
    
    public enter(_data?: any): void {
        console.log('TitleState: Entering title screen');
        
        // Hide message box
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
        
        // Update game state
        gameState.currentGameState = 'TITLE_SCREEN';
        
        // Hide other screens
        if (UI.hideHighScoreDisplayScreen) {
            UI.hideHighScoreDisplayScreen();
        }
        this.hideDemoPlayScreen();
        
        // Clear entities and load high score
        clearEntities();
        loadHighScore();
        
        // Setup title screen UI
        if (UI.setupTitleScreen) {
            UI.setupTitleScreen();
        }
        
        // Initialize timers
        this.attractModeTimer = GameConfig.TITLE_SCREEN_DURATION || 300;
        this.insertCoinFlashTimer = 0;
        
        // Handle test mode
        if (window.location.hash === '#test') {
            this.attractModeTimer = 1;
        }
        
        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }
        
        // Emit state-specific event
        this.emitStateEvent('entered');
    }
    
    public exit(_data?: any): void {
        console.log('TitleState: Exiting title screen');
        
        // Hide title screen UI
        if (UI.hideTitleScreen) {
            UI.hideTitleScreen();
        }
        
        // Emit state-specific event
        this.emitStateEvent('exited');
    }
    
    public update(deltaTime: number): void {
        // Normalize delta time for consistent timing
        const normalizedDelta = deltaTime / (1000 / 60);
        
        // Update insert coin flash timer
        this.insertCoinFlashTimer += normalizedDelta;
        
        // Update flashing text visibility
        const flashInterval = GameConfig.INSERT_COIN_FLASH_INTERVAL || 30;
        const shouldShow = Math.floor(this.insertCoinFlashTimer / flashInterval) % 2 === 0;
        
        if (UI.insertCoinText && typeof UI.insertCoinText.visible !== 'undefined') {
            UI.insertCoinText.visible = shouldShow;
        }
        if (UI.pressStartText && typeof UI.pressStartText.visible !== 'undefined') {
            UI.pressStartText.visible = shouldShow;
        }
        
        // Update attract mode timer
        this.attractModeTimer -= normalizedDelta;
        if (this.attractModeTimer <= 0) {
            // Transition to high score display
            this.requestTransition('HIGH_SCORE_DISPLAY_SCREEN');
        }
    }
    
    public render(): void {
        // Title screen rendering is handled by UI system
        // This method can be used for additional rendering if needed
    }
    
    public handleInput(inputEvent: any): void {
        // Handle start game input
        if (inputEvent.type === 'input:start' && inputEvent.data.pressed) {
            console.log('TitleState: Start game input received');
            this.startGame();
        }
        
        // Handle select input (also starts game)
        if (inputEvent.type === 'input:select' && inputEvent.data.pressed) {
            console.log('TitleState: Select input received');
            this.startGame();
        }
        
        // Handle keyboard input for game start
        if (inputEvent.type === 'keydown') {
            const key = inputEvent.data.key;
            if (key === 'Enter' || key === ' ' || key === 'Escape') {
                console.log('TitleState: Keyboard start input received:', key);
                this.startGame();
            }
        }
    }
    
    /**
     * Start the game from title screen
     */
    private startGame(): void {
        console.log('TitleState: Starting game');
        
        // Reset game state for new game
        gameState.score = 0;
        gameState.lives = 3;
        gameState.wave = 0; // Will be set to 1 in PlayingState.startNewGame()
        gameState.currentHumanRescueBonus = 1000;
        gameState.humanRescueBonusDecayTimer = 0;
        gameState.nextExtraLifeScore = 25000;
        gameState.playerInvulnerableTime = 0;
        
        // Emit game start event
        gameEvents.emit({
            type: 'game:start_requested',
            timestamp: Date.now(),
            source: this.name,
            data: {}
        });
        
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
            console.warn('TitleState: Could not hide demo play screen:', error);
        });
    }
}