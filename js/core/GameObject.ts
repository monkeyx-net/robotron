import * as PIXI from 'pixi.js';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';

/**
 * Base class for all game objects in Robotron
 * Provides common functionality for position, movement, rendering, and lifecycle management
 */
export abstract class GameObject {
    protected _id: string;
    protected _position: Vector2;
    protected _velocity: Vector2;
    protected _bounds: Rectangle;
    protected _active: boolean;
    protected _destroyed: boolean;
    protected _sprite: PIXI.DisplayObject;
    protected _type: string;

    constructor(sprite: PIXI.DisplayObject, type: string = 'gameobject') {
        this._id = this.generateId();
        this._position = new Vector2(sprite.x, sprite.y);
        this._velocity = new Vector2(0, 0);
        this._bounds = new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
        this._active = true;
        this._destroyed = false;
        this._sprite = sprite;
        this._type = type;
    }

    // Getters
    get id(): string { return this._id; }
    get position(): Vector2 { return this._position; }
    get velocity(): Vector2 { return this._velocity; }
    get bounds(): Rectangle { return this._bounds; }
    get active(): boolean { return this._active; }
    get destroyed(): boolean { return this._destroyed; }
    get sprite(): PIXI.DisplayObject { return this._sprite; }
    get type(): string { return this._type; }

    // Setters
    set active(value: boolean) { this._active = value; }

    /**
     * Update the game object's state
     * @param deltaTime Time elapsed since last update in seconds
     */
    abstract update(deltaTime: number): void;

    /**
     * Update the sprite position based on internal position
     */
    protected updateSpritePosition(): void {
        if (this._sprite && !this._destroyed) {
            this._sprite.x = this._position.x;
            this._sprite.y = this._position.y;
        }
    }

    /**
     * Update the bounds based on current position and sprite dimensions
     */
    protected updateBounds(): void {
        if (this._sprite && !this._destroyed) {
            this._bounds.x = this._position.x - this._sprite.width / 2;
            this._bounds.y = this._position.y - this._sprite.height / 2;
            this._bounds.width = this._sprite.width;
            this._bounds.height = this._sprite.height;
        }
    }

    /**
     * Move the object by the given offset
     */
    public move(offset: Vector2): void {
        this._position.add(offset);
        this.updateSpritePosition();
        this.updateBounds();
    }

    /**
     * Set the object's position
     */
    public setPosition(position: Vector2): void {
        this._position.copy(position);
        this.updateSpritePosition();
        this.updateBounds();
    }

    /**
     * Set the object's velocity
     */
    public setVelocity(velocity: Vector2): void {
        this._velocity.copy(velocity);
    }

    /**
     * Apply velocity to position (basic physics integration)
     */
    protected applyVelocity(deltaTime: number): void {
        const movement = this._velocity.clone().multiply(deltaTime);
        this.move(movement);
    }

    /**
     * Check if this object is colliding with another object
     */
    public isCollidingWith(other: GameObject): boolean {
        return this._bounds.intersects(other._bounds);
    }

    /**
     * Destroy the game object and clean up resources
     */
    public destroy(): void {
        if (this._destroyed) return;
        
        this._destroyed = true;
        this._active = false;
        
        if (this._sprite && this._sprite.destroy) {
            this._sprite.destroy();
        }
    }

    /**
     * Generate a unique ID for this game object
     */
    private generateId(): string {
        return `${this._type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get distance to another game object
     */
    public distanceTo(other: GameObject): number {
        return this._position.distanceTo(other._position);
    }

    /**
     * Get angle to another game object in radians
     */
    public angleTo(other: GameObject): number {
        return this._position.angleTo(other._position);
    }
}