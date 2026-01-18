/**
 * GameObject - Entity component system implementation
 * 
 * This module provides a flexible GameObject base class with a component system
 * for building game entities. It supports dynamic component addition/removal,
 * hierarchical relationships, and lifecycle management.
 */

import * as PIXI from 'pixi.js';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { gameEvents } from './EventSystem';
import { Poolable } from '../utils/ObjectPool';

/**
 * Component interface for the entity component system
 */
export interface Component {
    name: string;
    gameObject: GameObject;
    enabled: boolean;
    
    // Lifecycle methods
    onAttach?(gameObject: GameObject): void;
    onDetach?(): void;
    onEnable?(): void;
    onDisable?(): void;
    onDestroy?(): void;
    
    // Update methods
    update?(deltaTime: number): void;
    lateUpdate?(deltaTime: number): void;
    render?(interpolation: number): void;
    
    // Optional collision methods
    onCollisionEnter?(other: GameObject): void;
    onCollisionExit?(other: GameObject): void;
}

/**
 * Transform component for position, rotation, and scale
 */
export class Transform implements Component {
    name: string = 'transform';
    gameObject: GameObject;
    enabled: boolean = true;
    
    position: Vector2;
    rotation: number;
    scale: Vector2;
    
    // Previous frame values for interpolation
    previousPosition: Vector2;
    previousRotation: number;
    
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.position = new Vector2(0, 0);
        this.rotation = 0;
        this.scale = new Vector2(1, 1);
        this.previousPosition = this.position.clone();
        this.previousRotation = this.rotation;
    }
    
    /**
     * Update previous transform values for interpolation
     */
    update(): void {
        this.previousPosition = this.position.clone();
        this.previousRotation = this.rotation;
    }
    
    /**
     * Get interpolated position for rendering
     */
    getInterpolatedPosition(interpolation: number): Vector2 {
        return new Vector2(
            this.previousPosition.x + (this.position.x - this.previousPosition.x) * interpolation,
            this.previousPosition.y + (this.position.y - this.previousPosition.y) * interpolation
        );
    }
    
    /**
     * Get interpolated rotation for rendering
     */
    getInterpolatedRotation(interpolation: number): number {
        return this.previousRotation + (this.rotation - this.previousRotation) * interpolation;
    }
    
    /**
     * Move by a delta amount
     */
    translate(deltaX: number, deltaY: number): void {
        this.position.x += deltaX;
        this.position.y += deltaY;
    }
    
    /**
     * Rotate by a delta amount
     */
    rotate(deltaAngle: number): void {
        this.rotation += deltaAngle;
    }
    
    /**
     * Set position directly
     */
    setPosition(x: number, y: number): void {
        this.position.x = x;
        this.position.y = y;
    }
    
    /**
     * Set rotation directly
     */
    setRotation(angle: number): void {
        this.rotation = angle;
    }
    
    /**
     * Set scale directly
     */
    setScale(x: number, y: number): void {
        this.scale.x = x;
        this.scale.y = y;
    }
}

/**
 * Sprite renderer component
 */
export class SpriteRenderer implements Component {
    name: string = 'spriteRenderer';
    gameObject: GameObject;
    enabled: boolean = true;
    
    sprite: PIXI.Sprite;
    
    constructor(gameObject: GameObject, texture: PIXI.Texture) {
        this.gameObject = gameObject;
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5, 0.5); // Center pivot point
    }
    
    onAttach(): void {
        // Add sprite to the game object's container
        if (this.gameObject.container) {
            this.gameObject.container.addChild(this.sprite);
        }
    }
    
    onDetach(): void {
        // Remove sprite from the game object's container
        if (this.sprite.parent) {
            this.sprite.parent.removeChild(this.sprite);
        }
    }
    
    onDestroy(): void {
        this.onDetach();
        this.sprite.destroy();
    }
    
    render(interpolation: number): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        const transform = this.gameObject.transform;
        if (!transform) return;
        
        // Get interpolated position and rotation
        const interpolatedPosition = transform.getInterpolatedPosition(interpolation);
        const interpolatedRotation = transform.getInterpolatedRotation(interpolation);
        
        // Update sprite properties
        this.sprite.position.set(interpolatedPosition.x, interpolatedPosition.y);
        this.sprite.rotation = interpolatedRotation;
        this.sprite.scale.set(transform.scale.x, transform.scale.y);
        this.sprite.visible = this.gameObject.visible;
    }
    
    /**
     * Set sprite texture
     */
    setTexture(texture: PIXI.Texture): void {
        this.sprite.texture = texture;
    }
    
    /**
     * Set sprite tint color
     */
    setTint(color: number): void {
        this.sprite.tint = color;
    }
    
    /**
     * Set sprite alpha
     */
    setAlpha(alpha: number): void {
        this.sprite.alpha = alpha;
    }
}

/**
 * Collider component for collision detection
 */
export class Collider implements Component {
    name: string = 'collider';
    gameObject: GameObject;
    enabled: boolean = true;
    
    bounds: Rectangle;
    offset: Vector2;
    isTrigger: boolean;
    
    constructor(gameObject: GameObject, width: number, height: number, isTrigger: boolean = false) {
        this.gameObject = gameObject;
        this.bounds = new Rectangle(0, 0, width, height);
        this.offset = new Vector2(0, 0);
        this.isTrigger = isTrigger;
    }
    
    update(): void {
        if (!this.enabled || !this.gameObject.active) return;
        
        const transform = this.gameObject.transform;
        if (!transform) return;
        
        // Update bounds based on transform position and offset
        this.bounds.x = transform.position.x + this.offset.x - this.bounds.width / 2;
        this.bounds.y = transform.position.y + this.offset.y - this.bounds.height / 2;
    }
    
    /**
     * Check if this collider intersects with another
     */
    intersects(other: Collider): boolean {
        return this.bounds.intersects(other.bounds);
    }
    
    /**
     * Set collider size
     */
    setSize(width: number, height: number): void {
        this.bounds.width = width;
        this.bounds.height = height;
    }
    
    /**
     * Set collider offset from game object center
     */
    setOffset(x: number, y: number): void {
        this.offset.x = x;
        this.offset.y = y;
    }
}

/**
 * Rigidbody component for physics simulation
 */
export class Rigidbody implements Component {
    name: string = 'rigidbody';
    gameObject: GameObject;
    enabled: boolean = true;
    
    velocity: Vector2;
    acceleration: Vector2;
    mass: number;
    drag: number;
    useGravity: boolean;
    isKinematic: boolean;
    
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.mass = 1;
        this.drag = 0.1;
        this.useGravity = false;
        this.isKinematic = false;
    }
    
    update(deltaTime: number): void {
        if (!this.enabled || !this.gameObject.active || this.isKinematic) return;
        
        const transform = this.gameObject.transform;
        if (!transform) return;
        
        // Apply acceleration
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;
        
        // Apply drag
        this.velocity.x *= (1 - this.drag);
        this.velocity.y *= (1 - this.drag);
        
        // Apply velocity to position
        transform.position.x += this.velocity.x * deltaTime;
        transform.position.y += this.velocity.y * deltaTime;
        
        // Reset acceleration
        this.acceleration.x = 0;
        this.acceleration.y = 0;
    }
    
    /**
     * Apply a force to the rigidbody
     */
    applyForce(forceX: number, forceY: number): void {
        this.acceleration.x += forceX / this.mass;
        this.acceleration.y += forceY / this.mass;
    }
    
    /**
     * Apply an impulse (immediate velocity change)
     */
    applyImpulse(impulseX: number, impulseY: number): void {
        this.velocity.x += impulseX / this.mass;
        this.velocity.y += impulseY / this.mass;
    }
    
    /**
     * Set velocity directly
     */
    setVelocity(x: number, y: number): void {
        this.velocity.x = x;
        this.velocity.y = y;
    }
}

/**
 * GameObject class with component system
 */
export class GameObject implements Poolable {
    id: string;
    name: string;
    tag: string;
    layer: number;
    active: boolean;
    visible: boolean;
    
    // Components
    private components: Map<string, Component>;
    transform: Transform;
    container: PIXI.Container;
    
    // Hierarchy
    parent: GameObject | null;
    children: GameObject[];
    
    constructor(name: string = 'GameObject') {
        this.id = `go_${Math.random().toString(36).substring(2, 9)}`;
        this.name = name;
        this.tag = '';
        this.layer = 0;
        this.active = true;
        this.visible = true;
        
        this.components = new Map();
        this.container = new PIXI.Container();
        this.parent = null;
        this.children = [];
        
        // Add transform component by default
        this.transform = new Transform(this);
        this.addComponent(this.transform);
    }
    
    /**
     * Add a component to the game object
     */
    addComponent<T extends Component>(component: T): T {
        if (this.components.has(component.name)) {
            console.warn(`GameObject '${this.name}' already has a component named '${component.name}'`);
            return this.components.get(component.name) as T;
        }
        
        this.components.set(component.name, component);
        component.gameObject = this;
        
        // Call onAttach lifecycle method
        if (component.onAttach) {
            try {
                component.onAttach(this);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    ErrorCategory.GAME_LOGIC,
                    ErrorSeverity.MEDIUM,
                    { gameObject: this.name, component: component.name },
                    'GameObject.addComponent'
                );
            }
        }
        
        return component;
    }
    
    /**
     * Get a component by name
     */
    getComponent<T extends Component>(name: string): T | undefined {
        return this.components.get(name) as T | undefined;
    }
    
    /**
     * Get the number of components
     */
    getComponentCount(): number {
        return this.components.size;
    }
    
    /**
     * Get the display object for rendering (PIXI compatibility)
     */
    getDisplayObject(): PIXI.DisplayObject {
        const spriteRenderer = this.getComponent<SpriteRenderer>('spriteRenderer');
        if (spriteRenderer) {
            return spriteRenderer.sprite;
        }
        
        // Return a simple container if no sprite renderer
        return new PIXI.Container();
    }
    
    /**
     * Check if the game object has a component
     */
    hasComponent(name: string): boolean {
        return this.components.has(name);
    }
    
    /**
     * Remove a component by name
     */
    removeComponent(name: string): boolean {
        if (name === 'transform') {
            console.warn("Cannot remove the transform component");
            return false;
        }
        
        const component = this.components.get(name);
        if (!component) return false;
        
        // Call onDetach lifecycle method
        if (component.onDetach) {
            try {
                component.onDetach();
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    ErrorCategory.GAME_LOGIC,
                    ErrorSeverity.LOW,
                    { gameObject: this.name, component: name },
                    'GameObject.removeComponent'
                );
            }
        }
        
        this.components.delete(name);
        return true;
    }
    
    /**
     * Update the game object and its components
     */
    update(deltaTime: number): void {
        if (!this.active) return;
        
        // Update components
        for (const component of this.components.values()) {
            if (component.enabled && component.update) {
                try {
                    component.update(deltaTime);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.MEDIUM,
                        { gameObject: this.name, component: component.name },
                        'GameObject.update'
                    );
                    
                    // Disable problematic component
                    component.enabled = false;
                }
            }
        }
        
        // Update children
        for (const child of this.children) {
            child.update(deltaTime);
        }
    }
    
    /**
     * Late update for operations that should happen after regular updates
     */
    lateUpdate(deltaTime: number): void {
        if (!this.active) return;
        
        // Late update components
        for (const component of this.components.values()) {
            if (component.enabled && component.lateUpdate) {
                try {
                    component.lateUpdate(deltaTime);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { gameObject: this.name, component: component.name },
                        'GameObject.lateUpdate'
                    );
                }
            }
        }
        
        // Late update children
        for (const child of this.children) {
            child.lateUpdate(deltaTime);
        }
    }
    
    /**
     * Render the game object and its components
     */
    render(interpolation: number): void {
        if (!this.active) return;
        
        // Render components
        for (const component of this.components.values()) {
            if (component.enabled && component.render) {
                try {
                    component.render(interpolation);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.RENDERING,
                        ErrorSeverity.MEDIUM,
                        { gameObject: this.name, component: component.name },
                        'GameObject.render'
                    );
                }
            }
        }
        
        // Render children
        for (const child of this.children) {
            child.render(interpolation);
        }
    }
    
    /**
     * Handle collision with another game object
     */
    onCollision(other: GameObject): void {
        if (!this.active) return;
        
        // Notify components
        for (const component of this.components.values()) {
            if (component.enabled && component.onCollisionEnter) {
                try {
                    component.onCollisionEnter(other);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.COLLISION_DETECTION,
                        ErrorSeverity.MEDIUM,
                        { gameObject: this.name, component: component.name, otherGameObject: other.name },
                        'GameObject.onCollision'
                    );
                }
            }
        }
    }
    
    /**
     * Destroy the game object and all its components
     */
    destroy(): void {
        // Destroy components
        for (const component of this.components.values()) {
            if (component.onDestroy) {
                try {
                    component.onDestroy();
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { gameObject: this.name, component: component.name },
                        'GameObject.destroy'
                    );
                }
            }
        }
        
        // Remove from parent
        if (this.parent) {
            this.parent.removeChild(this);
        }
        
        // Destroy children
        for (const child of [...this.children]) {
            child.destroy();
        }
        
        // Clear components
        this.components.clear();
        
        // Destroy container
        this.container.destroy({ children: true });
        
        // Emit destroy event
        gameEvents.emit({
            type: 'gameobject:destroyed',
            timestamp: Date.now(),
            source: 'GameObject',
            data: { id: this.id, name: this.name }
        });
    }
    
    /**
     * Add a child game object
     */
    addChild(child: GameObject): void {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        
        this.children.push(child);
        child.parent = this;
        this.container.addChild(child.container);
    }
    
    /**
     * Remove a child game object
     */
    removeChild(child: GameObject): boolean {
        const index = this.children.indexOf(child);
        if (index === -1) return false;
        
        this.children.splice(index, 1);
        child.parent = null;
        this.container.removeChild(child.container);
        
        return true;
    }
    
    /**
     * Set the game object's active state
     */
    setActive(active: boolean): void {
        this.active = active;
        this.container.visible = active && this.visible;
        
        // Apply to children
        for (const child of this.children) {
            child.setActive(active);
        }
    }
    
    /**
     * Set the game object's visibility
     */
    setVisible(visible: boolean): void {
        this.visible = visible;
        this.container.visible = this.active && visible;
        
        // Apply to children
        for (const child of this.children) {
            child.setVisible(visible);
        }
    }
    
    /**
     * Get the world position of the game object
     */
    getWorldPosition(): Vector2 {
        if (!this.parent) {
            return this.transform.position.clone();
        }
        
        const parentWorldPos = this.parent.getWorldPosition();
        return new Vector2(
            parentWorldPos.x + this.transform.position.x,
            parentWorldPos.y + this.transform.position.y
        );
    }
    
    /**
     * Reset the game object for object pooling
     */
    reset(): void {
        // Reset basic properties
        this.active = true;
        this.visible = true;
        this.tag = '';
        this.layer = 0;
        
        // Reset transform
        this.transform.setPosition(0, 0);
        this.transform.setRotation(0);
        this.transform.setScale(1, 1);
        
        // Reset rigidbody if present
        const rigidbody = this.getComponent<Rigidbody>('rigidbody');
        if (rigidbody) {
            rigidbody.setVelocity(0, 0);
            rigidbody.acceleration.set(0, 0);
        }
        
        // Reset components that have reset methods
        for (const component of this.components.values()) {
            if ('reset' in component && typeof (component as any).reset === 'function') {
                try {
                    (component as any).reset();
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { gameObject: this.name, component: component.name },
                        'GameObject.reset'
                    );
                }
            }
        }
    }
}