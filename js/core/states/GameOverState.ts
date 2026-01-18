/**
 * GameOverState - Handles the game over state
 * 
 * Shows game over screen, handles high score entry, and transitions back to attract mode
 */

import { BaseGameState } from '../GameStateManager';
import { gameState } from '../../gameState';
import { UI } from '../../ui';
import { clearEntities, saveHighScore } from '../../gameLogic';
import { gameEvents } from '../EventSystem';

export class GameOverState extends BaseGameState {
    private gameOverTimer: number = 0;
    private highScoreEntered: boolean = false;
    private isNewHighScore: boolean = false;
    
    constructor() {
        super('GAME_OVER');
    }
    
    public enter(data?: any): void {
        console.log('GameOverState: Entering game over');
        
        // Update game state
        gameState.currentGameState = 'GAME_OVER';
        
        // Hide other screens
        if (UI.hideTitleScreen) {
            UI.hideTitleScreen();
        }
        if (UI.hideHighScoreDisplayScreen) {
            UI.hideHighScoreDisplayScreen();
        }
        this.hideDemoPlayScreen();
        
        // Check if this is a new high score
        this.isNewHighScore = gameState.score > gameState.highScore;
        
        if (this.isNewHighScore) {
            console.log('GameOverState: New high score achieved!', gameState.score);
            gameState.highScore = gameState.score;
            saveHighScore();
        }
        
        // Show game over screen
        this.showGameOverScreen();
        
        // Initialize timer for automatic return to attract mode
        this.gameOverTimer = 10000; // 10 seconds
        this.highScoreEntered = false;
        
        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }
        
        // Emit state-specific event
        this.emitStateEvent('entered', {
            finalScore: gameState.score,
            finalWave: gameState.wave,
            isNewHighScore: this.isNewHighScore
        });
        
        // Emit game over event
        gameEvents.emit({
            type: 'game:game_over',
            timestamp: Date.now(),
            source: this.name,
            data: {
                finalScore: gameState.score,
                finalWave: gameState.wave,
                isNewHighScore: this.isNewHighScore,
                highScore: gameState.highScore
            }
        });
    }
    
    public exit(data?: any): void {
        console.log('GameOverState: Exiting game over');
        
        // Hide game over screen
        this.hideGameOverScreen();
        
        // Clear entities
        clearEntities();
        
        // Emit state-specific event
        this.emitStateEvent('exited');
    }
    
    public update(deltaTime: number): void {
        // Normalize delta time for consistent timing
        const normalizedDelta = deltaTime / (1000 / 60);
        
        // Update timer for automatic return to attract mode
        if (!this.isNewHighScore || this.highScoreEntered) {
            this.gameOverTimer -= normalizedDelta;
            if (this.gameOverTimer <= 0) {
                // Return to title screen
                this.requestTransition('TITLE_SCREEN');
            }
        }
        
        // Update any game over screen animations or effects
        this.updateGameOverScreen(normalizedDelta);
    }
    
    public render(): void {
        // Game over rendering is handled by UI system
        // This method can be used for additional rendering if needed
    }
    
    public handleInput(inputEvent: any): void {
        // Handle start game input to return to title
        if (inputEvent.type === 'input:start' && inputEvent.data.pressed) {
            console.log('GameOverState: Start input received');
            this.returnToTitle();
        }
        
        // Handle select input
        if (inputEvent.type === 'input:select' && inputEvent.data.pressed) {
            console.log('GameOverState: Select input received');
            this.returnToTitle();
        }
        
        // Handle keyboard input
        if (inputEvent.type === 'keydown') {
            const key = inputEvent.data.key;
            
            if (key === 'Enter' || key === ' ' || key === 'Escape') {
                console.log('GameOverState: Keyboard input received:', key);
                this.returnToTitle();
            }
            
            // Handle high score name entry if applicable
            if (this.isNewHighScore && !this.highScoreEntered) {
                this.handleHighScoreNameEntry(key);
            }
        }
    }
    
    /**
     * Return to title screen
     */
    private returnToTitle(): void {
        console.log('GameOverState: Returning to title screen');
        
        // Mark high score as entered if it was a new high score
        if (this.isNewHighScore) {
            this.highScoreEntered = true;
        }
        
        // Emit return to title event
        this.emitStateEvent('return_to_title');
        
        // Transition to title screen
        this.requestTransition('TITLE_SCREEN');
    }
    
    /**
     * Show the game over screen
     */
    private showGameOverScreen(): void {
        // Show message box with game over message
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'block';
            
            let message = `GAME OVER<br><br>`;
            message += `Final Score: ${gameState.score.toLocaleString()}<br>`;
            message += `Wave Reached: ${gameState.wave}<br><br>`;
            
            if (this.isNewHighScore) {
                message += `🎉 NEW HIGH SCORE! 🎉<br><br>`;
            }
            
            message += `Press START or ENTER to continue`;
            
            messageBox.innerHTML = message;
        }
        
        // Update score display one final time
        if (UI.updateScoreDisplay) {
            UI.updateScoreDisplay();
        }
    }
    
    /**
     * Hide the game over screen
     */
    private hideGameOverScreen(): void {
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
    }
    
    /**
     * Update game over screen animations
     */
    private updateGameOverScreen(deltaTime: number): void {
        // Add any game over screen animations here
        // For example, flashing text, score counting animations, etc.
    }
    
    /**
     * Handle high score name entry
     */
    private handleHighScoreNameEntry(key: string): void {
        // This is a placeholder for high score name entry functionality
        // In a full implementation, this would handle character input
        // for entering the player's name for the high score table
        
        if (key === 'Enter') {
            console.log('GameOverState: High score name entry completed');
            this.highScoreEntered = true;
            
            // Emit high score entered event
            gameEvents.emit({
                type: 'game:high_score_entered',
                timestamp: Date.now(),
                source: this.name,
                data: {
                    score: gameState.score,
                    playerName: 'PLAYER' // Placeholder name
                }
            });
        }
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
            console.warn('GameOverState: Could not hide demo play screen:', error);
        });
    }
}