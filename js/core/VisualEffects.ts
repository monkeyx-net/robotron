import * as PIXI from 'pixi.js';
import { Vector2 } from '../utils/Vector2';
import { gameEvents } from './EventSystem';
import { Constants } from '../utils/Constants';
import { saveLoadManager } from './SaveLoadManager';

/**
 * Particle configuration interface
 */
export interface ParticleConfig {
    // Position and movement
    position: Vector2;
    velocity?: Vector2;
    acceleration?: Vector2;
    
    // Visual properties
    color: number;
    alpha?: number;
    size?: number;
    sizeVariation?: number;
    
    // Lifecycle
    lifetime: number;
    lifetimeVariation?: number;
    
    // Animation
    fadeIn?: number;
    fadeOut?: number;
    scaleOverTime?: number;
    rotationSpeed?: number;
    
    // Physics
    gravity?: number;
    friction?: number;
    bounce?: number;
    
    // Shape
    shape?: 'circle' | 'square' | 'diamond' | 'star' | 'line';
    texture?: PIXI.Texture;
}

/**
 * Particle emitter configuration
 */
export interface EmitterConfig {
    // Emission
    particleCount: number;
    emissionRate?: number; // particles per second
    duration?: number; // emitter lifetime
    
    // Spawn area
    spawnArea?: {
        type: 'point' | 'circle' | 'rectangle' | 'line';
        size?: Vector2;
        radius?: number;
    };
    
    // Particle template
    particleTemplate: ParticleConfig;
    
    // Variations
    velocitySpread?: number;
    angleSpread?: number;
    
    // Behavior
    followTarget?: boolean;
    targetPosition?: Vector2;
}

/**
 * Screen shake configuration
 */
export interface ScreenShakeConfig {
    intensity: number;
    duration: number;
    frequency?: number;
    fadeOut?: boolean;
    direction?: 'horizontal' | 'vertical' | 'both';
}

/**
 * Camera effect configuration
 */
export interface CameraEffectConfig {
    type: 'zoom' | 'flash' | 'fade' | 'distortion';
    intensity: number;
    duration: number;
    color?: number;
    easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/**
 * Individual particle class
 */
class Particle {
    public sprite: PIXI.Graphics | PIXI.Sprite;
    public position: Vector2;
    public velocity: Vector2;
    public acceleration: Vector2;
    
    public life: number;
    public maxLife: number;
    public age: number = 0;
    
    public initialSize: number;
    public currentSize: number;
    public initialAlpha: number;
    public currentAlpha: number;
    
    public rotationSpeed: number;
    public gravity: number;
    public friction: number;
    public bounce: number;
    
    public fadeIn: number;
    public fadeOut: number;
    public scaleOverTime: number;
    
    public active: boolean = true;
    
    constructor(config: ParticleConfig) {
        this.position = config.position.clone();
        this.velocity = config.velocity?.clone() || new Vector2(0, 0);
        this.acceleration = config.acceleration?.clone() || new Vector2(0, 0);
        
        this.life = config.lifetime + (config.lifetimeVariation || 0) * (Math.random() - 0.5);
        this.maxLife = this.life;
        
        this.initialSize = (config.size || 2) + (config.sizeVariation || 0) * (Math.random() - 0.5);
        this.currentSize = this.initialSize;
        this.initialAlpha = config.alpha || 1;
        this.currentAlpha = this.initialAlpha;
        
        this.rotationSpeed = config.rotationSpeed || 0;
        this.gravity = config.gravity || 0;
        this.friction = config.friction || 1;
        this.bounce = config.bounce || 0;
        
        this.fadeIn = config.fadeIn || 0;
        this.fadeOut = config.fadeOut || 0.3;
        this.scaleOverTime = config.scaleOverTime || 1;
        
        // Create sprite based on configuration
        if (config.texture) {
            this.sprite = new PIXI.Sprite(config.texture);
            this.sprite.anchor.set(0.5);
        } else {
            this.sprite = new PIXI.Graphics();
            this.createShape(config.shape || 'circle', config.color);
        }
        
        this.sprite.x = this.position.x;
        this.sprite.y = this.position.y;
        this.sprite.alpha = this.currentAlpha;
        this.sprite.width = this.currentSize;
        this.sprite.height = this.currentSize;
    }
    
    /**
     * Create particle shape
     */
    private createShape(shape: string, color: number): void {
        const graphics = this.sprite as PIXI.Graphics;
        graphics.clear();
        graphics.beginFill(color);
        
        const size = this.initialSize;
        
        switch (shape) {
            case 'circle':
                graphics.drawCircle(0, 0, size);
                break;
            case 'square':
                graphics.drawRect(-size, -size, size * 2, size * 2);
                break;
            case 'diamond':
                graphics.moveTo(0, -size);
                graphics.lineTo(size, 0);
                graphics.lineTo(0, size);
                graphics.lineTo(-size, 0);
                graphics.closePath();
                break;
            case 'star':
                this.createStar(graphics, size);
                break;
            case 'line':
                graphics.lineStyle(1, color);
                graphics.moveTo(-size, 0);
                graphics.lineTo(size, 0);
                break;
        }
        
        graphics.endFill();
    }
    
    /**
     * Create star shape
     */
    private createStar(graphics: PIXI.Graphics, size: number): void {
        const points = 5;
        const outerRadius = size;
        const innerRadius = size * 0.4;
        
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
        graphics.closePath();
    }
    
    /**
     * Update particle
     */
    public update(deltaTime: number): void {
        if (!this.active) return;
        
        this.age += deltaTime;
        this.life -= deltaTime;
        
        if (this.life <= 0) {
            this.active = false;
            return;
        }
        
        // Apply physics
        this.velocity.add(this.acceleration.clone().multiply(deltaTime));
        this.velocity.y += this.gravity * deltaTime;
        this.velocity.multiply(this.friction);
        
        this.position.add(this.velocity.clone().multiply(deltaTime));
        
        // Update visual properties
        const lifePercent = this.life / this.maxLife;
        const agePercent = this.age / this.maxLife;
        
        // Alpha animation
        let alpha = this.initialAlpha;
        if (agePercent < this.fadeIn) {
            alpha *= agePercent / this.fadeIn;
        } else if (lifePercent < this.fadeOut) {
            alpha *= lifePercent / this.fadeOut;
        }
        this.currentAlpha = alpha;
        
        // Size animation
        this.currentSize = this.initialSize * (1 + (this.scaleOverTime - 1) * agePercent);
        
        // Update sprite
        this.sprite.x = this.position.x;
        this.sprite.y = this.position.y;
        this.sprite.alpha = this.currentAlpha;
        this.sprite.rotation += this.rotationSpeed * deltaTime;
        
        if (this.sprite instanceof PIXI.Graphics) {
            this.sprite.scale.set(this.currentSize / this.initialSize);
        } else {
            this.sprite.width = this.currentSize;
            this.sprite.height = this.currentSize;
        }
        
        // Boundary collision with bounce
        if (this.bounce > 0) {
            const bounds = Constants.GAME_DIMENSIONS;
            if (this.position.x < 0 || this.position.x > bounds.WIDTH) {
                this.velocity.x *= -this.bounce;
                this.position.x = Math.max(0, Math.min(bounds.WIDTH, this.position.x));
            }
            if (this.position.y < 0 || this.position.y > bounds.HEIGHT) {
                this.velocity.y *= -this.bounce;
                this.position.y = Math.max(0, Math.min(bounds.HEIGHT, this.position.y));
            }
        }
    }
    
    /**
     * Destroy particle
     */
    public destroy(): void {
        this.active = false;
        if (this.sprite.parent) {
            this.sprite.parent.removeChild(this.sprite);
        }
        this.sprite.destroy();
    }
}

/**
 * Particle emitter class
 */
class ParticleEmitter {
    private particles: Particle[] = [];
    private config: EmitterConfig;
    private container: PIXI.Container;
    private active: boolean = true;
    private emissionTimer: number = 0;
    private durationTimer: number = 0;
    
    constructor(config: EmitterConfig, container: PIXI.Container) {
        this.config = config;
        this.container = container;
        
        // Emit initial burst if no emission rate specified
        if (!config.emissionRate) {
            this.emitParticles(config.particleCount);
        }
    }
    
    /**
     * Emit particles
     */
    private emitParticles(count: number): void {
        for (let i = 0; i < count; i++) {
            const particleConfig = this.createParticleConfig();
            const particle = new Particle(particleConfig);
            this.particles.push(particle);
            this.container.addChild(particle.sprite);
        }
    }
    
    /**
     * Create particle configuration with variations
     */
    private createParticleConfig(): ParticleConfig {
        const template = this.config.particleTemplate;
        const config: ParticleConfig = { ...template };
        
        // Apply spawn area
        if (this.config.spawnArea) {
            config.position = this.getSpawnPosition();
        }
        
        // Apply velocity variations
        if (config.velocity && this.config.velocitySpread) {
            const spread = this.config.velocitySpread;
            config.velocity = new Vector2(
                config.velocity.x + (Math.random() - 0.5) * spread,
                config.velocity.y + (Math.random() - 0.5) * spread
            );
        }
        
        // Apply angle spread
        if (this.config.angleSpread && config.velocity) {
            const angle = Math.atan2(config.velocity.y, config.velocity.x);
            const newAngle = angle + (Math.random() - 0.5) * this.config.angleSpread;
            const speed = config.velocity.magnitude();
            config.velocity = new Vector2(
                Math.cos(newAngle) * speed,
                Math.sin(newAngle) * speed
            );
        }
        
        return config;
    }
    
    /**
     * Get spawn position based on spawn area
     */
    private getSpawnPosition(): Vector2 {
        const area = this.config.spawnArea!;
        const basePos = this.config.particleTemplate.position;
        
        switch (area.type) {
            case 'point':
                return basePos.clone();
            case 'circle':
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (area.radius || 10);
                return new Vector2(
                    basePos.x + Math.cos(angle) * radius,
                    basePos.y + Math.sin(angle) * radius
                );
            case 'rectangle':
                const size = area.size || new Vector2(20, 20);
                return new Vector2(
                    basePos.x + (Math.random() - 0.5) * size.x,
                    basePos.y + (Math.random() - 0.5) * size.y
                );
            case 'line':
                const lineSize = area.size || new Vector2(20, 0);
                const t = Math.random();
                return new Vector2(
                    basePos.x + t * lineSize.x,
                    basePos.y + t * lineSize.y
                );
            default:
                return basePos.clone();
        }
    }
    
    /**
     * Update emitter
     */
    public update(deltaTime: number): void {
        if (!this.active) return;
        
        // Update duration
        if (this.config.duration) {
            this.durationTimer += deltaTime;
            if (this.durationTimer >= this.config.duration) {
                this.active = false;
            }
        }
        
        // Emit particles based on emission rate
        if (this.active && this.config.emissionRate) {
            this.emissionTimer += deltaTime;
            const emissionInterval = 1 / this.config.emissionRate;
            
            while (this.emissionTimer >= emissionInterval) {
                this.emitParticles(1);
                this.emissionTimer -= emissionInterval;
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update(deltaTime);
            
            if (!particle.active) {
                particle.destroy();
                this.particles.splice(i, 1);
            }
        }
    }
    
    /**
     * Check if emitter is finished
     */
    public isFinished(): boolean {
        return !this.active && this.particles.length === 0;
    }
    
    /**
     * Destroy emitter
     */
    public destroy(): void {
        this.active = false;
        for (const particle of this.particles) {
            particle.destroy();
        }
        this.particles = [];
    }
}

/**
 * Screen shake effect
 */
class ScreenShake {
    private intensity: number = 0;
    private duration: number = 0;
    private timer: number = 0;
    private fadeOut: boolean = true;
    private direction: 'horizontal' | 'vertical' | 'both' = 'both';
    private offset: Vector2 = new Vector2(0, 0);
    
    /**
     * Start screen shake
     */
    public start(config: ScreenShakeConfig): void {
        this.intensity = config.intensity;
        this.duration = config.duration;
        this.fadeOut = config.fadeOut !== false;
        this.direction = config.direction || 'both';
        this.timer = 0;
    }
    
    /**
     * Update screen shake
     */
    public update(deltaTime: number): Vector2 {
        if (this.timer >= this.duration) {
            this.offset.set(0, 0);
            return this.offset;
        }
        
        this.timer += deltaTime;
        
        // Calculate shake intensity with fade out
        let currentIntensity = this.intensity;
        if (this.fadeOut) {
            const progress = this.timer / this.duration;
            currentIntensity *= (1 - progress);
        }
        
        // Generate shake offset
        const shakeX = this.direction !== 'vertical' ? 
            (Math.random() - 0.5) * currentIntensity * 2 : 0;
        const shakeY = this.direction !== 'horizontal' ? 
            (Math.random() - 0.5) * currentIntensity * 2 : 0;
        
        this.offset.set(shakeX, shakeY);
        return this.offset;
    }
    
    /**
     * Check if shake is active
     */
    public isActive(): boolean {
        return this.timer < this.duration;
    }
    
    /**
     * Stop shake
     */
    public stop(): void {
        this.timer = this.duration;
        this.offset.set(0, 0);
    }
}

/**
 * Camera effects manager
 */
class CameraEffects {
    private effects: Map<string, any> = new Map();
    private container: PIXI.Container;
    
    constructor(container: PIXI.Container) {
        this.container = container;
    }
    
    /**
     * Start camera effect
     */
    public startEffect(id: string, config: CameraEffectConfig): void {
        const effect = {
            type: config.type,
            intensity: config.intensity,
            duration: config.duration,
            timer: 0,
            color: config.color || 0xFFFFFF,
            easing: config.easing || 'linear',
            initialValues: this.getCurrentValues()
        };
        
        this.effects.set(id, effect);
    }
    
    /**
     * Get current container values
     */
    private getCurrentValues(): any {
        return {
            scaleX: this.container.scale.x,
            scaleY: this.container.scale.y,
            alpha: this.container.alpha,
            tint: this.container.tint
        };
    }
    
    /**
     * Apply easing function
     */
    private applyEasing(t: number, easing: string): number {
        switch (easing) {
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return 1 - (1 - t) * (1 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            default:
                return t;
        }
    }
    
    /**
     * Update camera effects
     */
    public update(deltaTime: number): void {
        for (const [id, effect] of this.effects) {
            effect.timer += deltaTime;
            const progress = Math.min(effect.timer / effect.duration, 1);
            const easedProgress = this.applyEasing(progress, effect.easing);
            
            switch (effect.type) {
                case 'zoom':
                    const zoomScale = 1 + effect.intensity * easedProgress;
                    this.container.scale.set(zoomScale);
                    break;
                case 'flash':
                    const flashAlpha = effect.intensity * (1 - easedProgress);
                    this.container.tint = effect.color;
                    this.container.alpha = 1 - flashAlpha;
                    break;
                case 'fade':
                    this.container.alpha = effect.initialValues.alpha * (1 - effect.intensity * easedProgress);
                    break;
            }
            
            if (progress >= 1) {
                this.effects.delete(id);
                this.resetContainer();
            }
        }
    }
    
    /**
     * Reset container to default values
     */
    private resetContainer(): void {
        if (this.effects.size === 0) {
            // Don't reset scale as it's managed by the UI system for responsive design
            this.container.alpha = 1;
            this.container.tint = 0xFFFFFF;
        }
    }
    
    /**
     * Stop effect
     */
    public stopEffect(id: string): void {
        this.effects.delete(id);
        if (this.effects.size === 0) {
            this.resetContainer();
        }
    }
}

/**
 * Main visual effects system
 */
export class VisualEffectsSystem {
    private static instance: VisualEffectsSystem;
    private emitters: ParticleEmitter[] = [];
    private screenShake: ScreenShake;
    private cameraEffects: CameraEffects;
    private container: PIXI.Container;
    private gameContainer: PIXI.Container;
    
    private constructor(container: PIXI.Container, gameContainer: PIXI.Container) {
        this.container = container;
        this.gameContainer = gameContainer;
        this.screenShake = new ScreenShake();
        this.cameraEffects = new CameraEffects(gameContainer);
        
        this.setupEventListeners();
    }
    
    /**
     * Initialize visual effects system
     */
    public static initialize(effectsContainer: PIXI.Container, gameContainer: PIXI.Container): VisualEffectsSystem {
        if (!VisualEffectsSystem.instance) {
            VisualEffectsSystem.instance = new VisualEffectsSystem(effectsContainer, gameContainer);
        }
        return VisualEffectsSystem.instance;
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): VisualEffectsSystem {
        if (!VisualEffectsSystem.instance) {
            throw new Error('VisualEffectsSystem not initialized');
        }
        return VisualEffectsSystem.instance;
    }
    
    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Listen for game events that should trigger effects
        gameEvents.on('enemy:destroyed', (event) => {
            // Spheroids show a score popup instead (core/ScorePopup).
            if (event.data.enemyType === 'spheroid') return;
            this.createExplosion(event.data.position, 'enemy');
        });
        
        gameEvents.on('player:hit', (event) => {
            this.startScreenShake({ intensity: 8, duration: 0.3 });
            this.createImpactEffect(event.data.position);
        });
        
        gameEvents.on('projectile:hit', (event) => {
            this.createSparkEffect(event.data.position);
        });
        
        // human:rescued: no particle burst — the arcade shows the bonus
        // value instead (core/ScorePopup).

        // wave:completed: no flash — core/WaveTransition plays the arcade
        // wave-clear sequence.
    }
    
    /**
     * Create explosion effect
     */
    public createExplosion(position: Vector2, type: 'enemy' | 'player' | 'projectile' = 'enemy'): void {
        // Check if particle effects are enabled in user settings
        const settings = saveLoadManager.loadSettings();
        if (!settings.particleEffectsEnabled) {
            // Particle effects are disabled, skip the effect
            return;
        }
        const configs = {
            enemy: {
                particleCount: 20,
                particleTemplate: {
                    position: position,
                    velocity: new Vector2(0, 0),
                    color: 0xFF4444,
                    size: 3,
                    sizeVariation: 2,
                    lifetime: 1.0,
                    lifetimeVariation: 0.5,
                    fadeOut: 0.3,
                    scaleOverTime: 0.5,
                    gravity: 50,
                    friction: 0.95,
                    shape: 'circle' as const
                },
                velocitySpread: 100,
                angleSpread: Math.PI * 2
            },
            player: {
                particleCount: 30,
                particleTemplate: {
                    position: position,
                    velocity: new Vector2(0, 0),
                    color: 0x00AAFF,
                    size: 4,
                    sizeVariation: 2,
                    lifetime: 1.5,
                    lifetimeVariation: 0.5,
                    fadeOut: 0.4,
                    scaleOverTime: 0.3,
                    gravity: 30,
                    friction: 0.9,
                    shape: 'star' as const
                },
                velocitySpread: 120,
                angleSpread: Math.PI * 2
            },
            projectile: {
                particleCount: 8,
                particleTemplate: {
                    position: position,
                    velocity: new Vector2(0, 0),
                    color: 0xFFFF00,
                    size: 2,
                    sizeVariation: 1,
                    lifetime: 0.5,
                    lifetimeVariation: 0.2,
                    fadeOut: 0.2,
                    scaleOverTime: 0.8,
                    gravity: 20,
                    friction: 0.98,
                    shape: 'diamond' as const
                },
                velocitySpread: 60,
                angleSpread: Math.PI * 2
            }
        };
        
        const config = configs[type];
        const emitter = new ParticleEmitter(config, this.container);
        this.emitters.push(emitter);
        
        // Screen shake for larger explosions
        if (type === 'enemy') {
            this.startScreenShake({ intensity: 4, duration: 0.2 });
        } else if (type === 'player') {
            this.startScreenShake({ intensity: 12, duration: 0.5 });
        }
    }
    
    /**
     * Create spark effect
     */
    public createSparkEffect(position: Vector2): void {
        const config: EmitterConfig = {
            particleCount: 6,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFFFFAA,
                size: 1,
                sizeVariation: 0.5,
                lifetime: 0.3,
                lifetimeVariation: 0.1,
                fadeOut: 0.1,
                scaleOverTime: 1.2,
                gravity: 100,
                friction: 0.95,
                shape: 'line'
            },
            velocitySpread: 80,
            angleSpread: Math.PI * 0.5
        };
        
        const emitter = new ParticleEmitter(config, this.container);
        this.emitters.push(emitter);
    }
    
    /**
     * Create impact effect
     */
    public createImpactEffect(position: Vector2): void {
        const config: EmitterConfig = {
            particleCount: 15,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFF0000,
                size: 2,
                sizeVariation: 1,
                lifetime: 0.8,
                lifetimeVariation: 0.3,
                fadeOut: 0.3,
                scaleOverTime: 0.6,
                gravity: 40,
                friction: 0.92,
                shape: 'square'
            },
            velocitySpread: 90,
            angleSpread: Math.PI * 2
        };
        
        const emitter = new ParticleEmitter(config, this.container);
        this.emitters.push(emitter);
    }
    
    /**
     * Create rescue effect
     */
    public createRescueEffect(position: Vector2): void {
        const config: EmitterConfig = {
            particleCount: 12,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, -30),
                color: 0x00FF00,
                size: 2,
                sizeVariation: 1,
                lifetime: 1.2,
                lifetimeVariation: 0.4,
                fadeOut: 0.4,
                scaleOverTime: 1.5,
                gravity: -20, // Negative gravity for upward movement
                friction: 0.98,
                shape: 'star'
            },
            velocitySpread: 40,
            angleSpread: Math.PI * 0.3
        };
        
        const emitter = new ParticleEmitter(config, this.container);
        this.emitters.push(emitter);
    }
    
    /**
     * Start screen shake
     */
    public startScreenShake(config: ScreenShakeConfig): void {
        // Check if screen shake is enabled in user settings
        const settings = saveLoadManager.loadSettings();
        if (!settings.screenShakeEnabled) {
            // Screen shake is disabled, skip the effect
            return;
        }
        
        this.screenShake.start(config);
    }
    
    /**
     * Start camera effect
     */
    public startCameraEffect(id: string, config: CameraEffectConfig): void {
        this.cameraEffects.startEffect(id, config);
    }
    
    /**
     * Update visual effects system
     */
    public update(deltaTime: number): void {
        // Update particle emitters
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const emitter = this.emitters[i];
            emitter.update(deltaTime);
            
            if (emitter.isFinished()) {
                emitter.destroy();
                this.emitters.splice(i, 1);
            }
        }
        
        // Update screen shake
        if (this.screenShake.isActive()) {
            const shakeOffset = this.screenShake.update(deltaTime);
            this.gameContainer.x = shakeOffset.x;
            this.gameContainer.y = shakeOffset.y;
        } else {
            this.gameContainer.x = 0;
            this.gameContainer.y = 0;
        }
        
        // Update camera effects
        this.cameraEffects.update(deltaTime);
    }
    
    /**
     * Clear all effects
     */
    public clearAllEffects(): void {
        // Clear emitters
        for (const emitter of this.emitters) {
            emitter.destroy();
        }
        this.emitters = [];
        
        // Stop screen shake
        this.screenShake.stop();
        
        // Reset camera position and effects (but NOT scale - that's handled by UI system)
        this.gameContainer.x = 0;
        this.gameContainer.y = 0;
        this.gameContainer.alpha = 1;
        this.gameContainer.tint = 0xFFFFFF;
        // Note: We don't reset scale here as it's managed by the UI system for responsive design
    }
    
    /**
     * Get system statistics
     */
    public getStats(): {
        activeEmitters: number;
        totalParticles: number;
        screenShakeActive: boolean;
        cameraEffectsActive: number;
    } {
        let totalParticles = 0;
        for (const emitter of this.emitters) {
            totalParticles += (emitter as any).particles.length;
        }
        
        return {
            activeEmitters: this.emitters.length,
            totalParticles,
            screenShakeActive: this.screenShake.isActive(),
            cameraEffectsActive: (this.cameraEffects as any).effects.size
        };
    }
}