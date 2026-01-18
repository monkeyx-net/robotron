/**
 * GameStateManager - Implements State pattern for game state management
 * 
 * This system provides clean state transitions and encapsulates state-specific
 * behavior for different game modes (Title, Playing, GameOver, etc.)
 */

import { gameEvents } from './EventSystem';

/**
 * Base interface for all game states
 * Each state must implement these methods to handle its lifecycle
 */
export interface IGameState {
    /**
     * Called when entering this state
     * Use for initialization and setup
     * @param data - Optional data passed during state transition
     */
    enter(data?: any): void;

    /**
     * Called when exiting this state
     * Use for cleanup and teardown
     * @param data - Optional data passed during state transition
     */
    exit(data?: any): void;

    /**
     * Called every frame while this state is active
     * @param deltaTime - Time elapsed since last update in milliseconds
     */
    update(deltaTime: number): void;

    /**
     * Called every frame for rendering while this state is active
     */
    render(): void;

    /**
     * Handle input events specific to this state
     * @param inputEvent - The input event to handle
     */
    handleInput(inputEvent: any): void;

    /**
     * Get the name/type of this state for debugging
     */
    getName(): string;
}

/**
 * Manages game state transitions using the State pattern
 * Ensures clean transitions and proper state lifecycle management
 */
export class GameStateManager {
    private static instance: GameStateManager;
    private currentState: IGameState | null = null;
    private states: Map<string, IGameState> = new Map();
    private transitionInProgress = false;
    
    private constructor() {
        // Set up event listeners for state transition requests
        gameEvents.on('state:transition', (event) => {
            this.transitionTo(event.data.stateName, event.data.data);
        });
    }
    
    /**
     * Get the singleton instance of GameStateManager
     */
    public static getInstance(): GameStateManager {
        if (!GameStateManager.instance) {
            GameStateManager.instance = new GameStateManager();
        }
        return GameStateManager.instance;
    }
    
    /**
     * Register a state with the manager
     * @param name - Unique name for the state
     * @param state - The state instance to register
     */
    public registerState(name: string, state: IGameState): void {
        if (this.states.has(name)) {
            console.warn(`GameStateManager: State '${name}' is already registered, overwriting`);
        }
        this.states.set(name, state);
        console.log(`GameStateManager: Registered state '${name}'`);
    }
    
    /**
     * Transition to a new state
     * @param stateName - Name of the state to transition to
     * @param transitionData - Optional data to pass to the new state
     */
    public transitionTo(stateName: string, transitionData?: any): boolean {
        if (this.transitionInProgress) {
            console.warn(`GameStateManager: Transition already in progress, ignoring transition to '${stateName}'`);
            return false;
        }
        
        const newState = this.states.get(stateName);
        if (!newState) {
            console.error(`GameStateManager: State '${stateName}' not found`);
            return false;
        }
        
        // Validate transition (can be extended with transition rules)
        if (!this.validateTransition(this.currentState?.getName() || null, stateName)) {
            console.warn(`GameStateManager: Invalid transition from '${this.currentState?.getName()}' to '${stateName}'`);
            return false;
        }
        
        this.transitionInProgress = true;
        
        try {
            // Exit current state with transition data
            if (this.currentState) {
                console.log(`GameStateManager: Exiting state '${this.currentState.getName()}'`);
                this.currentState.exit(transitionData);
            }

            // Set new state
            const previousState = this.currentState;
            this.currentState = newState;

            // Enter new state with transition data
            console.log(`GameStateManager: Entering state '${stateName}'`);
            this.currentState.enter(transitionData);

            // Emit transition event
            gameEvents.emit({
                type: 'state:changed',
                timestamp: Date.now(),
                source: 'GameStateManager',
                data: {
                    previousState: previousState?.getName() || null,
                    newState: stateName,
                    transitionData
                }
            });

            this.transitionInProgress = false;
            return true;

        } catch (error) {
            console.error(`GameStateManager: Error during transition to '${stateName}':`, error);
            this.transitionInProgress = false;
            return false;
        }
    }
    
    /**
     * Update the current state
     * @param deltaTime - Time elapsed since last update in milliseconds
     */
    public update(deltaTime: number): void {
        if (this.currentState && !this.transitionInProgress) {
            try {
                this.currentState.update(deltaTime);
            } catch (error) {
                console.error(`GameStateManager: Error updating state '${this.currentState.getName()}':`, error);
            }
        }
    }
    
    /**
     * Render the current state
     */
    public render(): void {
        if (this.currentState && !this.transitionInProgress) {
            try {
                this.currentState.render();
            } catch (error) {
                console.error(`GameStateManager: Error rendering state '${this.currentState.getName()}':`, error);
            }
        }
    }
    
    /**
     * Handle input for the current state
     * @param inputEvent - The input event to handle
     */
    public handleInput(inputEvent: any): void {
        if (this.currentState && !this.transitionInProgress) {
            try {
                this.currentState.handleInput(inputEvent);
            } catch (error) {
                console.error(`GameStateManager: Error handling input in state '${this.currentState.getName()}':`, error);
            }
        }
    }
    
    /**
     * Get the current state name
     */
    public getCurrentStateName(): string | null {
        return this.currentState?.getName() || null;
    }
    
    /**
     * Get the current state instance
     */
    public getCurrentState(): IGameState | null {
        return this.currentState;
    }
    
    /**
     * Check if a transition is currently in progress
     */
    public isTransitioning(): boolean {
        return this.transitionInProgress;
    }
    
    /**
     * Validate if a state transition is allowed
     * Can be extended with more complex transition rules
     * @param fromState - Current state name (null if no current state)
     * @param toState - Target state name
     */
    private validateTransition(fromState: string | null, toState: string): boolean {
        // Basic validation - prevent transitioning to the same state
        if (fromState === toState) {
            return false;
        }
        
        // Add more complex transition rules here if needed
        // For now, allow all transitions except to the same state
        return true;
    }
    
    /**
     * Get debug information about the state manager
     */
    public getDebugInfo(): any {
        return {
            currentState: this.currentState?.getName() || null,
            registeredStates: Array.from(this.states.keys()),
            transitionInProgress: this.transitionInProgress
        };
    }
}

/**
 * Abstract base class for game states
 * Provides common functionality and enforces the interface
 */
export abstract class BaseGameState implements IGameState {
    protected name: string;
    
    constructor(name: string) {
        this.name = name;
    }
    
    public getName(): string {
        return this.name;
    }
    
    // Abstract methods that must be implemented by subclasses
    public abstract enter(data?: any): void;
    public abstract exit(data?: any): void;
    public abstract update(deltaTime: number): void;
    public abstract render(): void;
    public abstract handleInput(inputEvent: any): void;
    
    /**
     * Helper method to emit state-specific events
     */
    protected emitStateEvent(eventType: string, data?: any): void {
        gameEvents.emit({
            type: `state:${this.name}:${eventType}`,
            timestamp: Date.now(),
            source: this.name,
            data: data || {}
        });
    }
    
    /**
     * Helper method to request a state transition
     */
    protected requestTransition(stateName: string, data?: any): void {
        gameEvents.emit({
            type: 'state:transition',
            timestamp: Date.now(),
            source: this.name,
            data: { stateName, data }
        });
    }
}

// Export singleton instance for easy access
export const gameStateManager = GameStateManager.getInstance();