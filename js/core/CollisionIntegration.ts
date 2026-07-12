/**
 * CollisionIntegration - Bridge between old and new collision systems
 * 
 * This module provides a gradual migration path from the old collision detection
 * to the new spatial partitioning system. It allows both systems to coexist
 * during the transition period.
 */

import { CollisionSystem, CollisionLayer, CollisionResponse, CollisionObject } from './CollisionSystem';
import { spatialGrid } from './SpatialGrid';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Game object wrapper for collision system integration
 */
export interface GameObjectWrapper {
    id: string;
    sprite: any; // PIXI sprite
    type: string;
    health?: number;
    points?: number;
    isAlive?: boolean;
    isRescued?: boolean;
    indestructible?: boolean;
    isDemoProjectile?: boolean;
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
    enableNewCollisionSystem: boolean;
    enableHybridMode: boolean; // Run both systems for comparison
    enablePerformanceLogging: boolean;
    migrationPhase: 'disabled' | 'testing' | 'hybrid' | 'full';
}

/**
 * Default integration configuration
 */
const DEFAULT_CONFIG: IntegrationConfig = {
    enableNewCollisionSystem: false, // Start disabled for safety
    enableHybridMode: false,
    enablePerformanceLogging: true,
    migrationPhase: 'testing'
};

/**
 * Collision integration manager
 */
export class CollisionIntegration {
    private config: IntegrationConfig;
    private collisionSystem: CollisionSystem;
    private gameObjects: Map<string, CollisionObject> = new Map();
    private performanceStats = {
        oldSystemTime: 0,
        newSystemTime: 0,
        oldSystemCollisions: 0,
        newSystemCollisions: 0,
        frameCount: 0
    };
    
    constructor(config: Partial<IntegrationConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.collisionSystem = new CollisionSystem(spatialGrid, {
            enableSpatialPartitioning: true,
            enableCollisionEvents: true,
            enableDebugVisualization: false
        });
        
        console.log('CollisionIntegration initialized in', this.config.migrationPhase, 'mode');
    }
    
    /**
     * Register game objects for collision detection
     */
    registerGameObjects(
        playerProjectiles: GameObjectWrapper[],
        enemyProjectiles: GameObjectWrapper[],
        enemies: GameObjectWrapper[],
        humansAndProgs: GameObjectWrapper[],
        obstacles: GameObjectWrapper[],
        player?: GameObjectWrapper
    ): void {
        try {
            // Clear existing objects
            this.collisionSystem.clear();
            this.gameObjects.clear();
            
            // Register player
            if (player && player.sprite && !player.sprite._destroyed && !player.sprite.destroyed) {
                this.registerObject(player, CollisionLayer.PLAYER);
            }
            
            // Register projectiles
            for (const projectile of playerProjectiles) {
                if (projectile.sprite && !projectile.sprite._destroyed && !projectile.sprite.destroyed) {
                    this.registerObject(projectile, CollisionLayer.PLAYER_PROJECTILE);
                }
            }
            
            for (const projectile of enemyProjectiles) {
                if (projectile.sprite && !projectile.sprite._destroyed && !projectile.sprite.destroyed) {
                    this.registerObject(projectile, CollisionLayer.ENEMY_PROJECTILE);
                }
            }
            
            // Register enemies
            for (const enemy of enemies) {
                if (enemy.sprite && !enemy.sprite._destroyed && !enemy.sprite.destroyed) {
                    this.registerObject(enemy, CollisionLayer.ENEMY);
                }
            }
            
            // Register humans and progs
            for (const entity of humansAndProgs) {
                if (entity.sprite && !entity.sprite._destroyed && !entity.sprite.destroyed) {
                    const layer = entity.type === 'human' ? CollisionLayer.HUMAN : CollisionLayer.ENEMY;
                    this.registerObject(entity, layer);
                }
            }
            
            // Register obstacles
            for (const obstacle of obstacles) {
                if (obstacle.sprite && !obstacle.sprite._destroyed && !obstacle.sprite.destroyed) {
                    this.registerObject(obstacle, CollisionLayer.OBSTACLE);
                }
            }
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.HIGH,
                { objectCounts: this.getObjectCounts() },
                'CollisionIntegration.registerGameObjects'
            );
        }
    }
    
    /**
     * Run collision detection using the new system
     */
    checkCollisions(): void {
        if (!this.config.enableNewCollisionSystem && this.config.migrationPhase !== 'testing') {
            return;
        }
        
        const startTime = performance.now();
        
        try {
            const collisions = this.collisionSystem.checkCollisions();
            
            // Process collisions
            for (const collision of collisions) {
                this.handleCollision(collision);
            }
            
            this.performanceStats.newSystemTime = performance.now() - startTime;
            this.performanceStats.newSystemCollisions = collisions.length;
            this.performanceStats.frameCount++;
            
            // Log performance periodically
            if (this.config.enablePerformanceLogging && this.performanceStats.frameCount % 300 === 0) {
                this.logPerformanceStats();
            }
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.COLLISION_DETECTION,
                ErrorSeverity.HIGH,
                { migrationPhase: this.config.migrationPhase },
                'CollisionIntegration.checkCollisions'
            );
        }
    }
    
    /**
     * Get collision system statistics
     */
    getStats(): any {
        return {
            collisionSystem: this.collisionSystem.getStats(),
            integration: {
                registeredObjects: this.gameObjects.size,
                migrationPhase: this.config.migrationPhase,
                performance: this.performanceStats
            }
        };
    }
    
    /**
     * Enable or disable the new collision system
     */
    setEnabled(enabled: boolean): void {
        this.config.enableNewCollisionSystem = enabled;
        console.log('New collision system', enabled ? 'enabled' : 'disabled');
    }
    
    /**
     * Set migration phase
     */
    setMigrationPhase(phase: IntegrationConfig['migrationPhase']): void {
        this.config.migrationPhase = phase;
        console.log('Collision system migration phase set to:', phase);
        
        // Adjust settings based on phase
        switch (phase) {
            case 'disabled':
                this.config.enableNewCollisionSystem = false;
                this.config.enableHybridMode = false;
                break;
            case 'testing':
                this.config.enableNewCollisionSystem = false;
                this.config.enableHybridMode = true;
                break;
            case 'hybrid':
                this.config.enableNewCollisionSystem = true;
                this.config.enableHybridMode = true;
                break;
            case 'full':
                this.config.enableNewCollisionSystem = true;
                this.config.enableHybridMode = false;
                break;
        }
    }
    
    /**
     * Get debug visualization data
     */
    getDebugData(): any {
        return this.collisionSystem.getDebugData();
    }
    
    /**
     * Register a single game object
     */
    private registerObject(gameObj: GameObjectWrapper, layer: CollisionLayer): void {
        const sprite = gameObj.sprite;
        const position = new Vector2(sprite.x, sprite.y);
        const width = sprite.width || 16;
        const height = sprite.height || 16;
        
        // Create collision mask based on layer
        const collisionMask = this.createCollisionMask(layer);
        
        const collisionObj: CollisionObject = {
            id: gameObj.id || `${gameObj.type}_${Math.random().toString(36).substr(2, 9)}`,
            position,
            bounds: new Rectangle(
                position.x - width / 2,
                position.y - height / 2,
                width,
                height
            ),
            layer,
            collisionMask,
            response: this.getCollisionResponse(layer),
            health: gameObj.health,
            isStatic: layer === CollisionLayer.OBSTACLE,
            onCollision: (other, collision) => {
                // Custom collision handler for game-specific logic
                this.handleGameObjectCollision(gameObj, other, collision);
            }
        };
        
        this.gameObjects.set(collisionObj.id, collisionObj);
        this.collisionSystem.addObject(collisionObj);
    }
    
    /**
     * Create collision mask for a layer
     */
    private createCollisionMask(layer: CollisionLayer): number {
        switch (layer) {
            case CollisionLayer.PLAYER:
                return CollisionLayer.ENEMY | CollisionLayer.ENEMY_PROJECTILE | 
                       CollisionLayer.HUMAN | CollisionLayer.OBSTACLE | CollisionLayer.PICKUP;
                       
            case CollisionLayer.PLAYER_PROJECTILE:
                return CollisionLayer.ENEMY | CollisionLayer.OBSTACLE;
                
            case CollisionLayer.ENEMY:
                return CollisionLayer.PLAYER | CollisionLayer.PLAYER_PROJECTILE | 
                       CollisionLayer.OBSTACLE | CollisionLayer.BOUNDARY;
                       
            case CollisionLayer.ENEMY_PROJECTILE:
                return CollisionLayer.PLAYER | CollisionLayer.HUMAN | CollisionLayer.OBSTACLE;
                
            case CollisionLayer.HUMAN:
                return CollisionLayer.PLAYER | CollisionLayer.ENEMY_PROJECTILE | CollisionLayer.ENEMY;
                
            case CollisionLayer.OBSTACLE:
                return 0xFFFFFFFF; // Collides with everything
                
            default:
                return 0xFFFFFFFF;
        }
    }
    
    /**
     * Get collision response for a layer
     */
    private getCollisionResponse(layer: CollisionLayer): CollisionResponse {
        switch (layer) {
            case CollisionLayer.PLAYER_PROJECTILE:
            case CollisionLayer.ENEMY_PROJECTILE:
                return CollisionResponse.DESTROY_A;
                
            case CollisionLayer.HUMAN:
                return CollisionResponse.PICKUP;
                
            case CollisionLayer.OBSTACLE:
                return CollisionResponse.PUSH_APART;
                
            default:
                return CollisionResponse.CUSTOM;
        }
    }
    
    /**
     * Handle collision between collision objects
     */
    private handleCollision(collision: any): void {
        // This would contain the game-specific collision logic
        // For now, we'll emit an event for the old system to handle
        gameEvents.emit({
            type: 'collision:new_system',
            timestamp: Date.now(),
            source: 'CollisionIntegration',
            data: {
                objectAId: collision.objectA.id,
                objectBId: collision.objectB.id,
                layerA: collision.objectA.layer,
                layerB: collision.objectB.layer,
                point: collision.point
            }
        });
    }
    
    /**
     * Handle game object specific collision logic
     */
    private handleGameObjectCollision(gameObj: GameObjectWrapper, other: CollisionObject, collision: any): void {
        // This is where we'd implement the game-specific collision responses
        // that currently exist in gameLogic.ts
        
        // For now, we'll just log the collision
        console.log(`Collision: ${gameObj.type} vs ${other.layer}`, {
            gameObjPos: { x: gameObj.sprite.x, y: gameObj.sprite.y },
            otherPos: collision.point
        });
    }
    
    /**
     * Get object counts for debugging
     */
    private getObjectCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        
        for (const obj of this.gameObjects.values()) {
            const layerName = CollisionLayer[obj.layer] || 'unknown';
            counts[layerName] = (counts[layerName] || 0) + 1;
        }
        
        return counts;
    }
    
    /**
     * Log performance statistics
     */
    private logPerformanceStats(): void {
        const stats = this.performanceStats;
        console.log('Collision System Performance:', {
            newSystemAvgTime: (stats.newSystemTime / stats.frameCount).toFixed(2) + 'ms',
            newSystemAvgCollisions: (stats.newSystemCollisions / stats.frameCount).toFixed(1),
            totalFrames: stats.frameCount,
            spatialGridStats: spatialGrid.getStats()
        });
    }
}

/**
 * Global collision integration instance
 */
export const collisionIntegration = new CollisionIntegration();

/**
 * Utility functions for integration
 */
export const IntegrationUtils = {
    /**
     * Convert PIXI sprite to collision bounds
     */
    spriteToCollisionBounds(sprite: any): Rectangle {
        const width = sprite.width || 16;
        const height = sprite.height || 16;
        return new Rectangle(
            sprite.x - width / 2,
            sprite.y - height / 2,
            width,
            height
        );
    },
    
    /**
     * Check if two sprites are colliding (legacy compatibility)
     */
    isColliding(spriteA: any, spriteB: any, tolerance: number = 0): boolean {
        const boundsA = this.spriteToCollisionBounds(spriteA);
        const boundsB = this.spriteToCollisionBounds(spriteB);
        
        // Expand bounds by tolerance
        if (tolerance > 0) {
            boundsA.x -= tolerance;
            boundsA.y -= tolerance;
            boundsA.width += tolerance * 2;
            boundsA.height += tolerance * 2;
        }
        
        return boundsA.intersects(boundsB);
    },
    
    /**
     * Enable new collision system for testing
     */
    enableTesting(): void {
        collisionIntegration.setMigrationPhase('testing');
        console.log('🧪 New collision system enabled for testing');
    },
    
    /**
     * Enable hybrid mode (both systems running)
     */
    enableHybrid(): void {
        collisionIntegration.setMigrationPhase('hybrid');
        console.log('🔄 Hybrid collision mode enabled');
    },
    
    /**
     * Enable full new system
     */
    enableFull(): void {
        collisionIntegration.setMigrationPhase('full');
        console.log('🚀 New collision system fully enabled');
    }
};

/**
 * Export main classes and utilities
 */
export {
    collisionIntegration as GameCollisionIntegration
};