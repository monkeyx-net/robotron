/**
 * CollisionSystem - Advanced collision detection with layer support
 * 
 * This module provides a comprehensive collision detection system that uses
 * spatial partitioning for performance and supports collision layers for
 * flexible collision rules (e.g., player bullets don't hit player).
 */

import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { SpatialGrid, SpatialObject, CollisionPair } from './SpatialGrid';
import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Collision layers for different object types
 */
export enum CollisionLayer {
    PLAYER = 1 << 0,           // 1
    PLAYER_PROJECTILE = 1 << 1, // 2
    ENEMY = 1 << 2,            // 4
    ENEMY_PROJECTILE = 1 << 3,  // 8
    HUMAN = 1 << 4,            // 16
    OBSTACLE = 1 << 5,         // 32
    PICKUP = 1 << 6,           // 64
    EFFECT = 1 << 7,           // 128
    BOUNDARY = 1 << 8          // 256
}

/**
 * Collision response types
 */
export enum CollisionResponse {
    NONE = 'none',
    BOUNCE = 'bounce',
    DESTROY_A = 'destroy_a',
    DESTROY_B = 'destroy_b',
    DESTROY_BOTH = 'destroy_both',
    DAMAGE_A = 'damage_a',
    DAMAGE_B = 'damage_b',
    DAMAGE_BOTH = 'damage_both',
    PICKUP = 'pickup',
    PUSH_APART = 'push_apart',
    CUSTOM = 'custom'
}

/**
 * Collision object interface
 */
export interface CollisionObject extends SpatialObject {
    layer: CollisionLayer;
    collisionMask: number; // Which layers this object can collide with
    response: CollisionResponse;
    velocity?: Vector2;
    mass?: number;
    health?: number;
    damage?: number;
    isStatic?: boolean;
    onCollision?: (other: CollisionObject, collision: CollisionInfo) => void;
}

/**
 * Collision information
 */
export interface CollisionInfo {
    objectA: CollisionObject;
    objectB: CollisionObject;
    point: Vector2;
    normal: Vector2;
    penetration: number;
    timestamp: number;
    resolved: boolean;
}

/**
 * Collision rule for specific layer interactions
 */
export interface CollisionRule {
    layerA: CollisionLayer;
    layerB: CollisionLayer;
    response: CollisionResponse;
    enabled: boolean;
    customHandler?: (collision: CollisionInfo) => void;
}

/**
 * Collision system configuration
 */
export interface CollisionSystemConfig {
    enableSpatialPartitioning: boolean;
    maxCollisionsPerFrame: number;
    enableCollisionEvents: boolean;
    enableDebugVisualization: boolean;
    collisionTolerance: number;
}

/**
 * Default collision system configuration
 */
const DEFAULT_CONFIG: CollisionSystemConfig = {
    enableSpatialPartitioning: true,
    maxCollisionsPerFrame: 1000,
    enableCollisionEvents: true,
    enableDebugVisualization: false,
    collisionTolerance: 0.1
};

/**
 * Advanced collision detection system
 */
export class CollisionSystem {
    private config: CollisionSystemConfig;
    private spatialGrid: SpatialGrid;
    private collisionRules: Map<string, CollisionRule> = new Map();
    private collisionHistory: CollisionInfo[] = [];
    private frameCollisionCount: number = 0;
    
    // Performance tracking
    private stats = {
        totalCollisions: 0,
        collisionsThisFrame: 0,
        averageCollisionsPerFrame: 0,
        spatialGridQueries: 0,
        narrowPhaseChecks: 0,
        lastFrameTime: 0
    };
    
    constructor(spatialGrid: SpatialGrid, config: Partial<CollisionSystemConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.spatialGrid = spatialGrid;
        this.setupDefaultCollisionRules();
        
        console.log('CollisionSystem initialized with spatial partitioning:', this.config.enableSpatialPartitioning);
    }
    
    /**
     * Add a collision object to the system
     */
    addObject(object: CollisionObject): void {
        try {
            if (this.config.enableSpatialPartitioning) {
                this.spatialGrid.insert(object);
            }
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.MEDIUM,
                { objectId: object.id },
                'CollisionSystem.addObject'
            );
        }
    }
    
    /**
     * Remove a collision object from the system
     */
    removeObject(objectId: string): boolean {
        try {
            if (this.config.enableSpatialPartitioning) {
                return this.spatialGrid.remove(objectId);
            }
            return true;
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.MEDIUM,
                { objectId },
                'CollisionSystem.removeObject'
            );
            return false;
        }
    }
    
    /**
     * Update a collision object's position
     */
    updateObject(object: CollisionObject): void {
        try {
            if (this.config.enableSpatialPartitioning) {
                this.spatialGrid.update(object);
            }
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.LOW,
                { objectId: object.id },
                'CollisionSystem.updateObject'
            );
        }
    }
    
    /**
     * Check collisions for all objects
     */
    checkCollisions(): CollisionInfo[] {
        const startTime = performance.now();
        this.frameCollisionCount = 0;
        const collisions: CollisionInfo[] = [];
        
        try {
            let pairs: CollisionPair[];
            
            if (this.config.enableSpatialPartitioning) {
                // Use spatial grid for broad-phase collision detection
                pairs = this.spatialGrid.getCollisionPairs();
                this.stats.spatialGridQueries++;
            } else {
                // Fallback to brute force (not recommended for many objects)
                pairs = this.getBruteForceCollisionPairs();
            }
            
            // Narrow-phase collision detection
            for (const pair of pairs) {
                if (this.frameCollisionCount >= this.config.maxCollisionsPerFrame) {
                    console.warn('Maximum collisions per frame reached, skipping remaining checks');
                    break;
                }
                
                const objA = pair.objectA as CollisionObject;
                const objB = pair.objectB as CollisionObject;
                
                // Check if these layers should collide
                if (!this.shouldCollide(objA, objB)) {
                    continue;
                }
                
                // Perform narrow-phase collision detection
                const collision = this.checkCollision(objA, objB);
                if (collision) {
                    collisions.push(collision);
                    this.frameCollisionCount++;
                    this.stats.totalCollisions++;
                    
                    // Resolve collision
                    this.resolveCollision(collision);
                    
                    // Emit collision event
                    if (this.config.enableCollisionEvents) {
                        this.emitCollisionEvent(collision);
                    }
                }
                
                this.stats.narrowPhaseChecks++;
            }
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.HIGH,
                { frameCollisionCount: this.frameCollisionCount },
                'CollisionSystem.checkCollisions'
            );
        }
        
        // Update statistics
        this.stats.collisionsThisFrame = this.frameCollisionCount;
        this.stats.lastFrameTime = performance.now() - startTime;
        this.updateAverageCollisions();
        
        return collisions;
    }
    
    /**
     * Check collision between two specific objects
     */
    checkCollision(objA: CollisionObject, objB: CollisionObject): CollisionInfo | null {
        // Quick bounds check
        if (!objA.bounds.intersects(objB.bounds)) {
            return null;
        }
        
        // Calculate collision details
        const collision = this.calculateCollisionInfo(objA, objB);
        
        if (collision && collision.penetration > this.config.collisionTolerance) {
            return collision;
        }
        
        return null;
    }
    
    /**
     * Query objects that would collide with a specific area
     */
    queryCollisions(bounds: Rectangle, layer?: CollisionLayer): CollisionObject[] {
        try {
            let objects: SpatialObject[];
            
            if (this.config.enableSpatialPartitioning) {
                objects = this.spatialGrid.query(bounds);
            } else {
                // Fallback implementation would go here
                objects = [];
            }
            
            // Filter by layer if specified
            const collisionObjects = objects as CollisionObject[];
            if (layer !== undefined) {
                return collisionObjects.filter(obj => obj.layer === layer);
            }
            
            return collisionObjects;
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.MEDIUM,
                { bounds, layer },
                'CollisionSystem.queryCollisions'
            );
            return [];
        }
    }
    
    /**
     * Add or update a collision rule
     */
    setCollisionRule(layerA: CollisionLayer, layerB: CollisionLayer, rule: Partial<CollisionRule>): void {
        const key = this.getCollisionRuleKey(layerA, layerB);
        const existingRule = this.collisionRules.get(key);
        
        const newRule: CollisionRule = {
            layerA,
            layerB,
            response: CollisionResponse.NONE,
            enabled: true,
            ...existingRule,
            ...rule
        };
        
        this.collisionRules.set(key, newRule);
    }
    
    /**
     * Get collision statistics
     */
    getStats(): typeof this.stats & {
        spatialGridStats: any;
        activeRules: number;
        collisionHistorySize: number;
    } {
        return {
            ...this.stats,
            spatialGridStats: this.spatialGrid.getStats(),
            activeRules: this.collisionRules.size,
            collisionHistorySize: this.collisionHistory.length
        };
    }
    
    /**
     * Clear all collision objects
     */
    clear(): void {
        this.spatialGrid.clear();
        this.collisionHistory.length = 0;
        this.frameCollisionCount = 0;
    }
    
    /**
     * Enable or disable debug visualization
     */
    setDebugVisualization(enabled: boolean): void {
        this.config.enableDebugVisualization = enabled;
    }
    
    /**
     * Get debug visualization data
     */
    getDebugData(): {
        spatialGrid: any;
        recentCollisions: CollisionInfo[];
        activeRules: CollisionRule[];
    } {
        return {
            spatialGrid: this.spatialGrid.getDebugData(),
            recentCollisions: this.collisionHistory.slice(-10),
            activeRules: Array.from(this.collisionRules.values()).filter(rule => rule.enabled)
        };
    }
    
    /**
     * Check if two objects should collide based on layers and masks
     */
    private shouldCollide(objA: CollisionObject, objB: CollisionObject): boolean {
        // Check collision masks
        if (!(objA.collisionMask & objB.layer) || !(objB.collisionMask & objA.layer)) {
            return false;
        }
        
        // Check collision rules
        const ruleKey = this.getCollisionRuleKey(objA.layer, objB.layer);
        const rule = this.collisionRules.get(ruleKey);
        
        return rule ? rule.enabled : true;
    }
    
    /**
     * Calculate detailed collision information
     */
    private calculateCollisionInfo(objA: CollisionObject, objB: CollisionObject): CollisionInfo | null {
        const boundsA = objA.bounds;
        const boundsB = objB.bounds;
        
        // Calculate overlap
        const overlapX = Math.min(boundsA.x + boundsA.width, boundsB.x + boundsB.width) - 
                        Math.max(boundsA.x, boundsB.x);
        const overlapY = Math.min(boundsA.y + boundsA.height, boundsB.y + boundsB.height) - 
                        Math.max(boundsA.y, boundsB.y);
        
        if (overlapX <= 0 || overlapY <= 0) {
            return null;
        }
        
        // Determine collision normal and penetration
        let normal: Vector2;
        let penetration: number;
        
        if (overlapX < overlapY) {
            // Horizontal collision
            penetration = overlapX;
            normal = new Vector2(objA.position.x < objB.position.x ? -1 : 1, 0);
        } else {
            // Vertical collision
            penetration = overlapY;
            normal = new Vector2(0, objA.position.y < objB.position.y ? -1 : 1);
        }
        
        // Calculate collision point
        const point = new Vector2(
            Math.max(boundsA.x, boundsB.x) + overlapX / 2,
            Math.max(boundsA.y, boundsB.y) + overlapY / 2
        );
        
        return {
            objectA: objA,
            objectB: objB,
            point,
            normal,
            penetration,
            timestamp: Date.now(),
            resolved: false
        };
    }
    
    /**
     * Resolve a collision based on the collision rule
     */
    private resolveCollision(collision: CollisionInfo): void {
        const ruleKey = this.getCollisionRuleKey(collision.objectA.layer, collision.objectB.layer);
        const rule = this.collisionRules.get(ruleKey);
        
        if (!rule) {
            return;
        }
        
        // Apply collision response
        switch (rule.response) {
            case CollisionResponse.BOUNCE:
                this.applyBounce(collision);
                break;
                
            case CollisionResponse.DESTROY_A:
                this.destroyObject(collision.objectA);
                break;
                
            case CollisionResponse.DESTROY_B:
                this.destroyObject(collision.objectB);
                break;
                
            case CollisionResponse.DESTROY_BOTH:
                this.destroyObject(collision.objectA);
                this.destroyObject(collision.objectB);
                break;
                
            case CollisionResponse.DAMAGE_A:
                this.damageObject(collision.objectA, collision.objectB.damage || 1);
                break;
                
            case CollisionResponse.DAMAGE_B:
                this.damageObject(collision.objectB, collision.objectA.damage || 1);
                break;
                
            case CollisionResponse.DAMAGE_BOTH:
                this.damageObject(collision.objectA, collision.objectB.damage || 1);
                this.damageObject(collision.objectB, collision.objectA.damage || 1);
                break;
                
            case CollisionResponse.PUSH_APART:
                this.pushApart(collision);
                break;
                
            case CollisionResponse.CUSTOM:
                if (rule.customHandler) {
                    rule.customHandler(collision);
                }
                break;
        }
        
        // Call object-specific collision handlers
        collision.objectA.onCollision?.(collision.objectB, collision);
        collision.objectB.onCollision?.(collision.objectA, collision);
        
        collision.resolved = true;
        this.collisionHistory.push(collision);
        
        // Trim collision history
        if (this.collisionHistory.length > 100) {
            this.collisionHistory.shift();
        }
    }
    
    /**
     * Apply bounce physics to collision
     */
    private applyBounce(collision: CollisionInfo): void {
        const objA = collision.objectA;
        const objB = collision.objectB;
        
        if (!objA.velocity || !objB.velocity) {
            return;
        }
        
        const massA = objA.mass || 1;
        const massB = objB.mass || 1;
        const totalMass = massA + massB;
        
        // Calculate new velocities using conservation of momentum
        const relativeVelocity = objA.velocity.subtract(objB.velocity);
        const velocityAlongNormal = relativeVelocity.dot(collision.normal);
        
        if (velocityAlongNormal > 0) {
            return; // Objects separating
        }
        
        const restitution = 0.8; // Bounciness factor
        const impulse = -(1 + restitution) * velocityAlongNormal / totalMass;
        
        const impulseVector = collision.normal.multiply(impulse);
        
        if (!objA.isStatic) {
            objA.velocity = objA.velocity.add(impulseVector.multiply(massB));
        }
        
        if (!objB.isStatic) {
            objB.velocity = objB.velocity.subtract(impulseVector.multiply(massA));
        }
    }
    
    /**
     * Push objects apart to resolve overlap
     */
    private pushApart(collision: CollisionInfo): void {
        const objA = collision.objectA;
        const objB = collision.objectB;
        
        const massA = objA.mass || 1;
        const massB = objB.mass || 1;
        const totalMass = massA + massB;
        
        const separationA = collision.normal.multiply(-collision.penetration * (massB / totalMass));
        const separationB = collision.normal.multiply(collision.penetration * (massA / totalMass));
        
        if (!objA.isStatic) {
            objA.position = objA.position.add(separationA);
            this.updateObjectBounds(objA);
        }
        
        if (!objB.isStatic) {
            objB.position = objB.position.add(separationB);
            this.updateObjectBounds(objB);
        }
    }
    
    /**
     * Damage an object
     */
    private damageObject(object: CollisionObject, damage: number): void {
        if (object.health !== undefined) {
            object.health -= damage;
            
            if (object.health <= 0) {
                this.destroyObject(object);
            }
        }
    }
    
    /**
     * Destroy an object
     */
    private destroyObject(object: CollisionObject): void {
        // This would typically call a destroy method on the game object
        // For now, we'll just remove it from the collision system
        this.removeObject(object.id);
    }
    
    /**
     * Update object bounds after position change
     */
    private updateObjectBounds(object: CollisionObject): void {
        const halfWidth = object.bounds.width / 2;
        const halfHeight = object.bounds.height / 2;
        
        object.bounds.x = object.position.x - halfWidth;
        object.bounds.y = object.position.y - halfHeight;
        
        this.updateObject(object);
    }
    
    /**
     * Get collision rule key for two layers
     */
    private getCollisionRuleKey(layerA: CollisionLayer, layerB: CollisionLayer): string {
        // Ensure consistent ordering
        const [a, b] = layerA < layerB ? [layerA, layerB] : [layerB, layerA];
        return `${a}:${b}`;
    }
    
    /**
     * Setup default collision rules for Robotron
     */
    private setupDefaultCollisionRules(): void {
        // Player vs Enemy
        this.setCollisionRule(CollisionLayer.PLAYER, CollisionLayer.ENEMY, {
            response: CollisionResponse.DAMAGE_A,
            enabled: true
        });
        
        // Player projectiles vs Enemies
        this.setCollisionRule(CollisionLayer.PLAYER_PROJECTILE, CollisionLayer.ENEMY, {
            response: CollisionResponse.DESTROY_BOTH,
            enabled: true
        });
        
        // Enemy projectiles vs Player
        this.setCollisionRule(CollisionLayer.ENEMY_PROJECTILE, CollisionLayer.PLAYER, {
            response: CollisionResponse.DAMAGE_B,
            enabled: true
        });
        
        // Player vs Humans (rescue)
        this.setCollisionRule(CollisionLayer.PLAYER, CollisionLayer.HUMAN, {
            response: CollisionResponse.PICKUP,
            enabled: true
        });
        
        // Projectiles vs Obstacles
        this.setCollisionRule(CollisionLayer.PLAYER_PROJECTILE, CollisionLayer.OBSTACLE, {
            response: CollisionResponse.DESTROY_A,
            enabled: true
        });
        
        this.setCollisionRule(CollisionLayer.ENEMY_PROJECTILE, CollisionLayer.OBSTACLE, {
            response: CollisionResponse.DESTROY_A,
            enabled: true
        });
        
        // Everything vs Boundaries
        this.setCollisionRule(CollisionLayer.PLAYER, CollisionLayer.BOUNDARY, {
            response: CollisionResponse.PUSH_APART,
            enabled: true
        });
        
        this.setCollisionRule(CollisionLayer.ENEMY, CollisionLayer.BOUNDARY, {
            response: CollisionResponse.BOUNCE,
            enabled: true
        });
    }
    
    /**
     * Emit collision event
     */
    private emitCollisionEvent(collision: CollisionInfo): void {
        gameEvents.emit({
            type: 'collision:detected',
            timestamp: collision.timestamp,
            source: 'CollisionSystem',
            data: {
                objectAId: collision.objectA.id,
                objectBId: collision.objectB.id,
                layerA: collision.objectA.layer,
                layerB: collision.objectB.layer,
                point: collision.point,
                penetration: collision.penetration
            }
        });
    }
    
    /**
     * Update average collisions per frame
     */
    private updateAverageCollisions(): void {
        // Simple moving average
        this.stats.averageCollisionsPerFrame = 
            (this.stats.averageCollisionsPerFrame * 0.9) + (this.stats.collisionsThisFrame * 0.1);
    }
    
    /**
     * Brute force collision pairs (fallback)
     */
    private getBruteForceCollisionPairs(): CollisionPair[] {
        // This would implement O(n²) collision detection
        // Not recommended for production use
        return [];
    }
}

/**
 * Collision system utilities
 */
export const CollisionUtils = {
    /**
     * Create a collision object from basic parameters
     */
    createCollisionObject(
        id: string,
        position: Vector2,
        width: number,
        height: number,
        layer: CollisionLayer,
        collisionMask: number = 0xFFFFFFFF
    ): CollisionObject {
        return {
            id,
            position: position.clone(),
            bounds: new Rectangle(
                position.x - width / 2,
                position.y - height / 2,
                width,
                height
            ),
            layer,
            collisionMask,
            response: CollisionResponse.NONE
        };
    },
    
    /**
     * Create collision mask from multiple layers
     */
    createCollisionMask(...layers: CollisionLayer[]): number {
        return layers.reduce((mask, layer) => mask | layer, 0);
    },
    
    /**
     * Check if layer is in collision mask
     */
    layerInMask(layer: CollisionLayer, mask: number): boolean {
        return (mask & layer) !== 0;
    }
};

/**
 * Export main classes and utilities
 */