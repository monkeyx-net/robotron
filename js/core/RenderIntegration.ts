/**
 * RenderIntegration - Helper functions to integrate existing game objects with RenderSystem
 * 
 * This module provides utility functions to register existing game objects
 * (players, enemies, projectiles, etc.) with the new optimized RenderSystem
 * for sprite batching and viewport culling.
 */

import * as PIXI from 'pixi.js';
import { RenderSystem, RenderLayer, RenderUtils, RenderableObject } from './RenderSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Game object types for automatic layer assignment
 */
export enum GameObjectType {
    PLAYER = 'player',
    ENEMY = 'enemy',
    PROJECTILE = 'projectile',
    HUMAN = 'human',
    OBSTACLE = 'obstacle',
    EFFECT = 'effect',
    UI = 'ui',
    BACKGROUND = 'background'
}

/**
 * Integration utilities for the RenderSystem
 */
export class RenderIntegration {
    private static renderSystem: RenderSystem;
    private static registeredObjects: Map<string, RenderableObject> = new Map();
    
    /**
     * Initialize the render integration system
     */
    static initialize(renderSystem: RenderSystem): void {
        this.renderSystem = renderSystem;
        console.log('RenderIntegration initialized');
    }
    
    /**
     * Register a game object with the render system
     */
    static registerGameObject(
        id: string,
        sprite: PIXI.DisplayObject,
        type: GameObjectType,
        customLayer?: RenderLayer
    ): void {
        try {
            if (!this.renderSystem) {
                console.warn('RenderIntegration not initialized, skipping registration');
                return;
            }
            
            // Determine the appropriate render layer
            const layer = customLayer || this.getLayerForObjectType(type);
            
            // Create renderable object
            const renderable = RenderUtils.createRenderable(sprite, layer, id);
            
            // Register with render system
            this.renderSystem.registerRenderable(id, renderable);
            this.registeredObjects.set(id, renderable);
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.LOW,
                { id, type },
                'RenderIntegration.registerGameObject'
            );
        }
    }
    
    /**
     * Unregister a game object from the render system
     */
    static unregisterGameObject(id: string): void {
        try {
            if (!this.renderSystem) {
                return;
            }
            
            this.renderSystem.unregisterRenderable(id);
            this.registeredObjects.delete(id);
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.LOW,
                { id },
                'RenderIntegration.unregisterGameObject'
            );
        }
    }
    
    /**
     * Update a game object's position and bounds
     */
    static updateGameObject(id: string): void {
        const renderable = this.registeredObjects.get(id);
        if (renderable) {
            RenderUtils.updateRenderableBounds(renderable);
        }
    }
    
    /**
     * Register multiple game objects from an array
     */
    static registerGameObjectArray(
        objects: any[],
        type: GameObjectType,
        getIdFn: (obj: any, index: number) => string = (obj, index) => `${type}_${index}`,
        getSpriteFn: (obj: any) => PIXI.DisplayObject = (obj) => obj.sprite || obj
    ): void {
        objects.forEach((obj, index) => {
            if (obj && !obj._destroyed) {
                const id = getIdFn(obj, index);
                const sprite = getSpriteFn(obj);
                if (sprite) {
                    this.registerGameObject(id, sprite, type);
                }
            }
        });
    }
    
    /**
     * Unregister multiple game objects from an array
     */
    static unregisterGameObjectArray(
        objects: any[],
        type: GameObjectType,
        getIdFn: (obj: any, index: number) => string = (obj, index) => `${type}_${index}`
    ): void {
        objects.forEach((obj, index) => {
            const id = getIdFn(obj, index);
            this.unregisterGameObject(id);
        });
    }
    
    /**
     * Register all current game objects with the render system
     */
    static registerAllGameObjects(gameObjects: {
        player?: any;
        enemies?: any[];
        playerProjectiles?: any[];
        enemyProjectiles?: any[];
        humans?: any[];
        obstacles?: any[];
        effects?: any[];
    }): void {
        try {
            // Register player
            if (gameObjects.player && gameObjects.player.sprite) {
                this.registerGameObject('player', gameObjects.player.sprite, GameObjectType.PLAYER);
            }
            
            // Register enemies
            if (gameObjects.enemies) {
                this.registerGameObjectArray(gameObjects.enemies, GameObjectType.ENEMY);
            }
            
            // Register player projectiles
            if (gameObjects.playerProjectiles) {
                this.registerGameObjectArray(gameObjects.playerProjectiles, GameObjectType.PROJECTILE, 
                    (obj, index) => `player_projectile_${index}`);
            }
            
            // Register enemy projectiles
            if (gameObjects.enemyProjectiles) {
                this.registerGameObjectArray(gameObjects.enemyProjectiles, GameObjectType.PROJECTILE,
                    (obj, index) => `enemy_projectile_${index}`);
            }
            
            // Register humans
            if (gameObjects.humans) {
                this.registerGameObjectArray(gameObjects.humans, GameObjectType.HUMAN);
            }
            
            // Register obstacles
            if (gameObjects.obstacles) {
                this.registerGameObjectArray(gameObjects.obstacles, GameObjectType.OBSTACLE);
            }
            
            // Register effects
            if (gameObjects.effects) {
                this.registerGameObjectArray(gameObjects.effects, GameObjectType.EFFECT);
            }
            
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.MEDIUM,
                {},
                'RenderIntegration.registerAllGameObjects'
            );
        }
    }
    
    /**
     * Get the appropriate render layer for a game object type
     */
    private static getLayerForObjectType(type: GameObjectType): RenderLayer {
        switch (type) {
            case GameObjectType.BACKGROUND:
                return RenderLayer.BACKGROUND;
            case GameObjectType.OBSTACLE:
                return RenderLayer.OBSTACLES;
            case GameObjectType.HUMAN:
                return RenderLayer.HUMANS;
            case GameObjectType.ENEMY:
                return RenderLayer.ENEMIES;
            case GameObjectType.PROJECTILE:
                return RenderLayer.PROJECTILES;
            case GameObjectType.PLAYER:
                return RenderLayer.PLAYER;
            case GameObjectType.EFFECT:
                return RenderLayer.EFFECTS;
            case GameObjectType.UI:
                return RenderLayer.UI;
            default:
                return RenderLayer.BACKGROUND;
        }
    }
    
    /**
     * Get statistics about registered objects
     */
    static getStats(): {
        totalRegistered: number;
        byType: Record<string, number>;
        renderSystemMetrics: any;
    } {
        const byType: Record<string, number> = {};
        
        for (const renderable of this.registeredObjects.values()) {
            const layerName = RenderLayer[renderable.layer] || 'unknown';
            byType[layerName] = (byType[layerName] || 0) + 1;
        }
        
        return {
            totalRegistered: this.registeredObjects.size,
            byType,
            renderSystemMetrics: this.renderSystem ? this.renderSystem.getMetrics() : null
        };
    }
    
    /**
     * Clean up all registered objects
     */
    static cleanup(): void {
        for (const id of this.registeredObjects.keys()) {
            this.unregisterGameObject(id);
        }
        this.registeredObjects.clear();
    }
}

/**
 * Convenience functions for common operations
 */
export const RenderHelpers = {
    /**
     * Register a sprite with automatic type detection
     */
    autoRegister(id: string, sprite: PIXI.DisplayObject, hint?: string): void {
        let type = GameObjectType.BACKGROUND;
        
        // Try to detect type from ID or hint
        const identifier = (hint || id).toLowerCase();
        if (identifier.includes('player')) type = GameObjectType.PLAYER;
        else if (identifier.includes('enemy')) type = GameObjectType.ENEMY;
        else if (identifier.includes('projectile') || identifier.includes('bullet')) type = GameObjectType.PROJECTILE;
        else if (identifier.includes('human')) type = GameObjectType.HUMAN;
        else if (identifier.includes('obstacle') || identifier.includes('wall')) type = GameObjectType.OBSTACLE;
        else if (identifier.includes('effect') || identifier.includes('explosion')) type = GameObjectType.EFFECT;
        else if (identifier.includes('ui') || identifier.includes('hud')) type = GameObjectType.UI;
        
        RenderIntegration.registerGameObject(id, sprite, type);
    },
    
    /**
     * Batch register sprites from a container
     */
    registerContainer(container: PIXI.Container, typeHint: GameObjectType = GameObjectType.BACKGROUND): void {
        container.children.forEach((child, index) => {
            const id = `${container.name || 'container'}_child_${index}`;
            RenderIntegration.registerGameObject(id, child, typeHint);
        });
    }
};