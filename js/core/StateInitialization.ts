/**
 * StateInitialization - Sets up the GameStateManager with all game states
 * 
 * This module initializes all game states and integrates the state manager
 * with the existing game systems
 */

import { gameStateManager } from './GameStateManager';
import { TitleState } from './states/TitleState';
import { HighScoreDisplayState } from './states/HighScoreDisplayState';
import { DemoPlayState } from './states/DemoPlayState';
import { PlayingState } from './states/PlayingState';
import { GameOverState } from './states/GameOverState';
import { PausedState } from './states/PausedState';
import { gameEvents } from './EventSystem';

/**
 * Initialize the game state system
 * Sets up all states and their transitions
 */
export function initializeGameStates(): boolean {
    try {
        console.log('StateInitialization: Setting up game states...');
        
        // Create and register all game states
        const titleState = new TitleState();
        const highScoreState = new HighScoreDisplayState();
        const demoPlayState = new DemoPlayState();
        const playingState = new PlayingState();
        const gameOverState = new GameOverState();
        const pausedState = new PausedState();
        
        // Register states with the manager
        gameStateManager.registerState('TITLE_SCREEN', titleState);
        gameStateManager.registerState('HIGH_SCORE_DISPLAY_SCREEN', highScoreState);
        gameStateManager.registerState('DEMO_PLAY', demoPlayState);
        gameStateManager.registerState('PLAYING', playingState);
        gameStateManager.registerState('GAME_OVER', gameOverState);
        gameStateManager.registerState('PAUSED', pausedState);
        
        // Set up event listeners for game events
        setupGameEventListeners();
        
        // Set up input event forwarding
        setupInputEventForwarding();
        
        console.log('StateInitialization: Game states initialized successfully');
        return true;
        
    } catch (error) {
        console.error('StateInitialization: Failed to initialize game states:', error);
        return false;
    }
}

/**
 * Start the state system with the initial state
 */
export function startGameStateSystem(): boolean {
    try {
        console.log('StateInitialization: Starting game state system...');
        
        // Start with title screen
        const success = gameStateManager.transitionTo('TITLE_SCREEN');
        
        if (success) {
            console.log('StateInitialization: Game state system started successfully');
        } else {
            console.error('StateInitialization: Failed to start with title screen');
        }
        
        return success;
        
    } catch (error) {
        console.error('StateInitialization: Failed to start game state system:', error);
        return false;
    }
}

/**
 * Set up event listeners for game-wide events
 */
function setupGameEventListeners(): void {
    // Listen for game start requests from any state
    gameEvents.on('game:start_requested', (event) => {
        console.log('StateInitialization: Game start requested from', event.source);
        gameStateManager.transitionTo('PLAYING');
    });
    
    // Listen for state change events for debugging
    gameEvents.on('state:changed', (event) => {
        console.log('StateInitialization: State changed from', event.data.previousState, 'to', event.data.newState);
    });
    
    // Listen for game over events
    gameEvents.on('game:game_over', (_event) => {
        console.log('StateInitialization: Game over event received');
        // Game over transition is handled by the PlayingState
    });
    
    // Listen for player death events
    gameEvents.on('game:player_died', (event) => {
        console.log('StateInitialization: Player died, lives remaining:', event.data.remainingLives);
        // Death handling is managed by the PlayingState
    });
}

/**
 * Set up input event forwarding to the current state
 */
function setupInputEventForwarding(): void {
    // Forward input events to the current state
    gameEvents.on('input:start', (event) => {
        gameStateManager.handleInput(event);
    });
    
    gameEvents.on('input:select', (event) => {
        gameStateManager.handleInput(event);
    });
    
    gameEvents.on('input:pause', (event) => {
        gameStateManager.handleInput(event);
    });
    
    // Forward keyboard events
    document.addEventListener('keydown', (event) => {
        const inputEvent = {
            type: 'keydown',
            data: {
                key: event.key,
                code: event.code,
                pressed: true
            }
        };
        gameStateManager.handleInput(inputEvent);
    });
    
    document.addEventListener('keyup', (event) => {
        const inputEvent = {
            type: 'keyup',
            data: {
                key: event.key,
                code: event.code,
                pressed: false
            }
        };
        gameStateManager.handleInput(inputEvent);
    });
}

/**
 * Get the current state for debugging
 */
export function getCurrentGameState(): string | null {
    return gameStateManager.getCurrentStateName();
}

/**
 * Get debug information about the state system
 */
export function getStateSystemDebugInfo(): any {
    return {
        gameStateManager: gameStateManager.getDebugInfo(),
        currentState: getCurrentGameState()
    };
}

/**
 * Update the state system (called from main game loop)
 */
export function updateGameStateSystem(deltaTime: number): void {
    gameStateManager.update(deltaTime);
}

/**
 * Render the current state (called from main game loop)
 */
export function renderGameStateSystem(): void {
    gameStateManager.render();
}

/**
 * Force a state transition (for debugging or special cases)
 */
export function forceStateTransition(stateName: string, data?: any): boolean {
    return gameStateManager.transitionTo(stateName, data);
}

// Make state system available globally for debugging
if (typeof window !== 'undefined') {
    (window as any).gameStateDebug = {
        getCurrentState: getCurrentGameState,
        getDebugInfo: getStateSystemDebugInfo,
        forceTransition: forceStateTransition,
        manager: gameStateManager
    };
    
    console.log('StateInitialization: Debug interface available at window.gameStateDebug');
}