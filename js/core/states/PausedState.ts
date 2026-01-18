/**
 * PausedState - Handles the paused game state
 * 
 * Pauses gameplay and shows pause screen, allows resuming or returning to title
 */

import { BaseGameState } from '../GameStateManager';
import { gameState } from '../../gameState';
import { UI } from '../../ui';

export class PausedState extends BaseGameState {
    private previousGameState: string = 'PLAYING';
    
    constructor() {
        super('PAUSED');
    }
    
    public enter(data?: any): void {
        console.log('PausedState: Entering pause', data);

        // Store the previous game state
        this.previousGameState = gameState.currentGameState;

        // Update game state
        gameState.currentGameState = 'PAUSED';

        // Show pause screen
        this.showPauseScreen();

        // Resize game
        if (UI.resizeGame) {
            UI.resizeGame();
        }

        // Emit state-specific event
        this.emitStateEvent('entered', {
            previousState: this.previousGameState
        });
    }

    public exit(data?: any): void {
        console.log('PausedState: Exiting pause', data);

        // Hide pause screen
        this.hidePauseScreen();

        // Emit state-specific event
        this.emitStateEvent('exited', {
            resumingState: this.previousGameState
        });
    }
    
    public update(deltaTime: number): void {
        // No game updates while paused
        // Only update pause screen animations if any
    }
    
    public render(): void {
        // Pause screen rendering is handled by the message box
        // Game rendering is paused
    }
    
    public handleInput(inputEvent: any): void {
        // Handle resume input
        if (inputEvent.type === 'input:pause' && inputEvent.data.pressed) {
            console.log('PausedState: Resume input received');
            this.resumeGame();
        }
        
        // Handle start input to resume
        if (inputEvent.type === 'input:start' && inputEvent.data.pressed) {
            console.log('PausedState: Start input received');
            this.resumeGame();
        }
        
        // Handle keyboard input
        if (inputEvent.type === 'keydown') {
            const key = inputEvent.data.key;
            
            if (key === 'Escape' || key === 'p' || key === 'P') {
                console.log('PausedState: Resume key pressed:', key);
                this.resumeGame();
            }
            
            if (key === 'Enter' || key === ' ') {
                console.log('PausedState: Resume key pressed:', key);
                this.resumeGame();
            }
            
            // Handle quit to title
            if (key === 'q' || key === 'Q') {
                console.log('PausedState: Quit to title requested');
                this.quitToTitle();
            }
        }
    }
    
    /**
     * Resume the game
     */
    private resumeGame(): void {
        console.log('PausedState: Resuming game');

        // Emit resume event
        this.emitStateEvent('game_resumed');

        // Return to the previous game state
        if (this.previousGameState === 'PLAYING') {
            // Pass resuming flag to prevent PlayingState from reinitializing
            this.requestTransition('PLAYING', { resuming: true });
        } else {
            // Default to title screen if previous state is unknown
            this.requestTransition('TITLE_SCREEN');
        }
    }
    
    /**
     * Quit to title screen
     */
    private quitToTitle(): void {
        console.log('PausedState: Quitting to title screen');
        
        // Emit quit event
        this.emitStateEvent('quit_to_title');
        
        // Transition to title screen
        this.requestTransition('TITLE_SCREEN');
    }
    
    /**
     * Show the pause screen
     */
    private showPauseScreen(): void {
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'block';
            
            let message = `GAME PAUSED<br><br>`;
            message += `Score: ${gameState.score.toLocaleString()}<br>`;
            message += `Lives: ${gameState.lives}<br>`;
            message += `Wave: ${gameState.wave}<br><br>`;
            message += `Press ESCAPE or P to resume<br>`;
            message += `Press Q to quit to title`;
            
            messageBox.innerHTML = message;
        }
    }
    
    /**
     * Hide the pause screen
     */
    private hidePauseScreen(): void {
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.style.display = 'none';
        }
    }
}