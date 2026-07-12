/**
 * Main Game Module using IIFE pattern
 * Encapsulates the entire Robotron game to prevent global namespace pollution
 */

import { IGameEngine, IGameState } from './interfaces';
import { GameObject } from './GameObject';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';

export const RobotronGame = (() => {
    // Private variables
    let gameEngine: IGameEngine | null = null;
    let currentState: IGameState | null = null;
    let initialized = false;
    let running = false;

    // Private methods
    function validateDependencies(): boolean {
        // Check if required dependencies are available
        if (typeof window === 'undefined') {
            console.error('RobotronGame: Window object not available');
            return false;
        }

        if (typeof document === 'undefined') {
            console.error('RobotronGame: Document object not available');
            return false;
        }

        return true;
    }

    function setupErrorHandling(): void {
        // Global error handler for uncaught exceptions
        window.addEventListener('error', (event) => {
            console.error('RobotronGame: Uncaught error:', event.error);
            // Could emit error event here for centralized error handling
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('RobotronGame: Unhandled promise rejection:', event.reason);
            event.preventDefault();
        });
    }

    function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] RobotronGame: ${message}`;
        
        switch (level) {
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
                break;
        }
    }

    // Public API
    return {
        /**
         * Initialize the game module
         */
        init(): boolean {
            if (initialized) {
                log('Game already initialized', 'warn');
                return true;
            }

            log('Initializing Robotron Game Module...');

            if (!validateDependencies()) {
                log('Failed to validate dependencies', 'error');
                return false;
            }

            setupErrorHandling();

            try {
                // Initialize core systems here
                // This will be expanded as we implement more systems
                
                initialized = true;
                log('Game module initialized successfully');
                return true;
            } catch (error) {
                log(`Failed to initialize game module: ${error}`, 'error');
                return false;
            }
        },

        /**
         * Start the game
         */
        start(): boolean {
            if (!initialized) {
                log('Cannot start game - not initialized', 'error');
                return false;
            }

            if (running) {
                log('Game is already running', 'warn');
                return true;
            }

            try {
                if (gameEngine) {
                    gameEngine.start();
                    running = true;
                    log('Game started successfully');
                    return true;
                } else {
                    log('Cannot start game - no game engine available', 'error');
                    return false;
                }
            } catch (error) {
                log(`Failed to start game: ${error}`, 'error');
                return false;
            }
        },

        /**
         * Stop the game
         */
        stop(): void {
            if (!running) {
                log('Game is not running', 'warn');
                return;
            }

            try {
                if (gameEngine) {
                    gameEngine.stop();
                }
                running = false;
                log('Game stopped');
            } catch (error) {
                log(`Error stopping game: ${error}`, 'error');
            }
        },

        /**
         * Pause the game
         */
        pause(): void {
            if (!running) {
                log('Cannot pause - game is not running', 'warn');
                return;
            }

            try {
                if (gameEngine) {
                    gameEngine.pause();
                    log('Game paused');
                }
            } catch (error) {
                log(`Error pausing game: ${error}`, 'error');
            }
        },

        /**
         * Resume the game
         */
        resume(): void {
            if (!running) {
                log('Cannot resume - game is not running', 'warn');
                return;
            }

            try {
                if (gameEngine) {
                    gameEngine.resume();
                    log('Game resumed');
                }
            } catch (error) {
                log(`Error resuming game: ${error}`, 'error');
            }
        },

        /**
         * Set the game engine
         */
        setGameEngine(engine: IGameEngine): void {
            gameEngine = engine;
            log('Game engine set');
        },

        /**
         * Get the current game state
         */
        getCurrentState(): IGameState | null {
            return currentState;
        },

        /**
         * Set the current game state
         */
        setCurrentState(state: IGameState): void {
            if (currentState) {
                currentState.exit();
            }
            currentState = state;
            if (currentState) {
                currentState.enter();
                log(`Game state changed to: ${currentState.name}`);
            }
        },

        /**
         * Check if the game is initialized
         */
        isInitialized(): boolean {
            return initialized;
        },

        /**
         * Check if the game is running
         */
        isRunning(): boolean {
            return running;
        },

        /**
         * Get version information
         */
        getVersion(): string {
            return '2.0.0-refactored';
        },

        /**
         * Expose utility classes for external use
         */
        Utils: {
            Vector2,
            Rectangle,
            GameObject
        },

        /**
         * Development/debugging utilities
         */
        Debug: {
            log,
            getGameEngine: () => gameEngine,
            getCurrentState: () => currentState,
            getInitialized: () => initialized,
            getRunning: () => running
        }
    };
})();

// Make the game module available globally for backward compatibility
// This can be removed once all code is refactored to use proper imports
if (typeof window !== 'undefined') {
    (window as any).RobotronGame = RobotronGame;
}