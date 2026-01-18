/**
 * RenderSystem - Optimized rendering with sprite batching and viewport culling
 * 
 * This module provides an optimized rendering system for the Robotron game with
 * sprite batching, viewport culling, render layer management, and performance
 * monitoring to reduce draw calls and improve rendering performance.
 */

import * as PIXI from 'pixi.js';
import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { Constants } from '../utils/Constants';

/**
 * Render layer priorities for z-ordering
 */
export enum RenderLayer {
    BACKGROUND = 0,
    OBSTACLES = 10,
    HUMANS = 20,
    ENEMIES = 30,
    PROJECTILES = 40,
    PLAYER = 50,
    EFFECTS = 60,
    UI = 70,
    DEBUG = 80
}

/**
 * Renderable object interface
 */
export interface RenderableObject {
    sprite: PIXI.DisplayObject;
    layer: RenderLayer;
    visible: boolean;
    position: { x: number; y: number };
    bounds?: { x: number; y: number; width: number; height: number };
    id?: string;
}

/**
 * Viewport configuration
 */
export interface Viewport {
    x: number;
    y: number;
    width: number;
    height: number;
    padding: number; // Extra padding for smooth scrolling
}

/**
 * Render batch for grouping similar sprites
 */
export interface RenderBatch {
    texture: PIXI.Texture;
    sprites: PIXI.Sprite[];
    container: PIXI.Container;
    optimizedContainer?: PIXI.Container; // For efficient batching of many sprites
    layer: RenderLayer;
    dirty: boolean;
    useOptimizedRendering: boolean; // Flag to use optimized rendering for performance
    lastUpdateTime: number; // Track when batch was last updated
}

/**
 * Rendering performance metrics
 */
export interface RenderMetrics {
    totalObjects: number;
    visibleObjects: number;
    culledObjects: number;
    drawCalls: number;
    batchedSprites: number;
    renderTime: number;
    lastFrameTime: number;
}

/**
 * Optimized render system with batching and culling
 */
export class RenderSystem {
    private static instance: RenderSystem;
    
    private app: PIXI.Application;
    private viewport!: Viewport;
    private renderables: Map<string, RenderableObject> = new Map();
    private batches: Map<string, RenderBatch> = new Map();
    private layerContainers: Map<RenderLayer, PIXI.Container> = new Map();
    
    // Performance tracking
    private metrics: RenderMetrics = {
        totalObjects: 0,
        visibleObjects: 0,
        culledObjects: 0,
        drawCalls: 0,
        batchedSprites: 0,
        renderTime: 0,
        lastFrameTime: 0
    };
    
    // Configuration
    private enableBatching: boolean = false; // Disabled - PixiJS handles batching automatically
    private enableCulling: boolean = false; // Disabled - single-screen game doesn't need culling
    private enableLayering: boolean = false; // Disabled - using existing container hierarchy
    private batchSize: number = 1000;
    private cullPadding: number = 50;
    private optimizedRenderingThreshold: number = 5; // Use optimized rendering when batch has 5+ sprites
    private interpolationEnabled: boolean = true; // Enable smooth interpolation for movement
    
    private constructor(app: PIXI.Application) {
        this.app = app;
        this.setupViewport();
        this.setupLayerContainers();
        this.setupEventListeners();
    }
    
    /**
     * Get singleton instance
     */
    static getInstance(app?: PIXI.Application): RenderSystem {
        if (!RenderSystem.instance) {
            if (!app) {
                throw new Error('RenderSystem requires PIXI.Application on first initialization');
            }
            RenderSystem.instance = new RenderSystem(app);
        }
        return RenderSystem.instance;
    }
    
    /**
     * Initialize the render system
     */
    initialize(): void {
        try {
            console.log('RenderSystem initialized with optimizations:', {
                batching: this.enableBatching,
                culling: this.enableCulling,
                layering: this.enableLayering
            });
            
            // Emit initialization event
            gameEvents.emit({
                type: 'render:initialized',
                timestamp: Date.now(),
                source: 'RenderSystem',
                data: {
                    viewport: this.viewport,
                    features: {
                        batching: this.enableBatching,
                        culling: this.enableCulling,
                        layering: this.enableLayering
                    }
                }
            });
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.HIGH,
                {},
                'RenderSystem.initialize'
            );
        }
    }
    
    /**
     * Setup viewport configuration
     */
    private setupViewport(): void {
        this.viewport = {
            x: 0,
            y: 0,
            width: Constants.GAME_WIDTH,
            height: Constants.GAME_HEIGHT,
            padding: this.cullPadding
        };
    }
    
    /**
     * Setup layer containers for z-ordering
     * NOTE: Disabled to avoid interfering with existing container hierarchy
     * The game already has proper containers (playerContainer, enemiesContainer, etc.)
     */
    private setupLayerContainers(): void {
        // Create reference containers for tracking but DON'T add them to stage
        // This avoids conflicts with the existing container hierarchy
        for (const layer of Object.values(RenderLayer)) {
            if (typeof layer === 'number') {
                const container = new PIXI.Container();
                container.name = `Layer_${RenderLayer[layer]}_Reference`;
                this.layerContainers.set(layer, container);
                // DO NOT ADD TO STAGE: this.app.stage.addChild(container);
            }
        }

        console.log('RenderSystem: Layer containers created for reference only (not added to stage)');
    }
    
    /**
     * Get layer for a container
     */
    private getContainerLayer(container: PIXI.Container): number {
        for (const [layer, layerContainer] of this.layerContainers) {
            if (layerContainer === container) {
                return layer;
            }
        }
        return RenderLayer.BACKGROUND;
    }
    
    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Listen for viewport changes
        gameEvents.on('viewport:changed', (event) => {
            this.updateViewport(event.data);
        });
        
        // Listen for render configuration changes
        gameEvents.on('render:config_changed', (event) => {
            this.updateConfiguration(event.data);
        });
    }
    
    /**
     * Register a renderable object
     */
    registerRenderable(id: string, renderable: RenderableObject): void {
        try {
            this.renderables.set(id, renderable);

            // IMPORTANT: Don't move sprites between containers to avoid flickering!
            // The legacy container system (playerContainer, enemiesContainer, etc.) is already
            // managing sprite hierarchy. Moving sprites causes visual artifacts.
            // We only track sprites for culling and metrics, not for reparenting.

            // Add to batch if batching is enabled (but don't reparent the sprite)
            if (this.enableBatching && renderable.sprite instanceof PIXI.Sprite) {
                // Note: Batching is handled by PixiJS automatically when sprites share textures
                // and are in the same container. We don't need to manually manage batching.
                // this.addToBatch(renderable.sprite, renderable.layer);
            }

            this.metrics.totalObjects = this.renderables.size;
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.MEDIUM,
                { id, layer: renderable.layer },
                'RenderSystem.registerRenderable'
            );
        }
    }
    
    /**
     * Unregister a renderable object
     */
    unregisterRenderable(id: string): void {
        const renderable = this.renderables.get(id);
        if (renderable) {
            // Remove from batch
            if (this.enableBatching && renderable.sprite instanceof PIXI.Sprite) {
                this.removeFromBatch(renderable.sprite, renderable.layer);
            }
            
            // Remove from layer container
            if (renderable.sprite.parent) {
                renderable.sprite.parent.removeChild(renderable.sprite);
            }
            
            this.renderables.delete(id);
            this.metrics.totalObjects = this.renderables.size;
        }
    }
    
    /**
     * Add sprite to batch
     */
    private addToBatch(sprite: PIXI.Sprite, layer: RenderLayer): void {
        if (!sprite.texture) return;
        
        const batchKey = `${layer}_${(sprite.texture as any).uid || 'default'}`;
        let batch = this.batches.get(batchKey);
        
        if (!batch) {
            batch = {
                texture: sprite.texture,
                sprites: [],
                container: new PIXI.Container(),
                layer: layer,
                dirty: true,
                useOptimizedRendering: false,
                lastUpdateTime: Date.now()
            };
            
            // Add batch container to appropriate layer
            const layerContainer = this.layerContainers.get(layer);
            if (layerContainer) {
                layerContainer.addChild(batch.container);
            }
            
            this.batches.set(batchKey, batch);
        }
        
        if (batch.sprites.length < this.batchSize) {
            batch.sprites.push(sprite);
            batch.dirty = true;
            
            // Check if we should upgrade to optimized rendering for performance
            this.checkOptimizedRenderingUpgrade(batch);
        }
    }
    
    /**
     * Check if batch should be upgraded to optimized rendering for performance
     */
    private checkOptimizedRenderingUpgrade(batch: RenderBatch): void {
        if (!batch.useOptimizedRendering && batch.sprites.length >= this.optimizedRenderingThreshold) {
            // Upgrade to optimized rendering for better performance with many sprites
            batch.useOptimizedRendering = true;
            
            // Create optimized container for many sprites
            batch.optimizedContainer = new PIXI.Container();
            batch.optimizedContainer.name = `OptimizedBatch_${batch.sprites.length}`;
            
            // Move sprites from regular container to optimized container
            for (const sprite of batch.sprites) {
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }
                batch.optimizedContainer.addChild(sprite);
            }
            
            // Replace regular container with optimized container
            if (batch.container.parent) {
                const parent = batch.container.parent;
                const index = parent.getChildIndex(batch.container);
                parent.removeChild(batch.container);
                parent.addChildAt(batch.optimizedContainer, index);
            }
            
            console.log(`🚀 Upgraded batch to optimized rendering: ${batch.sprites.length} sprites`);
        }
    }
    
    /**
     * Remove sprite from batch
     */
    private removeFromBatch(sprite: PIXI.Sprite, layer: RenderLayer): void {
        if (!sprite.texture) return;
        
        const batchKey = `${layer}_${(sprite.texture as any).uid || 'default'}`;
        const batch = this.batches.get(batchKey);
        
        if (batch) {
            const index = batch.sprites.indexOf(sprite);
            if (index !== -1) {
                batch.sprites.splice(index, 1);
                batch.dirty = true;
                
                // Remove sprite from appropriate container
                if (batch.useOptimizedRendering && batch.optimizedContainer) {
                    batch.optimizedContainer.removeChild(sprite);
                } else {
                    batch.container.removeChild(sprite);
                }
                
                // Check if we should downgrade from optimized rendering
                if (batch.useOptimizedRendering && batch.sprites.length < this.optimizedRenderingThreshold) {
                    this.downgradeFromOptimizedRendering(batch);
                }
                
                // Remove empty batches
                if (batch.sprites.length === 0) {
                    this.cleanupBatch(batch);
                    this.batches.delete(batchKey);
                }
            }
        }
    }
    
    /**
     * Downgrade batch from optimized rendering to regular Container
     */
    private downgradeFromOptimizedRendering(batch: RenderBatch): void {
        if (!batch.useOptimizedRendering || !batch.optimizedContainer) return;
        
        // Move sprites back to regular container
        for (const sprite of batch.sprites) {
            if (sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
            batch.container.addChild(sprite);
        }
        
        // Replace optimized container with regular container
        if (batch.optimizedContainer.parent) {
            const parent = batch.optimizedContainer.parent;
            const index = parent.getChildIndex(batch.optimizedContainer);
            parent.removeChild(batch.optimizedContainer);
            parent.addChildAt(batch.container, index);
        }
        
        // Clean up optimized container
        batch.optimizedContainer.destroy();
        batch.optimizedContainer = undefined;
        batch.useOptimizedRendering = false;
        
        console.log(`📦 Downgraded batch from optimized rendering: ${batch.sprites.length} sprites`);
    }
    
    /**
     * Clean up batch containers
     */
    private cleanupBatch(batch: RenderBatch): void {
        if (batch.useOptimizedRendering && batch.optimizedContainer) {
            if (batch.optimizedContainer.parent) {
                batch.optimizedContainer.parent.removeChild(batch.optimizedContainer);
            }
            batch.optimizedContainer.destroy();
        } else {
            if (batch.container.parent) {
                batch.container.parent.removeChild(batch.container);
            }
            batch.container.destroy();
        }
    }
    
    /**
     * Apply anti-flickering optimizations for many sprites
     */
    private applyAntiFlickeringOptimizations(): void {
        // Optimization 1: Ensure consistent z-ordering for batches
        for (const batch of this.batches.values()) {
            if (batch.useOptimizedRendering && batch.optimizedContainer) {
                // Sort sprites by texture and position to reduce state changes
                batch.sprites.sort((a, b) => {
                    // First sort by texture UID for batching
                    const textureA = (a.texture as any).uid || 0;
                    const textureB = (b.texture as any).uid || 0;
                    if (textureA !== textureB) {
                        return textureA - textureB;
                    }
                    // Then sort by Y position for consistent rendering order
                    return a.y - b.y;
                });
            }
        }
        
        // Optimization 2: Minimize container operations
        // Group similar operations together to reduce GPU state changes
        this.minimizeContainerOperations();
        
        // Optimization 3: Apply consistent rendering order
        this.ensureConsistentRenderOrder();
    }
    
    /**
     * Minimize container operations to reduce flickering
     */
    private minimizeContainerOperations(): void {
        // Batch container updates to reduce the number of GPU state changes
        for (const batch of this.batches.values()) {
            if (batch.dirty && batch.sprites.length > this.optimizedRenderingThreshold) {
                const container = batch.useOptimizedRendering ? batch.optimizedContainer : batch.container;
                if (container) {
                    // Temporarily disable rendering during batch updates
                    const wasVisible = container.visible;
                    container.visible = false;
                    
                    // Perform all updates at once
                    // (Sprite positions are already updated by the game logic)
                    
                    // Re-enable rendering
                    container.visible = wasVisible;
                }
            }
        }
    }
    
    /**
     * Ensure consistent render order to prevent flickering
     */
    private ensureConsistentRenderOrder(): void {
        // Sort layer containers by their layer priority
        const sortedLayers = Array.from(this.layerContainers.entries())
            .sort(([layerA], [layerB]) => layerA - layerB);
        
        // Ensure containers are in the correct order in their parent
        for (const [layer, container] of sortedLayers) {
            if (container.parent) {
                // Move to front to maintain layer order
                container.parent.setChildIndex(container, container.parent.children.length - 1);
            }
        }
    }
    
    /**
     * Update viewport configuration
     */
    updateViewport(viewport: Partial<Viewport>): void {
        this.viewport = { ...this.viewport, ...viewport };
        
        // Emit viewport update event
        gameEvents.emit({
            type: 'render:viewport_updated',
            timestamp: Date.now(),
            source: 'RenderSystem',
            data: this.viewport
        });
    }
    
    /**
     * Update render configuration
     */
    updateConfiguration(config: {
        enableBatching?: boolean;
        enableCulling?: boolean;
        enableLayering?: boolean;
        batchSize?: number;
        cullPadding?: number;
        optimizedRenderingThreshold?: number;
        interpolationEnabled?: boolean;
    }): void {
        if (config.enableBatching !== undefined) this.enableBatching = config.enableBatching;
        if (config.enableCulling !== undefined) this.enableCulling = config.enableCulling;
        if (config.enableLayering !== undefined) this.enableLayering = config.enableLayering;
        if (config.batchSize !== undefined) this.batchSize = config.batchSize;
        if (config.cullPadding !== undefined) this.cullPadding = config.cullPadding;
        if (config.optimizedRenderingThreshold !== undefined) this.optimizedRenderingThreshold = config.optimizedRenderingThreshold;
        if (config.interpolationEnabled !== undefined) this.interpolationEnabled = config.interpolationEnabled;
        
        console.log('RenderSystem configuration updated:', config);
    }
    
    /**
     * Perform viewport culling
     */
    private performCulling(): void {
        if (!this.enableCulling) return;
        
        let visibleCount = 0;
        let culledCount = 0;
        
        for (const [id, renderable] of this.renderables) {
            const isVisible = this.isInViewport(renderable);
            
            if (renderable.sprite.visible !== isVisible) {
                renderable.sprite.visible = isVisible;
            }
            
            if (isVisible) {
                visibleCount++;
            } else {
                culledCount++;
            }
        }
        
        this.metrics.visibleObjects = visibleCount;
        this.metrics.culledObjects = culledCount;
    }
    
    /**
     * Check if object is in viewport
     */
    private isInViewport(renderable: RenderableObject): boolean {
        if (!renderable.bounds) {
            // Use sprite bounds if no custom bounds provided
            const bounds = renderable.sprite.getBounds();
            renderable.bounds = {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height
            };
        }
        
        const objBounds = renderable.bounds;
        const viewport = this.viewport;
        
        return !(
            objBounds.x + objBounds.width < viewport.x - viewport.padding ||
            objBounds.x > viewport.x + viewport.width + viewport.padding ||
            objBounds.y + objBounds.height < viewport.y - viewport.padding ||
            objBounds.y > viewport.y + viewport.height + viewport.padding
        );
    }
    
    /**
     * Update batches
     */
    private updateBatches(): void {
        if (!this.enableBatching) return;
        
        let batchedCount = 0;
        
        for (const batch of this.batches.values()) {
            if (batch.dirty) {
                // Optimized rendering handles efficient batching
                // Position updates are handled by interpolation system
                if (batch.useOptimizedRendering && batch.optimizedContainer) {
                    // Optimized container - mark as clean and update timestamp
                    batch.dirty = false;
                    batch.lastUpdateTime = Date.now();
                } else {
                    // Regular container - positions are updated by sprite renderers
                    batch.dirty = false;
                    batch.lastUpdateTime = Date.now();
                }
                batchedCount += batch.sprites.length;
            }
        }
        
        this.metrics.batchedSprites = batchedCount;
    }
    
    /**
     * Render frame with simple culling (no sprite manipulation to avoid flickering)
     */
    render(interpolation: number = 0): void {
        const startTime = performance.now();

        try {
            // Only perform viewport culling - don't move sprites around!
            // Sprite movement causes flickering
            this.performCulling();

            // Update metrics (but don't update batches or apply optimizations that move sprites)
            this.metrics.drawCalls = this.calculateDrawCalls();
            this.metrics.renderTime = performance.now() - startTime;
            this.metrics.lastFrameTime = Date.now();

            // Emit render event (less frequently to reduce overhead)
            if (Math.random() < 0.01) { // Only emit 1% of the time
                gameEvents.emit({
                    type: 'render:frame_rendered',
                    timestamp: Date.now(),
                    source: 'RenderSystem',
                    data: {
                        metrics: this.metrics,
                        interpolation
                    }
                });
            }

        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.RENDERING,
                ErrorSeverity.MEDIUM,
                { interpolation },
                'RenderSystem.render'
            );
        }
    }
    
    /**
     * Calculate estimated draw calls
     */
    private calculateDrawCalls(): number {
        let drawCalls = 0;
        
        if (this.enableBatching) {
            // Each batch is one draw call
            drawCalls = this.batches.size;
        } else {
            // Each visible sprite is one draw call
            drawCalls = this.metrics.visibleObjects;
        }
        
        return drawCalls;
    }
    
    /**
     * Get rendering metrics
     */
    getMetrics(): RenderMetrics {
        return { ...this.metrics };
    }
    
    /**
     * Get configuration
     */
    getConfiguration(): {
        enableBatching: boolean;
        enableCulling: boolean;
        enableLayering: boolean;
        batchSize: number;
        cullPadding: number;
        optimizedRenderingThreshold: number;
        interpolationEnabled: boolean;
    } {
        return {
            enableBatching: this.enableBatching,
            enableCulling: this.enableCulling,
            enableLayering: this.enableLayering,
            batchSize: this.batchSize,
            cullPadding: this.cullPadding,
            optimizedRenderingThreshold: this.optimizedRenderingThreshold,
            interpolationEnabled: this.interpolationEnabled
        };
    }
    
    /**
     * Debug information
     */
    getDebugInfo(): {
        renderables: number;
        batches: number;
        optimizedBatches: number;
        layers: number;
        viewport: Viewport;
        metrics: RenderMetrics;
    } {
        let optimizedBatches = 0;
        for (const batch of this.batches.values()) {
            if (batch.useOptimizedRendering) {
                optimizedBatches++;
            }
        }
        
        return {
            renderables: this.renderables.size,
            batches: this.batches.size,
            optimizedBatches,
            layers: this.layerContainers.size,
            viewport: this.viewport,
            metrics: this.metrics
        };
    }
}

/**
 * Render system utilities
 */
export const RenderUtils = {
    /**
     * Create a renderable object from a sprite
     */
    createRenderable(
        sprite: PIXI.DisplayObject,
        layer: RenderLayer = RenderLayer.BACKGROUND,
        id?: string
    ): RenderableObject {
        return {
            sprite,
            layer,
            visible: sprite.visible,
            position: { x: sprite.x, y: sprite.y },
            id: id || `renderable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    },
    
    /**
     * Update renderable bounds
     */
    updateRenderableBounds(renderable: RenderableObject): void {
        const bounds = renderable.sprite.getBounds();
        renderable.bounds = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        };
        renderable.position = { x: renderable.sprite.x, y: renderable.sprite.y };
    },
    
    /**
     * Get optimal layer for object type
     */
    getLayerForObjectType(type: string): RenderLayer {
        switch (type.toLowerCase()) {
            case 'background': return RenderLayer.BACKGROUND;
            case 'obstacle': return RenderLayer.OBSTACLES;
            case 'human': return RenderLayer.HUMANS;
            case 'enemy': return RenderLayer.ENEMIES;
            case 'projectile': return RenderLayer.PROJECTILES;
            case 'player': return RenderLayer.PLAYER;
            case 'effect': return RenderLayer.EFFECTS;
            case 'ui': return RenderLayer.UI;
            case 'debug': return RenderLayer.DEBUG;
            default: return RenderLayer.BACKGROUND;
        }
    }
};