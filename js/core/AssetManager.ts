/**
 * AssetManager - Resource loading and management system
 * 
 * This module provides a comprehensive asset management system for the Robotron game
 * with support for different asset types, caching, error handling, and progress tracking.
 */

import { ErrorCategory, ErrorSeverity, errorHandler } from './ErrorHandler';
import { gameEvents } from './EventSystem';

/**
 * Asset types
 */
export enum AssetType {
    IMAGE = 'image',
    AUDIO = 'audio',
    JSON = 'json',
    TEXT = 'text',
    BINARY = 'binary',
    SPRITE_SHEET = 'spritesheet',
    FONT = 'font'
}

/**
 * Asset status
 */
export enum AssetStatus {
    PENDING = 'pending',
    LOADING = 'loading',
    LOADED = 'loaded',
    ERROR = 'error'
}

/**
 * Asset information interface
 */
export interface AssetInfo {
    id: string;
    url: string;
    type: AssetType;
    status: AssetStatus;
    data?: any;
    error?: Error;
    retries: number;
    maxRetries: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

/**
 * Asset loading options
 */
export interface AssetLoadOptions {
    priority?: number;
    maxRetries?: number;
    metadata?: Record<string, any>;
    onProgress?: (progress: number) => void;
    onComplete?: (asset: AssetInfo) => void;
    onError?: (error: Error, asset: AssetInfo) => void;
}

/**
 * Asset manager configuration
 */
export interface AssetManagerConfig {
    basePath: string;
    maxConcurrentLoads: number;
    defaultMaxRetries: number;
    retryDelay: number;
    cacheLimit: number;
    enableAutomaticErrorHandling: boolean;
}

/**
 * Default asset manager configuration
 */
const DEFAULT_CONFIG: AssetManagerConfig = {
    basePath: '',
    maxConcurrentLoads: 6,
    defaultMaxRetries: 2,
    retryDelay: 1000,
    cacheLimit: 100,
    enableAutomaticErrorHandling: true
};

/**
 * Comprehensive asset manager class
 */
export class AssetManager {
    private config: AssetManagerConfig;
    private assets: Map<string, AssetInfo> = new Map();
    private loadQueue: string[] = [];
    private activeLoads: number = 0;
    private totalLoads: number = 0;
    private completedLoads: number = 0;
    private failedLoads: number = 0;
    
    constructor(config: Partial<AssetManagerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    /**
     * Queue an asset for loading
     */
    queueAsset(
        id: string,
        url: string,
        type: AssetType,
        options: AssetLoadOptions = {}
    ): AssetInfo {
        // Check if asset already exists
        if (this.assets.has(id)) {
            const existingAsset = this.assets.get(id)!;
            
            // If already loaded or loading, return existing asset
            if (existingAsset.status === AssetStatus.LOADED || 
                existingAsset.status === AssetStatus.LOADING) {
                return existingAsset;
            }
            
            // If error, reset for retry
            if (existingAsset.status === AssetStatus.ERROR) {
                existingAsset.status = AssetStatus.PENDING;
                existingAsset.error = undefined;
                existingAsset.retries = 0;
            }
        }
        
        // Create new asset info
        const assetInfo: AssetInfo = {
            id,
            url: this.resolveUrl(url),
            type,
            status: AssetStatus.PENDING,
            retries: 0,
            maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
            timestamp: Date.now(),
            metadata: options.metadata
        };
        
        // Store asset info
        this.assets.set(id, assetInfo);
        
        // Add to load queue with priority
        const priority = options.priority || 0;
        if (priority > 0) {
            // High priority - add to front of queue
            this.loadQueue.unshift(id);
        } else {
            // Normal priority - add to end of queue
            this.loadQueue.push(id);
        }
        
        // Start loading process if not already active
        this.processQueue();
        
        return assetInfo;
    }
    
    /**
     * Load an asset immediately
     */
    async loadAsset<T = any>(
        id: string,
        url: string,
        type: AssetType,
        options: AssetLoadOptions = {}
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Queue the asset
            this.queueAsset(id, url, type, {
                ...options,
                priority: 1, // High priority
                onComplete: (asset) => {
                    options.onComplete?.(asset);
                    resolve(asset.data as T);
                },
                onError: (error, asset) => {
                    options.onError?.(error, asset);
                    reject(error);
                }
            });
        });
    }
    
    /**
     * Get a loaded asset
     */
    getAsset<T = any>(id: string): T | undefined {
        const asset = this.assets.get(id);
        return asset && asset.status === AssetStatus.LOADED ? asset.data as T : undefined;
    }
    
    /**
     * Check if an asset is loaded
     */
    isLoaded(id: string): boolean {
        const asset = this.assets.get(id);
        return asset !== undefined && asset.status === AssetStatus.LOADED;
    }
    
    /**
     * Get asset info
     */
    getAssetInfo(id: string): AssetInfo | undefined {
        return this.assets.get(id);
    }
    
    /**
     * Get loading progress
     */
    getProgress(): number {
        if (this.totalLoads === 0) return 1;
        return this.completedLoads / this.totalLoads;
    }
    
    /**
     * Get loading statistics
     */
    getStats(): {
        total: number;
        completed: number;
        failed: number;
        pending: number;
        active: number;
        progress: number;
    } {
        const pending = this.loadQueue.length;
        const active = this.activeLoads;
        
        return {
            total: this.totalLoads,
            completed: this.completedLoads,
            failed: this.failedLoads,
            pending,
            active,
            progress: this.getProgress()
        };
    }
    
    /**
     * Clear asset cache
     */
    clearCache(olderThan?: number): number {
        let clearedCount = 0;
        
        if (olderThan) {
            // Clear assets older than specified timestamp
            for (const [id, asset] of this.assets.entries()) {
                if (asset.timestamp < olderThan && asset.status !== AssetStatus.LOADING) {
                    this.assets.delete(id);
                    clearedCount++;
                }
            }
        } else {
            // Clear all non-loading assets
            for (const [id, asset] of this.assets.entries()) {
                if (asset.status !== AssetStatus.LOADING) {
                    this.assets.delete(id);
                    clearedCount++;
                }
            }
        }
        
        return clearedCount;
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<AssetManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * Get current configuration
     */
    getConfig(): AssetManagerConfig {
        return { ...this.config };
    }
    
    /**
     * Process the load queue
     */
    private processQueue(): void {
        // If no items in queue or at max concurrent loads, do nothing
        if (this.loadQueue.length === 0 || this.activeLoads >= this.config.maxConcurrentLoads) {
            return;
        }
        
        // Get next asset from queue
        const assetId = this.loadQueue.shift()!;
        const asset = this.assets.get(assetId);
        
        if (!asset) {
            // Asset was removed from cache, skip
            this.processQueue();
            return;
        }
        
        // Update asset status
        asset.status = AssetStatus.LOADING;
        this.activeLoads++;
        this.totalLoads++;
        
        // Emit loading event
        this.emitLoadingEvent(asset);
        
        // Load the asset
        this.loadAssetData(asset)
            .then((data) => {
                // Update asset with loaded data
                asset.data = data;
                asset.status = AssetStatus.LOADED;
                asset.timestamp = Date.now();
                
                // Update counters
                this.activeLoads--;
                this.completedLoads++;
                
                // Emit loaded event
                this.emitLoadedEvent(asset);
                
                // Process next item in queue
                this.processQueue();
            })
            .catch((error) => {
                // Handle load error
                this.handleLoadError(asset, error);
                
                // Process next item in queue
                this.processQueue();
            });
        
        // Process more items if possible
        this.processQueue();
    }
    
    /**
     * Load asset data based on type
     */
    private async loadAssetData(asset: AssetInfo): Promise<any> {
        switch (asset.type) {
            case AssetType.IMAGE:
                return this.loadImage(asset.url);
                
            case AssetType.AUDIO:
                return this.loadAudio(asset.url);
                
            case AssetType.JSON:
                return this.loadJson(asset.url);
                
            case AssetType.TEXT:
                return this.loadText(asset.url);
                
            case AssetType.BINARY:
                return this.loadBinary(asset.url);
                
            case AssetType.SPRITE_SHEET:
                return this.loadSpriteSheet(asset.url, asset.metadata);
                
            case AssetType.FONT:
                return this.loadFont(asset.url, asset.metadata?.fontFamily);
                
            default:
                throw new Error(`Unsupported asset type: ${asset.type}`);
        }
    }
    
    /**
     * Handle asset load error
     */
    private handleLoadError(asset: AssetInfo, error: Error): void {
        // Update asset status
        asset.status = AssetStatus.ERROR;
        asset.error = error;
        asset.timestamp = Date.now();
        
        // Update counters
        this.activeLoads--;
        this.failedLoads++;
        
        // Emit error event
        this.emitErrorEvent(asset, error);
        
        // Handle automatic error handling if enabled
        if (this.config.enableAutomaticErrorHandling) {
            // Log error with error handler
            errorHandler.handleError(
                error,
                ErrorCategory.ASSET_LOADING,
                ErrorSeverity.MEDIUM,
                { assetId: asset.id, assetType: asset.type, url: asset.url },
                'AssetManager'
            );
            
            // Retry loading if retries left
            if (asset.retries < asset.maxRetries) {
                asset.retries++;
                
                // Re-queue asset with delay
                setTimeout(() => {
                    asset.status = AssetStatus.PENDING;
                    this.loadQueue.push(asset.id);
                    this.processQueue();
                }, this.config.retryDelay);
            }
        }
    }
    
    /**
     * Resolve asset URL with base path
     */
    private resolveUrl(url: string): string {
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        
        return `${this.config.basePath}${this.config.basePath.endsWith('/') ? '' : '/'}${url}`;
    }
    
    /**
     * Emit asset loading event
     */
    private emitLoadingEvent(asset: AssetInfo): void {
        gameEvents.emit({
            type: 'asset:loading',
            timestamp: Date.now(),
            source: 'AssetManager',
            data: {
                assetId: asset.id,
                assetType: asset.type,
                url: asset.url
            }
        });
    }
    
    /**
     * Emit asset loaded event
     */
    private emitLoadedEvent(asset: AssetInfo): void {
        gameEvents.emit({
            type: 'asset:loaded',
            timestamp: Date.now(),
            source: 'AssetManager',
            data: {
                assetId: asset.id,
                assetType: asset.type,
                url: asset.url
            }
        });
    }
    
    /**
     * Emit asset error event
     */
    private emitErrorEvent(asset: AssetInfo, error: Error): void {
        gameEvents.emit({
            type: 'asset:error',
            timestamp: Date.now(),
            source: 'AssetManager',
            data: {
                assetId: asset.id,
                assetType: asset.type,
                url: asset.url,
                error: error.message
            }
        });
    }
    
    /**
     * Load an image
     */
    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            
            image.src = url;
        });
    }
    
    /**
     * Load audio
     */
    private loadAudio(url: string): Promise<HTMLAudioElement> {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
            
            audio.src = url;
            audio.load();
        });
    }
    
    /**
     * Load JSON data
     */
    private async loadJson(url: string): Promise<any> {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load JSON: ${url} (${response.status} ${response.statusText})`);
        }
        
        return response.json();
    }
    
    /**
     * Load text data
     */
    private async loadText(url: string): Promise<string> {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load text: ${url} (${response.status} ${response.statusText})`);
        }
        
        return response.text();
    }
    
    /**
     * Load binary data
     */
    private async loadBinary(url: string): Promise<ArrayBuffer> {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load binary: ${url} (${response.status} ${response.statusText})`);
        }
        
        return response.arrayBuffer();
    }
    
    /**
     * Load sprite sheet
     */
    private async loadSpriteSheet(url: string, metadata?: Record<string, any>): Promise<any> {
        // Load the sprite sheet image
        const image = await this.loadImage(url);
        
        // If metadata URL provided, load that too
        if (metadata?.metadataUrl) {
            const jsonData = await this.loadJson(metadata.metadataUrl);
            return { image, data: jsonData };
        }
        
        // Otherwise just return the image
        return { image, data: metadata };
    }
    
    /**
     * Load a font
     */
    private loadFont(url: string, fontFamily?: string): Promise<string> {
        return new Promise((resolve, _reject) => {
            if (!fontFamily) {
                // Extract font family from URL if not provided
                const urlParts = url.split('/');
                const filename = urlParts[urlParts.length - 1];
                fontFamily = filename.split('.')[0];
            }
            
            // Create a style element
            const style = document.createElement('style');
            style.textContent = `
                @font-face {
                    font-family: '${fontFamily}';
                    src: url('${url}') format('truetype');
                }
            `;
            document.head.appendChild(style);
            
            // Use FontFaceObserver or similar library if available
            // For now, use a simple timeout
            setTimeout(() => resolve(fontFamily!), 1000);
        });
    }
}

/**
 * Global asset manager instance
 */
export const assetManager = new AssetManager();

/**
 * Asset loading utilities
 */
export const AssetUtils = {
    /**
     * Preload multiple assets
     */
    async preloadAssets(
        assets: Array<{
            id: string;
            url: string;
            type: AssetType;
            options?: AssetLoadOptions;
        }>,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        let loaded = 0;
        const total = assets.length;
        
        // Queue all assets
        const promises = assets.map(asset => 
            assetManager.loadAsset(asset.id, asset.url, asset.type, {
                ...asset.options,
                onComplete: () => {
                    loaded++;
                    if (onProgress) {
                        onProgress(loaded / total);
                    }
                }
            }).catch(error => {
                console.error(`Failed to load asset ${asset.id}:`, error);
                // Don't fail the entire batch for one asset
                return null;
            })
        );
        
        // Wait for all assets to load
        await Promise.all(promises);
    },
    
    /**
     * Generate a fallback texture using canvas
     */
    generateFallbackTexture(width: number = 16, height: number = 16, color: string = '#FF00FF'): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        
        // Add a border to make it more obvious it's a fallback
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
        
        // Add an X to indicate missing texture
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.lineTo(width - 2, height - 2);
        ctx.moveTo(width - 2, 2);
        ctx.lineTo(2, height - 2);
        ctx.stroke();
        
        return canvas;
    },
    
    /**
     * Create a data URL from canvas
     */
    canvasToDataUrl(canvas: HTMLCanvasElement, format: string = 'image/png'): string {
        return canvas.toDataURL(format);
    },
    
    /**
     * Get asset with fallback
     */
    getAssetWithFallback<T>(
        assetId: string, 
        fallbackGenerator: () => T
    ): T {
        const asset = assetManager.getAsset<T>(assetId);
        return asset || fallbackGenerator();
    }
};

/**
 * Export main classes and utilities
 */
export {
    assetManager as GameAssets
};