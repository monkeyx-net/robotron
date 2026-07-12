/**
 * Human - Human entity implementation using GameObject architecture with improved AI
 * 
 * This module provides the Human class and related components that use the new 
 * GameObject component system with enhanced AI behavior for more realistic human movement and rescue mechanics.
 */

import * as PIXI from 'pixi.js';
import { GameObject, Component, SpriteRenderer, Collider, Rigidbody } from '../core/GameObject';
import { Vector2 } from '../utils/Vector2';
import { Constants } from '../utils/Constants';
import { gameEvents } from '../core/EventSystem';

/**
 * Human types enum
 */
export enum HumanType {
    MAN = 'man',
    WOMAN = 'woman',
    CHILD = 'child'
}

/**
 * Human state enum
 */
export enum HumanState {
    WANDERING = 'wandering',
    FLEEING = 'fleeing',
    FOLLOWING_PLAYER = 'following_player',
    RESCUED = 'rescued',
    BEING_REPROGRAMMED = 'being_reprogrammed',
    CONVERTED_TO_PROG = 'converted_to_prog',
    STOPPED = 'stopped'
}

/**
 * Human AI component for intelligent behavior
 */
export class HumanAI implements Component {
    name: string = 'humanAI';
    gameObject: GameObject;
    enabled: boolean = true;
    
    // AI State
    state: HumanState = HumanState.WANDERING;
    previousState: HumanState = HumanState.WANDERING;
    
    // Targets and awareness
    player: GameObject | null = null;
    nearestThreat: GameObject | null = null;
    fleeTarget: GameObject | null = null;
    
    // AI Parameters
    awarenessRadius: number = 100;
    fleeRadius: number = 80;
    followRadius: number = 60;
    speed: number = 60;
    
    // Timers
    wanderTimer: number = 0;
    wanderChangeInterval: number = 2000; // milliseconds
    stopTimer: number = 0;
    stopDuration: number = 1000;
    stateChangeTimer: number = 0;
    
    // Movement
    wanderDirection: Vector2;
    targetPosition: Vector2;
    
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.wanderDirection = Vector2.random().normalize();
        this.targetPosition = new Vector2(0, 0);
        this.speed = Constants.HUMAN_CONSTANTS?.SPEED || 60;
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        // Update timers
        this.wanderTimer += deltaTime;
        this.stopTimer += deltaTime;
        this.stateChangeTimer += deltaTime;
        
        // Scan for threats and player
        this.scanEnvironment();
        
        // Update AI state
        this.updateState();
        
        // Execute current behavior
        this.executeBehavior(deltaTime);
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    /**
     * Scan environment for threats and player
     */
    private scanEnvironment(): void {
        // This would typically use a spatial query system
        // For now, we'll emit an event to request nearby entities
        gameEvents.emit({
            type: 'human:scan_environment',
            timestamp: Date.now(),
            source: 'HumanAI',
            data: {
                humanId: this.gameObject.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                },
                awarenessRadius: this.awarenessRadius
            }
        });
    }
    
    /**
     * Update AI state based on current situation
     */
    private updateState(): void {
        const previousState = this.state;
        
        // Check for immediate threats
        if (this.nearestThreat && this.getDistanceToThreat() < this.fleeRadius) {
            this.state = HumanState.FLEEING;
        }
        // Check if player is nearby and no immediate threats
        else if (this.player && this.getDistanceToPlayer() < this.followRadius && !this.nearestThreat) {
            this.state = HumanState.FOLLOWING_PLAYER;
        }
        // Check if we should stop occasionally
        else if (this.stopTimer >= this.stopDuration && Math.random() < 0.1) {
            this.state = HumanState.STOPPED;
            this.stopTimer = 0;
        }
        // Default to wandering
        else if (this.state === HumanState.STOPPED && this.stopTimer >= 500) {
            this.state = HumanState.WANDERING;
        }
        
        // Handle state changes
        if (previousState !== this.state) {
            this.onStateChanged(previousState, this.state);
        }
    }
    
    /**
     * Execute behavior based on current state
     */
    private executeBehavior(deltaTime: number): void {
        const rigidbody = this.gameObject.getComponent<Rigidbody>('rigidbody');
        if (!rigidbody) return;
        
        switch (this.state) {
            case HumanState.WANDERING:
                this.wanderBehavior(rigidbody, deltaTime);
                break;
            case HumanState.FLEEING:
                this.fleeBehavior(rigidbody);
                break;
            case HumanState.FOLLOWING_PLAYER:
                this.followPlayerBehavior(rigidbody);
                break;
            case HumanState.STOPPED:
                this.stopBehavior(rigidbody);
                break;
            case HumanState.RESCUED:
            case HumanState.BEING_REPROGRAMMED:
            case HumanState.CONVERTED_TO_PROG:
                // These states are handled by other components
                rigidbody.setVelocity(0, 0);
                break;
        }
    }
    
    /**
     * Wander behavior - random movement with occasional direction changes
     */
    private wanderBehavior(rigidbody: Rigidbody, _deltaTime: number): void {
        // Change direction occasionally
        if (this.wanderTimer >= this.wanderChangeInterval) {
            this.wanderDirection = Vector2.random().normalize();
            this.wanderTimer = 0;
        }
        
        // Check for obstacles in the wander direction
        if (this.isPathBlocked(this.wanderDirection)) {
            this.wanderDirection = this.findClearDirection();
        }
        
        rigidbody.setVelocity(
            this.wanderDirection.x * this.speed * 0.5, // Slower when wandering
            this.wanderDirection.y * this.speed * 0.5
        );
    }
    
    /**
     * Flee behavior - run away from threats
     */
    private fleeBehavior(rigidbody: Rigidbody): void {
        if (!this.nearestThreat) return;
        
        // Calculate flee direction (away from threat)
        const fleeDirection = new Vector2(
            this.gameObject.transform.position.x - this.nearestThreat.transform.position.x,
            this.gameObject.transform.position.y - this.nearestThreat.transform.position.y
        );
        
        if (fleeDirection.magnitude() > 0) {
            fleeDirection.normalize();
            
            // Check if flee path is blocked
            if (this.isPathBlocked(fleeDirection)) {
                // Try to find an alternative escape route
                fleeDirection.set(
                    fleeDirection.x + (Math.random() - 0.5) * 0.5,
                    fleeDirection.y + (Math.random() - 0.5) * 0.5
                );
                fleeDirection.normalize();
            }
            
            rigidbody.setVelocity(
                fleeDirection.x * this.speed, // Full speed when fleeing
                fleeDirection.y * this.speed
            );
        }
    }
    
    /**
     * Follow player behavior - move towards player for rescue
     */
    private followPlayerBehavior(rigidbody: Rigidbody): void {
        if (!this.player) return;
        
        const followDirection = new Vector2(
            this.player.transform.position.x - this.gameObject.transform.position.x,
            this.player.transform.position.y - this.gameObject.transform.position.y
        );
        
        const distance = followDirection.magnitude();
        
        // Don't get too close to the player
        if (distance > 20) {
            followDirection.normalize();
            
            // Check if path to player is blocked
            if (this.isPathBlocked(followDirection)) {
                // Try to find a path around obstacles
                const alternativeDirection = this.findPathAroundObstacle(followDirection);
                if (alternativeDirection) {
                    followDirection.copy(alternativeDirection);
                }
            }
            
            rigidbody.setVelocity(
                followDirection.x * this.speed * 0.8, // Slightly slower when following
                followDirection.y * this.speed * 0.8
            );
        } else {
            rigidbody.setVelocity(0, 0);
        }
    }
    
    /**
     * Stop behavior - remain stationary
     */
    private stopBehavior(rigidbody: Rigidbody): void {
        rigidbody.setVelocity(0, 0);
    }
    
    /**
     * Check if a path in the given direction is blocked
     */
    private isPathBlocked(direction: Vector2): boolean {
        // This would check for obstacles in the path
        // For now, we'll use a simple implementation
        const checkDistance = 30;
        const checkPosition = new Vector2(
            this.gameObject.transform.position.x + direction.x * checkDistance,
            this.gameObject.transform.position.y + direction.y * checkDistance
        );
        
        // Check bounds
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        if (checkPosition.x < 20 || checkPosition.x > bounds.WIDTH - 20 ||
            checkPosition.y < 20 || checkPosition.y > bounds.HEIGHT - 20) {
            return true;
        }
        
        // TODO: Check for obstacles using spatial queries
        return false;
    }
    
    /**
     * Find a clear direction for movement
     */
    private findClearDirection(): Vector2 {
        const directions = [
            new Vector2(1, 0), new Vector2(-1, 0),
            new Vector2(0, 1), new Vector2(0, -1),
            new Vector2(0.707, 0.707), new Vector2(-0.707, 0.707),
            new Vector2(0.707, -0.707), new Vector2(-0.707, -0.707)
        ];
        
        for (const direction of directions) {
            if (!this.isPathBlocked(direction)) {
                return direction;
            }
        }
        
        // If all directions are blocked, return a random direction
        return Vector2.random().normalize();
    }
    
    /**
     * Find a path around an obstacle
     */
    private findPathAroundObstacle(blockedDirection: Vector2): Vector2 | null {
        // Try perpendicular directions
        const perpendicular1 = new Vector2(-blockedDirection.y, blockedDirection.x);
        const perpendicular2 = new Vector2(blockedDirection.y, -blockedDirection.x);
        
        if (!this.isPathBlocked(perpendicular1)) {
            return perpendicular1;
        }
        if (!this.isPathBlocked(perpendicular2)) {
            return perpendicular2;
        }
        
        return null;
    }
    
    /**
     * Get distance to nearest threat
     */
    private getDistanceToThreat(): number {
        if (!this.nearestThreat) return Infinity;
        return this.gameObject.transform.position.distanceTo(this.nearestThreat.transform.position);
    }
    
    /**
     * Get distance to player
     */
    private getDistanceToPlayer(): number {
        if (!this.player) return Infinity;
        return this.gameObject.transform.position.distanceTo(this.player.transform.position);
    }
    
    /**
     * Handle state changes
     */
    private onStateChanged(oldState: HumanState, newState: HumanState): void {
        this.previousState = oldState;
        this.stateChangeTimer = 0;
        
        // Emit state change event
        gameEvents.emit({
            type: 'human:state_changed',
            timestamp: Date.now(),
            source: 'HumanAI',
            data: {
                humanId: this.gameObject.id,
                oldState: oldState,
                newState: newState,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
    }
    
    /**
     * Keep human within game bounds
     */
    private keepInBounds(): void {
        const bounds = Constants.GAME_DIMENSIONS || { WIDTH: 800, HEIGHT: 600 };
        const padding = 20;
        
        const transform = this.gameObject.transform;
        const newX = Math.max(padding, Math.min(bounds.WIDTH - padding, transform.position.x));
        const newY = Math.max(padding, Math.min(bounds.HEIGHT - padding, transform.position.y));
        
        if (newX !== transform.position.x || newY !== transform.position.y) {
            transform.setPosition(newX, newY);
            
            // If we hit a boundary, change wander direction
            if (this.state === HumanState.WANDERING) {
                this.wanderDirection = Vector2.random().normalize();
                this.wanderTimer = 0;
            }
        }
    }
    
    /**
     * Set the player reference
     */
    setPlayer(player: GameObject): void {
        this.player = player;
    }
    
    /**
     * Set the nearest threat
     */
    setNearestThreat(threat: GameObject | null): void {
        this.nearestThreat = threat;
    }
    
    /**
     * Force a state change
     */
    setState(newState: HumanState): void {
        if (this.state !== newState) {
            this.onStateChanged(this.state, newState);
            this.state = newState;
        }
    }
}

/**
 * Human controller component for managing human-specific behavior
 */
export class HumanController implements Component {
    name: string = 'humanController';
    gameObject: GameObject;
    enabled: boolean = true;
    
    // Human properties
    humanType: HumanType;
    isRescued: boolean = false;
    isBeingReprogrammed: boolean = false;
    reprogramProgress: number = 0;
    reprogramDuration: number = 3000; // milliseconds
    points: number;
    
    // Visual effects
    flashTimer: number = 0;
    isFlashing: boolean = false;
    
    constructor(gameObject: GameObject, humanType: HumanType) {
        this.gameObject = gameObject;
        this.humanType = humanType;
        this.points = this.getPointsForType(humanType);
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        // Update reprogramming
        if (this.isBeingReprogrammed) {
            this.updateReprogramming(deltaTime);
        }
        
        // Update visual effects
        if (this.isFlashing) {
            this.updateFlashing(deltaTime);
        }
    }
    
    /**
     * Start the rescue process
     */
    rescue(rescuer: GameObject): void {
        if (this.isRescued || this.isBeingReprogrammed) return;
        
        this.isRescued = true;
        
        // Update AI state
        const ai = this.gameObject.getComponent<HumanAI>('humanAI');
        if (ai) {
            ai.setState(HumanState.RESCUED);
        }
        
        // Emit rescue event
        gameEvents.emit({
            type: 'human:rescued',
            timestamp: Date.now(),
            source: 'HumanController',
            data: {
                humanId: this.gameObject.id,
                humanType: this.humanType,
                rescuerId: rescuer.id,
                points: this.points,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        // Start visual effect
        this.startFlashing();
        
        // Destroy after a short delay
        setTimeout(() => {
            this.gameObject.destroy();
        }, 500);
    }
    
    /**
     * Start the reprogramming process
     */
    startReprogramming(reprogrammer: GameObject): void {
        if (this.isRescued || this.isBeingReprogrammed) return;
        
        this.isBeingReprogrammed = true;
        this.reprogramProgress = 0;
        
        // Update AI state
        const ai = this.gameObject.getComponent<HumanAI>('humanAI');
        if (ai) {
            ai.setState(HumanState.BEING_REPROGRAMMED);
        }
        
        // Emit reprogramming started event
        gameEvents.emit({
            type: 'human:reprogramming_started',
            timestamp: Date.now(),
            source: 'HumanController',
            data: {
                humanId: this.gameObject.id,
                reprogrammerId: reprogrammer.id,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        // Start visual effect
        this.startFlashing();
    }
    
    /**
     * Update reprogramming progress
     */
    private updateReprogramming(deltaTime: number): void {
        this.reprogramProgress += deltaTime;
        
        if (this.reprogramProgress >= this.reprogramDuration) {
            this.completeReprogramming();
        }
    }
    
    /**
     * Complete the reprogramming process
     */
    private completeReprogramming(): void {
        // Emit conversion event
        gameEvents.emit({
            type: 'human:converted_to_prog',
            timestamp: Date.now(),
            source: 'HumanController',
            data: {
                humanId: this.gameObject.id,
                humanType: this.humanType,
                position: {
                    x: this.gameObject.transform.position.x,
                    y: this.gameObject.transform.position.y
                }
            }
        });
        
        // This would typically create a Prog enemy and destroy the human
        this.gameObject.destroy();
    }
    
    /**
     * Start flashing visual effect
     */
    private startFlashing(): void {
        this.isFlashing = true;
        this.flashTimer = 0;
    }
    
    /**
     * Update flashing effect
     */
    private updateFlashing(deltaTime: number): void {
        this.flashTimer += deltaTime;
        
        const spriteRenderer = this.gameObject.getComponent<SpriteRenderer>('spriteRenderer');
        if (spriteRenderer) {
            // Flash between normal and bright
            const flashSpeed = 200; // milliseconds
            const alpha = 0.5 + 0.5 * Math.sin((this.flashTimer / flashSpeed) * Math.PI * 2);
            spriteRenderer.setAlpha(alpha);
        }
        
        // Stop flashing after a while
        if (this.flashTimer >= 2000) {
            this.isFlashing = false;
            const spriteRenderer = this.gameObject.getComponent<SpriteRenderer>('spriteRenderer');
            if (spriteRenderer) {
                spriteRenderer.setAlpha(1.0);
            }
        }
    }
    
    /**
     * Get points value for human type
     */
    private getPointsForType(type: HumanType): number {
        switch (type) {
            case HumanType.MAN:
                return 1000;
            case HumanType.WOMAN:
                return 1000;
            case HumanType.CHILD:
                return 2000; // Children are worth more points
            default:
                return 1000;
        }
    }
    
    /**
     * Handle collision with other objects
     */
    onCollisionEnter(other: GameObject): void {
        if (!this.enabled) return;
        
        switch (other.tag) {
            case 'player':
                if (!this.isRescued && !this.isBeingReprogrammed) {
                    this.rescue(other);
                }
                break;
            case 'brain':
                if (!this.isRescued && !this.isBeingReprogrammed) {
                    this.startReprogramming(other);
                }
                break;
        }
    }
}

/**
 * Human factory for creating human game objects
 */
export class HumanFactory {
    /**
     * Create a human game object
     */
    static createHuman(
        texture: PIXI.Texture,
        x: number,
        y: number,
        humanType: HumanType = HumanType.MAN
    ): GameObject {
        // Create the base game object
        const human = new GameObject('Human');
        human.tag = 'human';
        human.layer = 1;
        
        // Set initial position
        human.transform.setPosition(x, y);
        
        // Add sprite renderer
        const spriteRenderer = new SpriteRenderer(human, texture);
        
        // Set color based on human type
        switch (humanType) {
            case HumanType.MAN:
                spriteRenderer.setTint(0xF0F0F0); // Light gray
                break;
            case HumanType.WOMAN:
                spriteRenderer.setTint(0xFF69B4); // Pink
                break;
            case HumanType.CHILD:
                spriteRenderer.setTint(0x40E0D0); // Teal
                break;
        }
        
        human.addComponent(spriteRenderer);
        
        // Add collider
        const collider = new Collider(human, 12, 12, true); // Trigger collider for rescue
        human.addComponent(collider);
        
        // Add rigidbody for physics
        const rigidbody = new Rigidbody(human);
        rigidbody.drag = 0.9; // Some drag for smooth movement
        human.addComponent(rigidbody);
        
        // Add human-specific components
        const humanAI = new HumanAI(human);
        human.addComponent(humanAI);
        
        const humanController = new HumanController(human, humanType);
        human.addComponent(humanController);
        
        // Emit creation event
        gameEvents.emit({
            type: 'human:created',
            timestamp: Date.now(),
            source: 'HumanFactory',
            data: {
                humanId: human.id,
                humanType: humanType,
                position: { x, y }
            }
        });
        
        return human;
    }
    
    /**
     * Create a random human type
     */
    static createRandomHuman(texture: PIXI.Texture, x: number, y: number): GameObject {
        const types = [HumanType.MAN, HumanType.WOMAN, HumanType.CHILD];
        const randomType = types[Math.floor(Math.random() * types.length)];
        return this.createHuman(texture, x, y, randomType);
    }
}

/**
 * Prog enemy factory (converted humans)
 */
export class ProgFactory {
    /**
     * Create a Prog enemy from a converted human
     */
    static createProg(texture: PIXI.Texture, x: number, y: number): GameObject {
        // Create the base game object
        const prog = new GameObject('Prog');
        prog.tag = 'progEnemy';
        prog.layer = 2;
        
        // Set initial position
        prog.transform.setPosition(x, y);
        
        // Add sprite renderer with evil coloring
        const spriteRenderer = new SpriteRenderer(prog, texture);
        spriteRenderer.setTint(0xFF0000); // Red tint for evil
        prog.addComponent(spriteRenderer);
        
        // Add collider
        const collider = new Collider(prog, 12, 12);
        prog.addComponent(collider);
        
        // Add rigidbody for physics
        const rigidbody = new Rigidbody(prog);
        rigidbody.drag = 0.9;
        prog.addComponent(rigidbody);
        
        // Progs would have enemy AI components (from Enemy.ts)
        // For now, we'll just mark them as enemies
        
        return prog;
    }
}

/**
 * Human manager for coordinating human behavior
 */
export class HumanManager {
    private humans: Set<GameObject> = new Set();
    private player: GameObject | null = null;
    
    /**
     * Add a human to management
     */
    addHuman(human: GameObject): void {
        this.humans.add(human);
        
        // Set player reference if available
        if (this.player) {
            const ai = human.getComponent<HumanAI>('humanAI');
            if (ai) {
                ai.setPlayer(this.player);
            }
        }
    }
    
    /**
     * Remove a human from management
     */
    removeHuman(human: GameObject): void {
        this.humans.delete(human);
    }
    
    /**
     * Set the player reference for all humans
     */
    setPlayer(player: GameObject): void {
        this.player = player;
        
        for (const human of this.humans) {
            const ai = human.getComponent<HumanAI>('humanAI');
            if (ai) {
                ai.setPlayer(player);
            }
        }
    }
    
    /**
     * Update threat awareness for all humans
     */
    updateThreatAwareness(threats: GameObject[]): void {
        for (const human of this.humans) {
            const ai = human.getComponent<HumanAI>('humanAI');
            if (!ai) continue;
            
            // Find nearest threat
            let nearestThreat: GameObject | null = null;
            let nearestDistance = Infinity;
            
            for (const threat of threats) {
                const distance = human.transform.position.distanceTo(threat.transform.position);
                if (distance < nearestDistance && distance < ai.awarenessRadius) {
                    nearestThreat = threat;
                    nearestDistance = distance;
                }
            }
            
            ai.setNearestThreat(nearestThreat);
        }
    }
    
    /**
     * Get the number of active humans
     */
    getHumanCount(): number {
        return this.humans.size;
    }
    
    /**
     * Get all humans in a specific state
     */
    getHumansInState(state: HumanState): GameObject[] {
        const result: GameObject[] = [];
        
        for (const human of this.humans) {
            const ai = human.getComponent<HumanAI>('humanAI');
            if (ai && ai.state === state) {
                result.push(human);
            }
        }
        
        return result;
    }
    
    /**
     * Clear all humans
     */
    clearAll(): void {
        for (const human of this.humans) {
            human.destroy();
        }
        this.humans.clear();
    }
}

/**
 * Global human manager instance
 */
export const humanManager = new HumanManager();