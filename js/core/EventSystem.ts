/**
 * EventSystem - Observer pattern implementation for game events
 * 
 * This module provides a robust event system for the Robotron game using the Observer pattern.
 * It allows different game systems to communicate without tight coupling, supporting
 * type-safe events, priority handling, and event filtering.
 */

/**
 * Base interface for all game events
 */
export interface GameEvent {
    type: string;
    timestamp: number;
    source?: string;
    data?: any;
}

/**
 * Event listener function type
 */
export type EventListener<T extends GameEvent = GameEvent> = (event: T) => void;

/**
 * Event subscription with priority and filtering
 */
export interface EventSubscription {
    id: string;
    listener: EventListener;
    priority: number;
    filter?: (event: GameEvent) => boolean;
    once?: boolean;
    active: boolean;
}

/**
 * Event queue entry for deferred processing
 */
export interface QueuedEvent {
    event: GameEvent;
    timestamp: number;
    delay?: number;
}

/**
 * Game-specific event types
 */
export interface PlayerDeathEvent extends GameEvent {
    type: 'player:death';
    data: {
        position: { x: number; y: number };
        cause: string;
        livesRemaining: number;
    };
}

export interface EnemyDestroyedEvent extends GameEvent {
    type: 'enemy:destroyed';
    data: {
        enemyType: string;
        position: { x: number; y: number };
        points: number;
        destroyedBy: string;
    };
}

export interface HumanRescuedEvent extends GameEvent {
    type: 'human:rescued';
    data: {
        humanType: string;
        position: { x: number; y: number };
        bonus: number;
        rescueStreak: number;
    };
}

/**
 * EventEmitter class implementing the Observer pattern
 */
export class EventEmitter {
    private subscriptions: Map<string, EventSubscription[]> = new Map();
    private eventQueue: QueuedEvent[] = [];
    private nextSubscriptionId: number = 1;
    private isProcessingQueue: boolean = false;
    private maxQueueSize: number = 1000;
    private eventHistory: GameEvent[] = [];
    private maxHistorySize: number = 100;
    
    /**
     * Subscribe to an event type
     */
    subscribe<T extends GameEvent>(
        eventType: string,
        listener: EventListener<T>,
        options: {
            priority?: number;
            filter?: (event: T) => boolean;
            once?: boolean;
        } = {}
    ): string {
        const subscription: EventSubscription = {
            id: `sub_${this.nextSubscriptionId++}`,
            listener: listener as EventListener,
            priority: options.priority || 0,
            filter: options.filter as ((event: GameEvent) => boolean) | undefined,
            once: options.once || false,
            active: true
        };
        
        if (!this.subscriptions.has(eventType)) {
            this.subscriptions.set(eventType, []);
        }
        
        const subs = this.subscriptions.get(eventType)!;
        subs.push(subscription);
        
        // Sort by priority (higher priority first)
        subs.sort((a, b) => b.priority - a.priority);
        
        return subscription.id;
    }
    
    /**
     * Alias for subscribe (for compatibility)
     */
    on<T extends GameEvent>(
        eventType: string,
        listener: EventListener<T>,
        options: {
            priority?: number;
            filter?: (event: T) => boolean;
            once?: boolean;
        } = {}
    ): string {
        return this.subscribe(eventType, listener, options);
    }
    
    /**
     * Unsubscribe from an event
     */
    unsubscribe(subscriptionId: string): boolean {
        for (const [eventType, subs] of this.subscriptions) {
            const index = subs.findIndex(sub => sub.id === subscriptionId);
            if (index !== -1) {
                subs.splice(index, 1);
                if (subs.length === 0) {
                    this.subscriptions.delete(eventType);
                }
                return true;
            }
        }
        return false;
    }
    
    /**
     * Emit an event immediately
     */
    emit<T extends GameEvent>(event: T): number {
        // Add timestamp if not present
        if (!event.timestamp) {
            event.timestamp = Date.now();
        }
        
        // Add to event history
        this.addToHistory(event);
        
        const subs = this.subscriptions.get(event.type);
        if (!subs || subs.length === 0) {
            return 0;
        }
        
        let notifiedCount = 0;
        const subsToRemove: number[] = [];
        
        for (let i = 0; i < subs.length; i++) {
            const sub = subs[i];
            
            if (!sub.active) {
                continue;
            }
            
            // Apply filter if present
            if (sub.filter && !sub.filter(event)) {
                continue;
            }
            
            try {
                sub.listener(event);
                notifiedCount++;
                
                // Mark for removal if it's a one-time subscription
                if (sub.once) {
                    subsToRemove.push(i);
                }
            } catch (error) {
                console.error(`Error in event listener for ${event.type}:`, error);
                // Optionally disable the problematic listener
                sub.active = false;
            }
        }
        
        // Remove one-time subscriptions (in reverse order to maintain indices)
        for (let i = subsToRemove.length - 1; i >= 0; i--) {
            subs.splice(subsToRemove[i], 1);
        }
        
        return notifiedCount;
    }
    
    /**
     * Get the number of active subscriptions for an event type
     */
    getSubscriptionCount(eventType: string): number {
        const subs = this.subscriptions.get(eventType);
        return subs ? subs.filter(sub => sub.active).length : 0;
    }
    
    /**
     * Clear all subscriptions and queued events
     */
    clear(): void {
        this.subscriptions.clear();
        this.eventQueue.length = 0;
        this.eventHistory.length = 0;
        this.nextSubscriptionId = 1;
    }
    
    /**
     * Add event to history
     */
    private addToHistory(event: GameEvent): void {
        this.eventHistory.push({ ...event });
        
        // Trim history if it gets too large
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
}

/**
 * Global event system instance
 */
export const gameEvents = new EventEmitter();

/**
 * Event system utilities
 */
export const EventUtils = {
    /**
     * Create a player death event
     */
    createPlayerDeathEvent(
        position: { x: number; y: number },
        cause: string,
        livesRemaining: number
    ): PlayerDeathEvent {
        return {
            type: 'player:death',
            timestamp: Date.now(),
            source: 'game',
            data: { position, cause, livesRemaining }
        };
    },
    
    /**
     * Create an enemy destroyed event
     */
    createEnemyDestroyedEvent(
        enemyType: string,
        position: { x: number; y: number },
        points: number,
        destroyedBy: string = 'player'
    ): EnemyDestroyedEvent {
        return {
            type: 'enemy:destroyed',
            timestamp: Date.now(),
            source: 'game',
            data: { enemyType, position, points, destroyedBy }
        };
    },
    
    /**
     * Create a human rescued event
     */
    createHumanRescuedEvent(
        humanType: string,
        position: { x: number; y: number },
        bonus: number,
        rescueStreak: number = 1
    ): HumanRescuedEvent {
        return {
            type: 'human:rescued',
            timestamp: Date.now(),
            source: 'game',
            data: { humanType, position, bonus, rescueStreak }
        };
    }
};