/**
 * ObjectPool - Memory management system for game objects
 * 
 * This module provides a generic object pooling system to reduce garbage collection
 * pressure by reusing objects instead of constantly creating and destroying them.
 * This is especially important for frequently created objects like projectiles and particles.
 */

/**
 * Interface for objects that can be pooled
 */
export interface Poolable {
    reset(): void;
}

/**
 * Generic object pool class
 */
export class ObjectPool<T extends Poolable> {
    private objects: T[] = [];
    private factory: () => T;
    private resetFunction?: (obj: T) => void;
    private maxCapacity: number;
    private expansionSize: number;
    
    // Statistics tracking
    private stats = {
        created: 0,
        acquired: 0,
        released: 0,
        expanded: 0,
        currentSize: 0,
        peakSize: 0
    };
    
    constructor(
        factory: () => T,
        initialSize: number = 10,
        maxCapacity: number = 100,
        expansionSize: number = 5
    ) {
        this.factory = factory;
        this.maxCapacity = maxCapacity;
        this.expansionSize = expansionSize;
        
        // Pre-populate the pool
        this.expand(initialSize);
        
        console.log(`ObjectPool created with ${initialSize} objects (max: ${maxCapacity})`);
    }
    
    /**
     * Get an object from the pool
     */
    acquire(): T {
        // If pool is empty, try to expand it
        if (this.objects.length === 0) {
            this.expand(this.expansionSize);
        }
        
        // If still empty after expansion, create a new object
        if (this.objects.length === 0) {
            console.warn('ObjectPool: Creating object outside of pool (pool at capacity)');
            this.stats.created++;
            return this.factory();
        }
        
        const obj = this.objects.pop()!;
        this.stats.acquired++;
        this.stats.currentSize = this.objects.length;
        
        return obj;
    }
    
    /**
     * Return an object to the pool
     */
    release(obj: T): void {
        if (!obj) {
            console.warn('ObjectPool: Attempted to release null/undefined object');
            return;
        }
        
        // Reset the object to clean state
        try {
            obj.reset();
            if (this.resetFunction) {
                this.resetFunction(obj);
            }
        } catch (error) {
            console.error('ObjectPool: Error resetting object:', error);
            return; // Don't add broken objects back to pool
        }
        
        // Only add back to pool if we haven't exceeded capacity
        if (this.objects.length < this.maxCapacity) {
            this.objects.push(obj);
            this.stats.released++;
            this.stats.currentSize = this.objects.length;
            
            // Track peak size
            if (this.stats.currentSize > this.stats.peakSize) {
                this.stats.peakSize = this.stats.currentSize;
            }
        }
    }
    
    /**
     * Get pool statistics
     */
    getStats(): typeof this.stats {
        return { ...this.stats };
    }
    
    /**
     * Clear all objects from the pool
     */
    clear(): void {
        this.objects.length = 0;
        this.stats.currentSize = 0;
    }
    
    /**
     * Get current pool size
     */
    size(): number {
        return this.objects.length;
    }
    
    /**
     * Check if pool is empty
     */
    isEmpty(): boolean {
        return this.objects.length === 0;
    }
    
    /**
     * Set custom reset function
     */
    setResetFunction(resetFn: (obj: T) => void): void {
        this.resetFunction = resetFn;
    }
    
    /**
     * Expand the pool by creating new objects
     */
    private expand(count: number): void {
        const currentTotal = this.objects.length + this.stats.acquired;
        const availableCapacity = this.maxCapacity - currentTotal;
        const actualExpansion = Math.min(count, availableCapacity);
        
        if (actualExpansion <= 0) {
            console.warn('ObjectPool: Cannot expand - at maximum capacity');
            return;
        }
        
        for (let i = 0; i < actualExpansion; i++) {
            try {
                const obj = this.factory();
                this.objects.push(obj);
                this.stats.created++;
            } catch (error) {
                console.error('ObjectPool: Error creating object during expansion:', error);
                break;
            }
        }
        
        this.stats.expanded++;
        this.stats.currentSize = this.objects.length;
        
        if (actualExpansion < count) {
            console.warn(`ObjectPool: Only expanded by ${actualExpansion} instead of ${count} (capacity limit)`);
        }
    }
    
    /**
     * Print debug information about the pool
     */
    printStats(): void {
        console.log('ObjectPool Statistics:', {
            currentSize: this.stats.currentSize,
            peakSize: this.stats.peakSize,
            maxCapacity: this.maxCapacity,
            created: this.stats.created,
            acquired: this.stats.acquired,
            released: this.stats.released,
            expanded: this.stats.expanded,
            efficiency: this.stats.acquired > 0 ? (this.stats.released / this.stats.acquired * 100).toFixed(1) + '%' : '0%'
        });
    }
}

/**
 * Pool manager for managing multiple pools
 */
export class PoolManager {
    private pools: Map<string, ObjectPool<any>> = new Map();
    
    /**
     * Register a pool with a name
     */
    registerPool<T extends Poolable>(name: string, pool: ObjectPool<T>): void {
        this.pools.set(name, pool);
    }
    
    /**
     * Get a pool by name
     */
    getPool<T extends Poolable>(name: string): ObjectPool<T> | undefined {
        return this.pools.get(name);
    }
    
    /**
     * Clear all pools
     */
    clearAll(): void {
        for (const pool of this.pools.values()) {
            pool.clear();
        }
    }
    
    /**
     * Get statistics for all pools
     */
    getAllStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        for (const [name, pool] of this.pools) {
            stats[name] = pool.getStats();
        }
        return stats;
    }
    
    /**
     * Print statistics for all pools
     */
    printAllStats(): void {
        console.log('=== Pool Manager Statistics ===');
        for (const [name, pool] of this.pools) {
            console.log(`${name} Pool:`);
            pool.printStats();
        }
    }
}

/**
 * Global pool manager instance
 */
export const poolManager = new PoolManager();

/**
 * Utility functions for common pooling operations
 */
export const PoolUtils = {
    /**
     * Create a projectile pool
     */
    createProjectilePool(initialSize: number = 20): ObjectPool<any> {
        return new ObjectPool(
            () => ({
                x: 0,
                y: 0,
                dx: 0,
                dy: 0,
                active: false,
                sprite: null,
                reset() {
                    this.x = 0;
                    this.y = 0;
                    this.dx = 0;
                    this.dy = 0;
                    this.active = false;
                    if (this.sprite) {
                        this.sprite.visible = false;
                    }
                }
            }),
            initialSize,
            50
        );
    },
    
    /**
     * Create a particle pool
     */
    createParticlePool(initialSize: number = 50): ObjectPool<any> {
        return new ObjectPool(
            () => ({
                x: 0,
                y: 0,
                dx: 0,
                dy: 0,
                life: 0,
                maxLife: 0,
                color: 0xFFFFFF,
                size: 1,
                active: false,
                sprite: null,
                reset() {
                    this.x = 0;
                    this.y = 0;
                    this.dx = 0;
                    this.dy = 0;
                    this.life = 0;
                    this.maxLife = 0;
                    this.color = 0xFFFFFF;
                    this.size = 1;
                    this.active = false;
                    if (this.sprite) {
                        this.sprite.visible = false;
                    }
                }
            }),
            initialSize,
            100
        );
    },
    
    /**
     * Create a generic game object pool
     */
    createGameObjectPool<T extends Poolable>(
        factory: () => T,
        initialSize: number = 10,
        maxCapacity: number = 50
    ): ObjectPool<T> {
        return new ObjectPool(factory, initialSize, maxCapacity);
    }
};

/**
 * Export main classes and utilities
 */
export {
    poolManager as GamePoolManager
};