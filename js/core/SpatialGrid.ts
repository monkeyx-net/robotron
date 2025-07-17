/**
 * SpatialGrid - Spatial partitioning system for collision optimization
 * 
 * This module provides a grid-based spatial partitioning system that dramatically
 * improves collision detection performance by only checking objects in nearby cells.
 * Instead of O(n²) collision checks, we get O(n) performance in most cases.
 */

import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { Constants } from '../utils/Constants';

/**
 * Interface for objects that can be stored in the spatial grid
 */
export interface SpatialObject {
    id: string;
    position: Vector2;
    bounds: Rectangle;
    spatialGridCells?: Set<string>; // Track which cells this object is in
}

/**
 * Grid cell containing objects
 */
export interface GridCell {
    objects: Set<SpatialObject>;
    x: number;
    y: number;
    bounds: Rectangle;
}

/**
 * Collision pair for broad-phase filtering
 */
export interface CollisionPair {
    objectA: SpatialObject;
    objectB: SpatialObject;
    distance: number;
}

/**
 * Spatial grid configuration
 */
export interface SpatialGridConfig {
    worldWidth: number;
    worldHeight: number;
    cellSize: number;
    maxObjectsPerCell: number;
    enableDynamicResize: boolean;
}

/**
 * Default spatial grid configuration
 */
const DEFAULT_CONFIG: SpatialGridConfig = {
    worldWidth: Constants.GAME_WIDTH,
    worldHeight: Constants.GAME_HEIGHT,
    cellSize: 64, // 64x64 pixel cells - good balance for Robotron
    maxObjectsPerCell: 10,
    enableDynamicResize: true
};

/**
 * High-performance spatial grid for collision optimization
 */
export class SpatialGrid {
    private config: SpatialGridConfig;
    private cells: Map<string, GridCell> = new Map();
    private objects: Map<string, SpatialObject> = new Map();
    private gridWidth: number;
    private gridHeight: number;
    private cellSize: number;
    
    // Performance tracking
    private stats = {
        totalObjects: 0,
        activeCells: 0,
        collisionPairs: 0,
        lastUpdateTime: 0,
        averageObjectsPerCell: 0
    };
    
    constructor(config: Partial<SpatialGridConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cellSize = this.config.cellSize;
        this.gridWidth = Math.ceil(this.config.worldWidth / this.cellSize);
        this.gridHeight = Math.ceil(this.config.worldHeight / this.cellSize);
        
        console.log(`SpatialGrid initialized: ${this.gridWidth}x${this.gridHeight} cells (${this.cellSize}px each)`);
    }
    
    /**
     * Insert an object into the spatial grid
     */
    insert(object: SpatialObject): void {
        // Remove from old cells if already in grid
        if (this.objects.has(object.id)) {
            this.remove(object.id);
        }
        
        // Store object reference
        this.objects.set(object.id, object);
        
        // Get cells that this object overlaps
        const cells = this.getCellsForBounds(object.bounds);
        object.spatialGridCells = new Set();
        
        // Add object to each overlapping cell
        for (const cellKey of cells) {
            let cell = this.cells.get(cellKey);
            
            if (!cell) {
                const [x, y] = this.parseCellKey(cellKey);
                cell = this.createCell(x, y);
                this.cells.set(cellKey, cell);
            }
            
            cell.objects.add(object);
            object.spatialGridCells.add(cellKey);
        }
        
        this.updateStats();
    }
    
    /**
     * Remove an object from the spatial grid
     */
    remove(objectId: string): boolean {
        const object = this.objects.get(objectId);
        if (!object) {
            return false;
        }
        
        // Remove from all cells
        if (object.spatialGridCells) {
            for (const cellKey of object.spatialGridCells) {
                const cell = this.cells.get(cellKey);
                if (cell) {
                    cell.objects.delete(object);
                    
                    // Remove empty cells to save memory
                    if (cell.objects.size === 0) {
                        this.cells.delete(cellKey);
                    }
                }
            }
            object.spatialGridCells.clear();
        }
        
        // Remove object reference
        this.objects.delete(objectId);
        this.updateStats();
        
        return true;
    }
    
    /**
     * Update an object's position in the grid
     */
    update(object: SpatialObject): void {
        // Simply re-insert the object (handles cell changes automatically)
        this.insert(object);
    }
    
    /**
     * Query objects in a specific area
     */
    query(bounds: Rectangle): SpatialObject[] {
        const results = new Set<SpatialObject>();
        const cells = this.getCellsForBounds(bounds);
        
        for (const cellKey of cells) {
            const cell = this.cells.get(cellKey);
            if (cell) {
                for (const object of cell.objects) {
                    // Double-check that object actually intersects the query bounds
                    if (object.bounds.intersects(bounds)) {
                        results.add(object);
                    }
                }
            }
        }
        
        return Array.from(results);
    }
    
    /**
     * Query objects near a specific point
     */
    queryPoint(point: Vector2, radius: number = 0): SpatialObject[] {
        const bounds = new Rectangle(
            point.x - radius,
            point.y - radius,
            radius * 2,
            radius * 2
        );
        
        const objects = this.query(bounds);
        
        // If radius is specified, filter by actual distance
        if (radius > 0) {
            return objects.filter(obj => {
                const distance = point.distanceTo(obj.position);
                return distance <= radius;
            });
        }
        
        return objects;
    }
    
    /**
     * Get potential collision pairs using broad-phase filtering
     */
    getCollisionPairs(objectTypes?: string[]): CollisionPair[] {
        const pairs: CollisionPair[] = [];
        const processedPairs = new Set<string>();
        
        // Iterate through all active cells
        for (const cell of this.cells.values()) {
            const objects = Array.from(cell.objects);
            
            // Check all pairs within this cell
            for (let i = 0; i < objects.length; i++) {
                for (let j = i + 1; j < objects.length; j++) {
                    const objA = objects[i];
                    const objB = objects[j];
                    
                    // Create unique pair ID (sorted to avoid duplicates)
                    const pairId = objA.id < objB.id ? `${objA.id}:${objB.id}` : `${objB.id}:${objA.id}`;
                    
                    if (processedPairs.has(pairId)) {
                        continue;
                    }
                    processedPairs.add(pairId);
                    
                    // Filter by object types if specified
                    if (objectTypes && objectTypes.length > 0) {
                        // This would require objects to have a 'type' property
                        // For now, we'll skip this filtering
                    }
                    
                    // Calculate distance for sorting/prioritization
                    const distance = objA.position.distanceTo(objB.position);
                    
                    pairs.push({
                        objectA: objA,
                        objectB: objB,
                        distance
                    });
                }
            }
        }
        
        // Sort pairs by distance (closest first for better cache performance)
        pairs.sort((a, b) => a.distance - b.distance);
        
        this.stats.collisionPairs = pairs.length;
        return pairs;
    }
    
    /**
     * Clear all objects from the grid
     */
    clear(): void {
        this.cells.clear();
        this.objects.clear();
        this.updateStats();
    }
    
    /**
     * Get grid statistics for debugging and optimization
     */
    getStats(): {
        totalObjects: number;
        activeCells: number;
        collisionPairs: number;
        averageObjectsPerCell: number;
        gridDimensions: { width: number; height: number };
        cellSize: number;
        memoryUsage: number;
    } {
        return {
            ...this.stats,
            gridDimensions: { width: this.gridWidth, height: this.gridHeight },
            cellSize: this.cellSize,
            memoryUsage: this.cells.size * 100 + this.objects.size * 50 // Rough estimate
        };
    }
    
    /**
     * Resize the grid dynamically based on object distribution
     */
    resize(newCellSize: number): void {
        if (!this.config.enableDynamicResize) {
            return;
        }
        
        // Store current objects
        const currentObjects = Array.from(this.objects.values());
        
        // Clear and reconfigure
        this.clear();
        this.cellSize = newCellSize;
        this.gridWidth = Math.ceil(this.config.worldWidth / this.cellSize);
        this.gridHeight = Math.ceil(this.config.worldHeight / this.cellSize);
        
        // Re-insert all objects
        for (const object of currentObjects) {
            this.insert(object);
        }
        
        console.log(`SpatialGrid resized: ${this.gridWidth}x${this.gridHeight} cells (${this.cellSize}px each)`);
    }
    
    /**
     * Optimize grid performance by analyzing object distribution
     */
    optimize(): void {
        if (!this.config.enableDynamicResize) {
            return;
        }
        
        const stats = this.getStats();
        
        // If average objects per cell is too high, make cells smaller
        if (stats.averageObjectsPerCell > this.config.maxObjectsPerCell) {
            const newCellSize = Math.max(32, this.cellSize * 0.8);
            if (newCellSize !== this.cellSize) {
                console.log(`SpatialGrid: Reducing cell size from ${this.cellSize} to ${newCellSize}`);
                this.resize(newCellSize);
            }
        }
        // If average objects per cell is too low, make cells larger
        else if (stats.averageObjectsPerCell < this.config.maxObjectsPerCell / 4 && this.cellSize < 128) {
            const newCellSize = Math.min(128, this.cellSize * 1.2);
            if (newCellSize !== this.cellSize) {
                console.log(`SpatialGrid: Increasing cell size from ${this.cellSize} to ${newCellSize}`);
                this.resize(newCellSize);
            }
        }
    }
    
    /**
     * Get debug visualization data
     */
    getDebugData(): {
        cells: Array<{ bounds: Rectangle; objectCount: number }>;
        objects: Array<{ position: Vector2; bounds: Rectangle; cellCount: number }>;
    } {
        const cells = Array.from(this.cells.values()).map(cell => ({
            bounds: cell.bounds,
            objectCount: cell.objects.size
        }));
        
        const objects = Array.from(this.objects.values()).map(obj => ({
            position: obj.position,
            bounds: obj.bounds,
            cellCount: obj.spatialGridCells?.size || 0
        }));
        
        return { cells, objects };
    }
    
    /**
     * Get all cells that a bounds rectangle overlaps
     */
    private getCellsForBounds(bounds: Rectangle): string[] {
        const cells: string[] = [];
        
        // Calculate grid coordinates
        const startX = Math.max(0, Math.floor(bounds.x / this.cellSize));
        const endX = Math.min(this.gridWidth - 1, Math.floor((bounds.x + bounds.width) / this.cellSize));
        const startY = Math.max(0, Math.floor(bounds.y / this.cellSize));
        const endY = Math.min(this.gridHeight - 1, Math.floor((bounds.y + bounds.height) / this.cellSize));
        
        // Add all overlapping cells
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                cells.push(this.createCellKey(x, y));
            }
        }
        
        return cells;
    }
    
    /**
     * Create a new grid cell
     */
    private createCell(x: number, y: number): GridCell {
        return {
            objects: new Set(),
            x,
            y,
            bounds: new Rectangle(
                x * this.cellSize,
                y * this.cellSize,
                this.cellSize,
                this.cellSize
            )
        };
    }
    
    /**
     * Create a unique key for a grid cell
     */
    private createCellKey(x: number, y: number): string {
        return `${x},${y}`;
    }
    
    /**
     * Parse a cell key back to coordinates
     */
    private parseCellKey(key: string): [number, number] {
        const [x, y] = key.split(',').map(Number);
        return [x, y];
    }
    
    /**
     * Update internal statistics
     */
    private updateStats(): void {
        this.stats.totalObjects = this.objects.size;
        this.stats.activeCells = this.cells.size;
        this.stats.lastUpdateTime = Date.now();
        
        // Calculate average objects per cell
        if (this.cells.size > 0) {
            const totalObjectsInCells = Array.from(this.cells.values())
                .reduce((sum, cell) => sum + cell.objects.size, 0);
            this.stats.averageObjectsPerCell = totalObjectsInCells / this.cells.size;
        } else {
            this.stats.averageObjectsPerCell = 0;
        }
    }
}

/**
 * Global spatial grid instance for the game
 */
export const spatialGrid = new SpatialGrid();

/**
 * Spatial grid utilities
 */
export const SpatialUtils = {
    /**
     * Convert a game object to a spatial object
     */
    createSpatialObject(
        id: string,
        position: Vector2,
        width: number,
        height: number
    ): SpatialObject {
        return {
            id,
            position: position.clone(),
            bounds: new Rectangle(
                position.x - width / 2,
                position.y - height / 2,
                width,
                height
            )
        };
    },
    
    /**
     * Update spatial object from game object
     */
    updateSpatialObject(
        spatialObj: SpatialObject,
        position: Vector2,
        width: number,
        height: number
    ): void {
        spatialObj.position = position.clone();
        spatialObj.bounds = new Rectangle(
            position.x - width / 2,
            position.y - height / 2,
            width,
            height
        );
    },
    
    /**
     * Batch insert multiple objects
     */
    batchInsert(grid: SpatialGrid, objects: SpatialObject[]): void {
        for (const obj of objects) {
            grid.insert(obj);
        }
    },
    
    /**
     * Batch update multiple objects
     */
    batchUpdate(grid: SpatialGrid, objects: SpatialObject[]): void {
        for (const obj of objects) {
            grid.update(obj);
        }
    }
};

/**
 * Export main classes and utilities
 */
export {
    spatialGrid as GameSpatialGrid
};