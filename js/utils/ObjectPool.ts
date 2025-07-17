/**
 * ObjectPool - Generic object pooling system for memory management
 * 
 * This module provides a generic object pooling system to reduce garbage collection
 * pressure by reusing objects instead of constantly creating and destroying them.
 * This is particularly useful for frequently created objects like projectiles,
 * particles, and temporary game objects.
 */

/**
 * Interface for objects that can be pooled
 */
export interface Poolable {
    /**
     * Reset the object to its initial state when returned to the pool
     */
    reset(): void;
    
    /**
     * Check if the object is currently active/in use
     */
    isActive(): boolean;
    
    /**
     * Set the active state of the object
     */
    setActive(active: boolean): void;
}

/**
 * Factory function type for creating new objects
 */
export type ObjectFactory<T> = () => T;

/**
 * Statistics for monitoring pool performance
 */
export interface PoolStats {
    /** Total number of objects in the pool */
    totalObjects: number;
    /** Number of objects currently available for use */
    availableObjects: number;
    /** Number of objects currently in use */
    activeObjects: number;
    /** Total number of objects created since pool creation */
    totalCreated: number;
    /** Total number of objects acquired from the pool */
    totalAcquired: number;
    /** Total number of objects released back to the pool */
    totalReleased: number;
    /** Number of times the pool had to expand */
    expansions: number;
    /** Current capacity of the pool */
    capacity: number;
    /** Maximum number of objects that were active simultaneously */
    peakActiveObjects: number;
}

/**
 * Generic ObjectPool class for managing reusable objects
 */
export class ObjectPool<T extends Poolable> {
    private objects: T[] = [];
    private factory: ObjectFactory<T>;
    private initialCapacity: number;
    private maxCapacity: number;
    private expansionSize: number;
    private stats: PoolStats;
    
    /**
     * Create a new ObjectPool
     * @param factory Function that creates new objects
     * @param initialCapacity Initial number of objects to create
     * @param maxCapacity Maximum number of objects the pool can hold (0 = unlimited)
     * @param expansionSize Number of objects to create when pool needs to expand
     */
    constructor(
        factory: ObjectFactory<T>,
        initialCapacity: number = 10,
        maxCapacity: number = 100,
        expansionSize: number = 5
    ) {\n        this.factory = factory;\n        this.initialCapacity = initialCapacity;\n        this.maxCapacity = maxCapacity;\n        this.expansionSize = expansionSize;\n        \n        // Initialize statistics\n        this.stats = {\n            totalObjects: 0,\n            availableObjects: 0,\n            activeObjects: 0,\n            totalCreated: 0,\n            totalAcquired: 0,\n            totalReleased: 0,\n            expansions: 0,\n            capacity: initialCapacity,\n            peakActiveObjects: 0\n        };\n        \n        // Pre-populate the pool with initial objects\n        this.expand(initialCapacity);\n    }\n    \n    /**\n     * Acquire an object from the pool\n     * @returns An available object from the pool\n     */\n    acquire(): T {\n        let obj: T | undefined;\n        \n        // Find an available object\n        for (let i = 0; i < this.objects.length; i++) {\n            if (!this.objects[i].isActive()) {\n                obj = this.objects[i];\n                break;\n            }\n        }\n        \n        // If no available object found, try to expand the pool\n        if (!obj) {\n            if (this.canExpand()) {\n                this.expand(this.expansionSize);\n                // Try to find an available object again\n                for (let i = 0; i < this.objects.length; i++) {\n                    if (!this.objects[i].isActive()) {\n                        obj = this.objects[i];\n                        break;\n                    }\n                }\n            }\n        }\n        \n        // If still no object available, create a temporary one (not pooled)\n        if (!obj) {\n            console.warn('ObjectPool: Pool exhausted, creating temporary object');\n            obj = this.factory();\n        }\n        \n        // Activate the object and update statistics\n        if (obj) {\n            obj.setActive(true);\n            this.stats.totalAcquired++;\n            this.updateStats();\n        }\n        \n        return obj;\n    }\n    \n    /**\n     * Release an object back to the pool\n     * @param obj The object to release\n     */\n    release(obj: T): void {\n        if (!obj) return;\n        \n        // Reset the object to its initial state\n        obj.reset();\n        obj.setActive(false);\n        \n        // Update statistics\n        this.stats.totalReleased++;\n        this.updateStats();\n    }\n    \n    /**\n     * Release all active objects back to the pool\n     */\n    releaseAll(): void {\n        for (const obj of this.objects) {\n            if (obj.isActive()) {\n                this.release(obj);\n            }\n        }\n    }\n    \n    /**\n     * Clear the pool and destroy all objects\n     */\n    clear(): void {\n        this.objects.length = 0;\n        this.stats.totalObjects = 0;\n        this.stats.availableObjects = 0;\n        this.stats.activeObjects = 0;\n    }\n    \n    /**\n     * Get current pool statistics\n     * @returns Pool statistics object\n     */\n    getStats(): PoolStats {\n        this.updateStats();\n        return { ...this.stats };\n    }\n    \n    /**\n     * Get all active objects from the pool\n     * @returns Array of active objects\n     */\n    getActiveObjects(): T[] {\n        return this.objects.filter(obj => obj.isActive());\n    }\n    \n    /**\n     * Get all available objects from the pool\n     * @returns Array of available objects\n     */\n    getAvailableObjects(): T[] {\n        return this.objects.filter(obj => !obj.isActive());\n    }\n    \n    /**\n     * Check if the pool can expand\n     * @returns True if the pool can create more objects\n     */\n    private canExpand(): boolean {\n        return this.maxCapacity === 0 || this.objects.length < this.maxCapacity;\n    }\n    \n    /**\n     * Expand the pool by creating new objects\n     * @param count Number of objects to create\n     */\n    private expand(count: number): void {\n        const actualCount = this.maxCapacity > 0 \n            ? Math.min(count, this.maxCapacity - this.objects.length)\n            : count;\n            \n        for (let i = 0; i < actualCount; i++) {\n            const obj = this.factory();\n            obj.setActive(false);\n            this.objects.push(obj);\n            this.stats.totalCreated++;\n        }\n        \n        if (actualCount > 0) {\n            this.stats.expansions++;\n            this.stats.capacity = this.objects.length;\n        }\n        \n        this.updateStats();\n    }\n    \n    /**\n     * Update internal statistics\n     */\n    private updateStats(): void {\n        this.stats.totalObjects = this.objects.length;\n        this.stats.activeObjects = this.objects.filter(obj => obj.isActive()).length;\n        this.stats.availableObjects = this.stats.totalObjects - this.stats.activeObjects;\n        \n        // Update peak active objects\n        if (this.stats.activeObjects > this.stats.peakActiveObjects) {\n            this.stats.peakActiveObjects = this.stats.activeObjects;\n        }\n    }\n    \n    /**\n     * Print pool statistics to console (for debugging)\n     */\n    printStats(): void {\n        const stats = this.getStats();\n        console.log('ObjectPool Statistics:', {\n            'Total Objects': stats.totalObjects,\n            'Available': stats.availableObjects,\n            'Active': stats.activeObjects,\n            'Peak Active': stats.peakActiveObjects,\n            'Total Created': stats.totalCreated,\n            'Total Acquired': stats.totalAcquired,\n            'Total Released': stats.totalReleased,\n            'Expansions': stats.expansions,\n            'Capacity': stats.capacity,\n            'Utilization': `${((stats.activeObjects / stats.totalObjects) * 100).toFixed(1)}%`\n        });\n    }\n}\n\n/**\n * Specialized pool for managing PIXI sprites\n */\nexport class SpritePool extends ObjectPool<PoolableSprite> {\n    constructor(\n        textureFactory: () => PIXI.Texture,\n        initialCapacity: number = 20,\n        maxCapacity: number = 200,\n        expansionSize: number = 10\n    ) {\n        super(\n            () => new PoolableSprite(textureFactory()),\n            initialCapacity,\n            maxCapacity,\n            expansionSize\n        );\n    }\n}\n\n/**\n * Poolable wrapper for PIXI.Sprite\n */\nexport class PoolableSprite implements Poolable {\n    public sprite: PIXI.Sprite;\n    private active: boolean = false;\n    \n    constructor(texture: PIXI.Texture) {\n        this.sprite = new PIXI.Sprite(texture);\n    }\n    \n    reset(): void {\n        // Reset sprite properties to defaults\n        this.sprite.x = 0;\n        this.sprite.y = 0;\n        this.sprite.rotation = 0;\n        this.sprite.scale.set(1, 1);\n        this.sprite.alpha = 1;\n        this.sprite.visible = true;\n        this.sprite.tint = 0xFFFFFF;\n        \n        // Remove from parent if it has one\n        if (this.sprite.parent) {\n            this.sprite.parent.removeChild(this.sprite);\n        }\n    }\n    \n    isActive(): boolean {\n        return this.active;\n    }\n    \n    setActive(active: boolean): void {\n        this.active = active;\n        this.sprite.visible = active;\n    }\n}\n\n/**\n * Poolable wrapper for PIXI.Graphics\n */\nexport class PoolableGraphics implements Poolable {\n    public graphics: PIXI.Graphics;\n    private active: boolean = false;\n    \n    constructor() {\n        this.graphics = new PIXI.Graphics();\n    }\n    \n    reset(): void {\n        // Clear graphics and reset properties\n        this.graphics.clear();\n        this.graphics.x = 0;\n        this.graphics.y = 0;\n        this.graphics.rotation = 0;\n        this.graphics.scale.set(1, 1);\n        this.graphics.alpha = 1;\n        this.graphics.visible = true;\n        \n        // Remove from parent if it has one\n        if (this.graphics.parent) {\n            this.graphics.parent.removeChild(this.graphics);\n        }\n    }\n    \n    isActive(): boolean {\n        return this.active;\n    }\n    \n    setActive(active: boolean): void {\n        this.active = active;\n        this.graphics.visible = active;\n    }\n}\n\n/**\n * Pool manager for managing multiple pools\n */\nexport class PoolManager {\n    private pools: Map<string, ObjectPool<any>> = new Map();\n    \n    /**\n     * Register a pool with a name\n     * @param name Pool identifier\n     * @param pool The pool to register\n     */\n    registerPool<T extends Poolable>(name: string, pool: ObjectPool<T>): void {\n        this.pools.set(name, pool);\n    }\n    \n    /**\n     * Get a pool by name\n     * @param name Pool identifier\n     * @returns The requested pool or undefined if not found\n     */\n    getPool<T extends Poolable>(name: string): ObjectPool<T> | undefined {\n        return this.pools.get(name);\n    }\n    \n    /**\n     * Acquire an object from a named pool\n     * @param poolName Pool identifier\n     * @returns Object from the pool or undefined if pool not found\n     */\n    acquire<T extends Poolable>(poolName: string): T | undefined {\n        const pool = this.pools.get(poolName);\n        return pool ? pool.acquire() : undefined;\n    }\n    \n    /**\n     * Release an object back to a named pool\n     * @param poolName Pool identifier\n     * @param obj Object to release\n     */\n    release<T extends Poolable>(poolName: string, obj: T): void {\n        const pool = this.pools.get(poolName);\n        if (pool) {\n            pool.release(obj);\n        }\n    }\n    \n    /**\n     * Release all objects from all pools\n     */\n    releaseAll(): void {\n        for (const pool of this.pools.values()) {\n            pool.releaseAll();\n        }\n    }\n    \n    /**\n     * Clear all pools\n     */\n    clearAll(): void {\n        for (const pool of this.pools.values()) {\n            pool.clear();\n        }\n        this.pools.clear();\n    }\n    \n    /**\n     * Get statistics for all pools\n     * @returns Map of pool names to their statistics\n     */\n    getAllStats(): Map<string, PoolStats> {\n        const stats = new Map<string, PoolStats>();\n        for (const [name, pool] of this.pools) {\n            stats.set(name, pool.getStats());\n        }\n        return stats;\n    }\n    \n    /**\n     * Print statistics for all pools\n     */\n    printAllStats(): void {\n        console.log('=== Pool Manager Statistics ===');\n        for (const [name, pool] of this.pools) {\n            console.log(`\\n${name} Pool:`);\n            pool.printStats();\n        }\n    }\n}\n\n/**\n * Global pool manager instance\n */\nexport const poolManager = new PoolManager();\n\n/**\n * Utility functions for common pooling operations\n */\nexport const PoolUtils = {\n    /**\n     * Create a projectile pool\n     * @param textureFactory Function that creates projectile textures\n     * @param initialCapacity Initial pool size\n     * @returns Configured projectile pool\n     */\n    createProjectilePool(\n        textureFactory: () => PIXI.Texture,\n        initialCapacity: number = 50\n    ): SpritePool {\n        return new SpritePool(textureFactory, initialCapacity, 500, 25);\n    },\n    \n    /**\n     * Create a particle effect pool\n     * @param initialCapacity Initial pool size\n     * @returns Configured particle pool\n     */\n    createParticlePool(initialCapacity: number = 100): ObjectPool<PoolableGraphics> {\n        return new ObjectPool(\n            () => new PoolableGraphics(),\n            initialCapacity,\n            1000,\n            50\n        );\n    },\n    \n    /**\n     * Create a generic sprite pool\n     * @param textureFactory Function that creates textures\n     * @param initialCapacity Initial pool size\n     * @param maxCapacity Maximum pool size\n     * @returns Configured sprite pool\n     */\n    createSpritePool(\n        textureFactory: () => PIXI.Texture,\n        initialCapacity: number = 20,\n        maxCapacity: number = 200\n    ): SpritePool {\n        return new SpritePool(textureFactory, initialCapacity, maxCapacity);\n    }\n};\n\n/**\n * Export the main classes and utilities\n */\nexport {\n    ObjectPool,\n    SpritePool,\n    PoolableSprite,\n    PoolableGraphics,\n    PoolManager\n};