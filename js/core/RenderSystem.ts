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
    layer: RenderLayer;
    dirty: boolean;
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
    private viewport: Viewport;
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
    private enableBatching: boolean = true;
    private enableCulling: boolean = true;
    private enableLayering: boolean = true;
    private batchSize: number = 1000;
    private cullPadding: number = 50;
    
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
     */
    private setupLayerContainers(): void {
        // Create containers for each render layer
        for (const layer of Object.values(RenderLayer)) {
            if (typeof layer === 'number') {
                const container = new PIXI.Container();
                container.name = `Layer_${RenderLayer[layer]}`;
                this.layerContainers.set(layer, container);
                this.app.stage.addChild(container);
            }
        }
        
        // Sort containers by layer priority
        this.app.stage.children.sort((a, b) => {
            const layerA = this.getContainerLayer(a as PIXI.Container);
            const layerB = this.getContainerLayer(b as PIXI.Container);
            return layerA - layerB;
        });
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
            
            // Add to appropriate layer container
            if (this.enableLayering) {
                const layerContainer = this.layerContainers.get(renderable.layer);
                if (layerContainer && renderable.sprite.parent !== layerContainer) {
                    // Remove from current parent if any
                    if (renderable.sprite.parent) {
                        renderable.sprite.parent.removeChild(renderable.sprite);
                    }
                    layerContainer.addChild(renderable.sprite);
                }
            }
            
            // Add to batch if batching is enabled
            if (this.enableBatching && renderable.sprite instanceof PIXI.Sprite) {
                this.addToBatch(renderable.sprite, renderable.layer);
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
        
        const batchKey = `${layer}_${sprite.texture.baseTexture.uid}`;
        let batch = this.batches.get(batchKey);
        
        if (!batch) {
            batch = {
                texture: sprite.texture,
                sprites: [],
                container: new PIXI.Container(),
                layer: layer,
                dirty: true
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
        }
    }
    
    /**
     * Remove sprite from batch
     */
    private removeFromBatch(sprite: PIXI.Sprite, layer: RenderLayer): void {
        if (!sprite.texture) return;
        
        const batchKey = `${layer}_${sprite.texture.baseTexture.uid}`;
        const batch = this.batches.get(batchKey);
        
        if (batch) {
            const index = batch.sprites.indexOf(sprite);
            if (index !== -1) {
                batch.sprites.splice(index, 1);
                batch.dirty = true;
                
                // Remove empty batches
                if (batch.sprites.length === 0) {
                    if (batch.container.parent) {
                        batch.container.parent.removeChild(batch.container);
                    }
                    this.batches.delete(batchKey);
                }
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
    }): void {
        if (config.enableBatching !== undefined) this.enableBatching = config.enableBatching;
        if (config.enableCulling !== undefined) this.enableCulling = config.enableCulling;
        if (config.enableLayering !== undefined) this.enableLayering = config.enableLayering;
        if (config.batchSize !== undefined) this.batchSize = config.batchSize;
        if (config.cullPadding !== undefined) this.cullPadding = config.cullPadding;
        
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
                // Update batch container with current sprite positions
                // This is a simplified batching - in a full implementation,
                // you might use PIXI.ParticleContainer or custom batching
                batch.dirty = false;
                batchedCount += batch.sprites.length;
            }
        }
        
        this.metrics.batchedSprites = batchedCount;
    }
    
    /**
     * Render frame
     */
    render(interpolation: number = 0): void {
        const startTime = performance.now();
        
        try {
            // Perform viewport culling
            this.performCulling();
            
            // Update batches
            this.updateBatches();
            
            // Update metrics
            this.metrics.drawCalls = this.calculateDrawCalls();
            this.metrics.renderTime = performance.now() - startTime;
            this.metrics.lastFrameTime = Date.now();
            
            // Emit render event
            gameEvents.emit({
                type: 'render:frame_rendered',
                timestamp: Date.now(),
                source: 'RenderSystem',
                data: {
                    metrics: this.metrics,
                    interpolation
                }
            });
            
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
    } {
        return {
            enableBatching: this.enableBatching,
            enableCulling: this.enableCulling,
            enableLayering: this.enableLayering,
            batchSize: this.batchSize,
            cullPadding: this.cullPadding
        };
    }
    
    /**
     * Debug information
     */
    getDebugInfo(): {
        renderables: number;
        batches: number;
        layers: number;
        viewport: Viewport;
        metrics: RenderMetrics;
    } {
        return {
            renderables: this.renderables.size,
            batches: this.batches.size,
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