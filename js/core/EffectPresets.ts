import { Vector2 } from '../utils/Vector2';
import { EmitterConfig, ScreenShakeConfig, CameraEffectConfig } from './VisualEffects';

/**
 * Predefined visual effect configurations for common game events
 */
export class EffectPresets {
    
    /**
     * Explosion effects for different entity types
     */
    public static readonly EXPLOSIONS = {
        // Small enemy destruction
        GRUNT: (position: Vector2): EmitterConfig => ({
            particleCount: 12,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFF6644,
                size: 2,
                sizeVariation: 1,
                lifetime: 0.8,
                lifetimeVariation: 0.3,
                fadeOut: 0.3,
                scaleOverTime: 0.7,
                gravity: 60,
                friction: 0.94,
                shape: 'circle'
            },
            velocitySpread: 80,
            angleSpread: Math.PI * 2
        }),
        
        // Medium enemy destruction
        ENFORCER: (position: Vector2): EmitterConfig => ({
            particleCount: 18,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFF4422,
                size: 3,
                sizeVariation: 1.5,
                lifetime: 1.0,
                lifetimeVariation: 0.4,
                fadeOut: 0.3,
                scaleOverTime: 0.6,
                gravity: 50,
                friction: 0.92,
                shape: 'diamond'
            },
            velocitySpread: 100,
            angleSpread: Math.PI * 2
        }),
        
        // Large enemy destruction
        HULK: (position: Vector2): EmitterConfig => ({
            particleCount: 25,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFF2200,
                size: 4,
                sizeVariation: 2,
                lifetime: 1.2,
                lifetimeVariation: 0.5,
                fadeOut: 0.4,
                scaleOverTime: 0.5,
                gravity: 40,
                friction: 0.90,
                shape: 'square'
            },
            velocitySpread: 120,
            angleSpread: Math.PI * 2
        }),
        
        // Player death explosion
        PLAYER_DEATH: (position: Vector2): EmitterConfig => ({
            particleCount: 35,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0x00AAFF,
                size: 5,
                sizeVariation: 2,
                lifetime: 1.8,
                lifetimeVariation: 0.6,
                fadeOut: 0.5,
                scaleOverTime: 0.3,
                gravity: 25,
                friction: 0.88,
                shape: 'star'
            },
            velocitySpread: 140,
            angleSpread: Math.PI * 2
        }),
        
        // Projectile impact
        PROJECTILE_HIT: (position: Vector2): EmitterConfig => ({
            particleCount: 6,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFFFF44,
                size: 1.5,
                sizeVariation: 0.5,
                lifetime: 0.4,
                lifetimeVariation: 0.15,
                fadeOut: 0.2,
                scaleOverTime: 0.8,
                gravity: 80,
                friction: 0.96,
                shape: 'diamond'
            },
            velocitySpread: 60,
            angleSpread: Math.PI * 1.5
        })
    };
    
    /**
     * Continuous effect emitters
     */
    public static readonly CONTINUOUS_EFFECTS = {
        // Muzzle flash for player shooting
        MUZZLE_FLASH: (position: Vector2, direction: Vector2): EmitterConfig => ({
            particleCount: 3,
            emissionRate: 30,
            duration: 0.1,
            particleTemplate: {
                position: position,
                velocity: direction.clone().multiply(50),
                color: 0xFFFFAA,
                size: 2,
                sizeVariation: 1,
                lifetime: 0.2,
                lifetimeVariation: 0.05,
                fadeOut: 0.1,
                scaleOverTime: 1.5,
                gravity: 0,
                friction: 0.9,
                shape: 'line'
            },
            velocitySpread: 30,
            angleSpread: Math.PI * 0.2
        }),
        
        // Sparks from electrode obstacles
        ELECTRODE_SPARKS: (position: Vector2): EmitterConfig => ({
            particleCount: 1,
            emissionRate: 8,
            duration: 2.0,
            spawnArea: {
                type: 'circle',
                radius: 15
            },
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, -20),
                color: 0x00FFFF,
                size: 1,
                sizeVariation: 0.5,
                lifetime: 0.8,
                lifetimeVariation: 0.3,
                fadeOut: 0.3,
                scaleOverTime: 0.9,
                gravity: 100,
                friction: 0.98,
                shape: 'line'
            },
            velocitySpread: 40,
            angleSpread: Math.PI * 0.5
        }),
        
        // Smoke trail for certain projectiles
        SMOKE_TRAIL: (position: Vector2): EmitterConfig => ({
            particleCount: 1,
            emissionRate: 15,
            duration: 1.0,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0x666666,
                size: 3,
                sizeVariation: 1,
                lifetime: 1.5,
                lifetimeVariation: 0.5,
                fadeOut: 0.8,
                scaleOverTime: 2.0,
                gravity: -10,
                friction: 0.95,
                shape: 'circle'
            },
            velocitySpread: 20,
            angleSpread: Math.PI * 2
        })
    };
    
    /**
     * Special visual effects
     */
    public static readonly SPECIAL_EFFECTS = {
        // Human rescue celebration
        HUMAN_RESCUED: (position: Vector2): EmitterConfig => ({
            particleCount: 15,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, -40),
                color: 0x00FF00,
                size: 2,
                sizeVariation: 1,
                lifetime: 1.5,
                lifetimeVariation: 0.5,
                fadeOut: 0.4,
                scaleOverTime: 1.8,
                gravity: -15, // Upward movement
                friction: 0.98,
                shape: 'star'
            },
            velocitySpread: 50,
            angleSpread: Math.PI * 0.4
        }),
        
        // Power-up collection
        POWER_UP_COLLECTED: (position: Vector2): EmitterConfig => ({
            particleCount: 20,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFFFF00,
                size: 3,
                sizeVariation: 1,
                lifetime: 1.0,
                lifetimeVariation: 0.3,
                fadeOut: 0.3,
                scaleOverTime: 2.0,
                gravity: 0,
                friction: 0.95,
                rotationSpeed: 5,
                shape: 'star'
            },
            velocitySpread: 80,
            angleSpread: Math.PI * 2
        }),
        
        // Wave completion celebration
        WAVE_COMPLETE: (position: Vector2): EmitterConfig => ({
            particleCount: 30,
            emissionRate: 20,
            duration: 2.0,
            spawnArea: {
                type: 'rectangle',
                size: new Vector2(100, 20)
            },
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, -30),
                color: 0x00FF00,
                size: 3,
                sizeVariation: 1.5,
                lifetime: 2.0,
                lifetimeVariation: 0.8,
                fadeOut: 0.6,
                scaleOverTime: 1.5,
                gravity: -20,
                friction: 0.99,
                rotationSpeed: 3,
                shape: 'star'
            },
            velocitySpread: 60,
            angleSpread: Math.PI * 0.3
        }),
        
        // Teleportation effect
        TELEPORT: (position: Vector2): EmitterConfig => ({
            particleCount: 25,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: 0xFF00FF,
                size: 2,
                sizeVariation: 1,
                lifetime: 0.8,
                lifetimeVariation: 0.3,
                fadeOut: 0.4,
                scaleOverTime: 0.2,
                gravity: 0,
                friction: 0.9,
                rotationSpeed: 10,
                shape: 'diamond'
            },
            spawnArea: {
                type: 'circle',
                radius: 20
            },
            velocitySpread: 100,
            angleSpread: Math.PI * 2
        })
    };
    
    /**
     * Screen shake presets
     */
    public static readonly SCREEN_SHAKE = {
        // Light shake for small impacts
        LIGHT: {
            intensity: 3,
            duration: 0.15,
            frequency: 30,
            fadeOut: true,
            direction: 'both' as const
        },
        
        // Medium shake for enemy destruction
        MEDIUM: {
            intensity: 6,
            duration: 0.25,
            frequency: 25,
            fadeOut: true,
            direction: 'both' as const
        },
        
        // Heavy shake for player death or large explosions
        HEAVY: {
            intensity: 12,
            duration: 0.4,
            frequency: 20,
            fadeOut: true,
            direction: 'both' as const
        },
        
        // Horizontal shake for side impacts
        HORIZONTAL: {
            intensity: 8,
            duration: 0.3,
            frequency: 25,
            fadeOut: true,
            direction: 'horizontal' as const
        },
        
        // Vertical shake for ground impacts
        VERTICAL: {
            intensity: 8,
            duration: 0.3,
            frequency: 25,
            fadeOut: true,
            direction: 'vertical' as const
        }
    };
    
    /**
     * Camera effect presets
     */
    public static readonly CAMERA_EFFECTS = {
        // Flash effects for various events
        DAMAGE_FLASH: {
            type: 'flash' as const,
            intensity: 0.6,
            duration: 0.2,
            color: 0xFF0000,
            easing: 'easeOut' as const
        },
        
        HEAL_FLASH: {
            type: 'flash' as const,
            intensity: 0.4,
            duration: 0.3,
            color: 0x00FF00,
            easing: 'easeOut' as const
        },
        
        WAVE_COMPLETE_FLASH: {
            type: 'flash' as const,
            intensity: 0.5,
            duration: 0.5,
            color: 0x00FF00,
            easing: 'easeInOut' as const
        },
        
        // Zoom effects
        IMPACT_ZOOM: {
            type: 'zoom' as const,
            intensity: 0.1,
            duration: 0.2,
            easing: 'easeOut' as const
        },
        
        POWER_UP_ZOOM: {
            type: 'zoom' as const,
            intensity: 0.15,
            duration: 0.4,
            easing: 'easeInOut' as const
        },
        
        // Fade effects
        DEATH_FADE: {
            type: 'fade' as const,
            intensity: 0.8,
            duration: 1.0,
            easing: 'easeIn' as const
        },
        
        LEVEL_TRANSITION_FADE: {
            type: 'fade' as const,
            intensity: 1.0,
            duration: 0.5,
            easing: 'linear' as const
        }
    };
    
    /**
     * Get a random color variation
     */
    public static getColorVariation(baseColor: number, variation: number = 0.2): number {
        const r = (baseColor >> 16) & 0xFF;
        const g = (baseColor >> 8) & 0xFF;
        const b = baseColor & 0xFF;
        
        const vary = (component: number) => {
            const delta = Math.floor((Math.random() - 0.5) * variation * 255);
            return Math.max(0, Math.min(255, component + delta));
        };
        
        return (vary(r) << 16) | (vary(g) << 8) | vary(b);
    }
    
    /**
     * Create a custom explosion based on size and intensity
     */
    public static createCustomExplosion(
        position: Vector2, 
        size: 'small' | 'medium' | 'large' | 'huge',
        color: number = 0xFF4444
    ): EmitterConfig {
        const configs = {
            small: { count: 8, particleSize: 2, lifetime: 0.6, spread: 60 },
            medium: { count: 15, particleSize: 3, lifetime: 0.9, spread: 90 },
            large: { count: 25, particleSize: 4, lifetime: 1.2, spread: 120 },
            huge: { count: 40, particleSize: 5, lifetime: 1.5, spread: 150 }
        };
        
        const config = configs[size];
        
        return {
            particleCount: config.count,
            particleTemplate: {
                position: position,
                velocity: new Vector2(0, 0),
                color: color,
                size: config.particleSize,
                sizeVariation: config.particleSize * 0.5,
                lifetime: config.lifetime,
                lifetimeVariation: config.lifetime * 0.4,
                fadeOut: 0.3,
                scaleOverTime: 0.6,
                gravity: 50,
                friction: 0.92,
                shape: 'circle'
            },
            velocitySpread: config.spread,
            angleSpread: Math.PI * 2
        };
    }
    
    /**
     * Create a directional effect (like a blast or impact)
     */
    public static createDirectionalEffect(
        position: Vector2,
        direction: Vector2,
        intensity: number = 1.0
    ): EmitterConfig {
        return {
            particleCount: Math.floor(12 * intensity),
            particleTemplate: {
                position: position,
                velocity: direction.clone().multiply(80 * intensity),
                color: 0xFFAA44,
                size: 2 * intensity,
                sizeVariation: 1,
                lifetime: 0.8,
                lifetimeVariation: 0.3,
                fadeOut: 0.3,
                scaleOverTime: 0.7,
                gravity: 30,
                friction: 0.94,
                shape: 'diamond'
            },
            velocitySpread: 40 * intensity,
            angleSpread: Math.PI * 0.5
        };
    }
}

/**
 * Effect combination presets for complex events
 */
export class EffectCombinations {
    
    /**
     * Player death effect combination
     */
    public static playerDeath(position: Vector2): {
        explosion: EmitterConfig;
        screenShake: ScreenShakeConfig;
        cameraEffect: CameraEffectConfig;
    } {
        return {
            explosion: EffectPresets.EXPLOSIONS.PLAYER_DEATH(position),
            screenShake: EffectPresets.SCREEN_SHAKE.HEAVY,
            cameraEffect: EffectPresets.CAMERA_EFFECTS.DAMAGE_FLASH
        };
    }
    
    /**
     * Boss destruction effect combination
     */
    public static bossDestruction(position: Vector2): {
        explosion: EmitterConfig;
        screenShake: ScreenShakeConfig;
        cameraEffect: CameraEffectConfig;
    } {
        return {
            explosion: EffectPresets.createCustomExplosion(position, 'huge', 0xFF0000),
            screenShake: { ...EffectPresets.SCREEN_SHAKE.HEAVY, duration: 0.8, intensity: 15 },
            cameraEffect: { ...EffectPresets.CAMERA_EFFECTS.WAVE_COMPLETE_FLASH, color: 0xFF4444 }
        };
    }
    
    /**
     * Wave completion effect combination
     */
    public static waveComplete(centerPosition: Vector2): {
        celebration: EmitterConfig;
        cameraEffect: CameraEffectConfig;
    } {
        return {
            celebration: EffectPresets.SPECIAL_EFFECTS.WAVE_COMPLETE(centerPosition),
            cameraEffect: EffectPresets.CAMERA_EFFECTS.WAVE_COMPLETE_FLASH
        };
    }
    
    /**
     * Power-up collection effect combination
     */
    public static powerUpCollected(position: Vector2): {
        particles: EmitterConfig;
        cameraEffect: CameraEffectConfig;
    } {
        return {
            particles: EffectPresets.SPECIAL_EFFECTS.POWER_UP_COLLECTED(position),
            cameraEffect: EffectPresets.CAMERA_EFFECTS.POWER_UP_ZOOM
        };
    }
}