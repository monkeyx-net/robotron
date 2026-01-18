# Visual Effects System Documentation

## Overview

The Robotron 2084 visual effects system provides comprehensive particle effects, screen shake, camera effects, and visual feedback to enhance the game experience. The system is designed to be performant, configurable, and easy to integrate with existing game events.

## Features

### 🎆 Particle System
- **Configurable Particles**: Size, color, lifetime, physics properties
- **Multiple Shapes**: Circle, square, diamond, star, line
- **Physics Simulation**: Gravity, friction, bounce, acceleration
- **Emitter Types**: Burst, continuous, area-based spawning
- **Performance Optimized**: Efficient particle pooling and cleanup

### 📳 Screen Shake
- **Dynamic Intensity**: Configurable shake intensity and duration
- **Directional Control**: Horizontal, vertical, or both directions
- **Fade Out**: Smooth intensity reduction over time
- **Frequency Control**: Adjustable shake frequency

### 📷 Camera Effects
- **Flash Effects**: Screen flashes for damage, healing, events
- **Zoom Effects**: Dynamic camera zoom for impact
- **Fade Effects**: Screen fades for transitions
- **Easing Functions**: Linear, ease-in, ease-out, ease-in-out

### ✨ Special Effects
- **Explosion Variants**: Different types for enemies, player, projectiles
- **Impact Effects**: Sparks, debris, collision feedback
- **Celebration Effects**: Human rescue, wave completion
- **Environmental Effects**: Electrode sparks, smoke trails

## Architecture

### Core Components

```typescript
// Main visual effects system
VisualEffectsSystem
├── ParticleEmitter[]     // Manages particle emitters
├── ScreenShake          // Handles screen shake effects
├── CameraEffects        // Manages camera-based effects
└── Event Integration    // Listens to game events

// Individual particle management
Particle
├── Physics Properties   // Position, velocity, acceleration
├── Visual Properties    // Size, color, alpha, rotation
├── Lifecycle           // Lifetime, fade in/out
└── Shape Rendering     // Circle, square, diamond, star, line

// Effect configuration
EffectPresets
├── Explosions          // Predefined explosion effects
├── Screen Shake        // Screen shake configurations
├── Camera Effects      // Camera effect presets
└── Special Effects     // Unique game event effects
```

## Usage

### Basic Particle Effects

```typescript
import { VisualEffectsSystem } from './core/VisualEffects';
import { Vector2 } from './utils/Vector2';

const visualEffects = VisualEffectsSystem.getInstance();

// Create explosion at position
visualEffects.createExplosion(new Vector2(100, 100), 'enemy');

// Create custom spark effect
visualEffects.createSparkEffect(new Vector2(200, 200));

// Create impact effect
visualEffects.createImpactEffect(new Vector2(300, 300));
```

### Screen Shake Effects

```typescript
// Basic screen shake
visualEffects.startScreenShake({
    intensity: 8,
    duration: 0.3,
    direction: 'both'
});

// Using presets
import { EffectPresets } from './core/EffectPresets';
visualEffects.startScreenShake(EffectPresets.SCREEN_SHAKE.HEAVY);
```

### Camera Effects

```typescript
// Flash effect
visualEffects.startCameraEffect('damage_flash', {
    type: 'flash',
    intensity: 0.6,
    duration: 0.2,
    color: 0xFF0000,
    easing: 'easeOut'
});

// Zoom effect
visualEffects.startCameraEffect('impact_zoom', {
    type: 'zoom',
    intensity: 0.1,
    duration: 0.2,
    easing: 'easeOut'
});
```

### Event-Driven Effects

The system automatically responds to game events:

```typescript
// These events automatically trigger visual effects:
gameEvents.emit({
    type: 'enemy:destroyed',
    data: { position: new Vector2(x, y), enemyType: 'grunt' }
});

gameEvents.emit({
    type: 'player:hit',
    data: { position: new Vector2(x, y) }
});

gameEvents.emit({
    type: 'human:rescued',
    data: { position: new Vector2(x, y) }
});

gameEvents.emit({
    type: 'wave:completed',
    data: { centerPosition: new Vector2(x, y) }
});
```

## Effect Presets

### Explosion Types

```typescript
// Enemy explosions
EffectPresets.EXPLOSIONS.GRUNT(position)      // Small red explosion
EffectPresets.EXPLOSIONS.ENFORCER(position)   // Medium blue explosion
EffectPresets.EXPLOSIONS.HULK(position)       // Large red explosion
EffectPresets.EXPLOSIONS.PLAYER_DEATH(position) // Large blue star explosion

// Custom explosions
EffectPresets.createCustomExplosion(position, 'large', 0xFF0000)
```

### Screen Shake Presets

```typescript
EffectPresets.SCREEN_SHAKE.LIGHT     // Subtle shake for small impacts
EffectPresets.SCREEN_SHAKE.MEDIUM    // Standard shake for enemy destruction
EffectPresets.SCREEN_SHAKE.HEAVY     // Intense shake for player death
EffectPresets.SCREEN_SHAKE.HORIZONTAL // Side-to-side shake
EffectPresets.SCREEN_SHAKE.VERTICAL   // Up-and-down shake
```

### Camera Effect Presets

```typescript
EffectPresets.CAMERA_EFFECTS.DAMAGE_FLASH    // Red flash for damage
EffectPresets.CAMERA_EFFECTS.HEAL_FLASH      // Green flash for healing
EffectPresets.CAMERA_EFFECTS.IMPACT_ZOOM     // Quick zoom for impacts
EffectPresets.CAMERA_EFFECTS.DEATH_FADE      // Fade out for death
```

### Special Effects

```typescript
EffectPresets.SPECIAL_EFFECTS.HUMAN_RESCUED     // Green stars rising up
EffectPresets.SPECIAL_EFFECTS.POWER_UP_COLLECTED // Yellow spinning stars
EffectPresets.SPECIAL_EFFECTS.WAVE_COMPLETE     // Celebration particles
EffectPresets.SPECIAL_EFFECTS.TELEPORT          // Purple swirling effect
```

## Effect Combinations

For complex events, use predefined combinations:

```typescript
import { EffectCombinations } from './core/EffectPresets';

// Player death - explosion + screen shake + camera flash
const effects = EffectCombinations.playerDeath(position);
visualEffects.createExplosion(position, 'player');
visualEffects.startScreenShake(effects.screenShake);
visualEffects.startCameraEffect('death', effects.cameraEffect);

// Wave completion - celebration + camera effect
const waveEffects = EffectCombinations.waveComplete(centerPosition);
// Effects are applied automatically through event system
```

## Performance Considerations

### Optimization Features

- **Automatic Cleanup**: Particles are automatically destroyed when finished
- **Efficient Rendering**: Uses PIXI.js optimized rendering
- **Bounded Effects**: Effects stay within screen boundaries
- **Configurable Quality**: Effect intensity can be adjusted for performance

### Performance Monitoring

```typescript
// Get system statistics
const stats = visualEffects.getStats();
console.log('Active emitters:', stats.activeEmitters);
console.log('Total particles:', stats.totalParticles);
console.log('Screen shake active:', stats.screenShakeActive);
console.log('Camera effects active:', stats.cameraEffectsActive);
```

### Performance Tips

1. **Limit Particle Count**: Keep particle counts reasonable (10-30 per effect)
2. **Use Appropriate Lifetimes**: Shorter lifetimes = better performance
3. **Monitor Active Effects**: Use `getStats()` to monitor system load
4. **Clear When Needed**: Use `clearAllEffects()` for scene transitions

## Configuration

### Particle Configuration

```typescript
interface ParticleConfig {
    position: Vector2;           // Starting position
    velocity?: Vector2;          // Initial velocity
    acceleration?: Vector2;      // Constant acceleration
    color: number;              // Particle color (hex)
    alpha?: number;             // Initial transparency
    size?: number;              // Particle size
    sizeVariation?: number;     // Size randomization
    lifetime: number;           // How long particle lives
    lifetimeVariation?: number; // Lifetime randomization
    fadeIn?: number;            // Fade in duration
    fadeOut?: number;           // Fade out duration
    scaleOverTime?: number;     // Size change over lifetime
    rotationSpeed?: number;     // Rotation speed
    gravity?: number;           // Gravity effect
    friction?: number;          // Velocity dampening
    bounce?: number;            // Boundary bounce factor
    shape?: 'circle' | 'square' | 'diamond' | 'star' | 'line';
}
```

### Emitter Configuration

```typescript
interface EmitterConfig {
    particleCount: number;      // Number of particles to emit
    emissionRate?: number;      // Particles per second (for continuous)
    duration?: number;          // Emitter lifetime
    spawnArea?: {              // Area to spawn particles in
        type: 'point' | 'circle' | 'rectangle' | 'line';
        size?: Vector2;
        radius?: number;
    };
    particleTemplate: ParticleConfig; // Template for particles
    velocitySpread?: number;    // Velocity randomization
    angleSpread?: number;       // Angle randomization
}
```

## Testing

### Browser Console Testing

```javascript
// Test basic explosions
VisualEffectsTest.testExplosions();

// Test screen shake
VisualEffectsTest.testScreenShake();

// Test camera effects
VisualEffectsTest.testCameraEffects();

// Run all tests
VisualEffectsTest.runAllTests();

// Interactive testing - click to create explosions
VisualEffectsTest.enableInteractiveTest();

// Get current statistics
VisualEffectsTest.getStats();

// Clear all effects
VisualEffectsTest.clearAllEffects();
```

### Integration Testing

The system integrates with the game's event system:

```typescript
// Events that trigger visual effects:
'enemy:destroyed'    // Creates explosion based on enemy type
'player:hit'         // Creates impact effect + screen shake
'human:rescued'      // Creates celebration effect
'wave:completed'     // Creates wave completion celebration
'projectile:hit'     // Creates spark effect
```

## Browser Compatibility

- **Modern Browsers**: Full support with hardware acceleration
- **WebGL**: Utilizes WebGL for optimal performance
- **Canvas Fallback**: Graceful degradation to Canvas 2D if needed
- **Mobile Support**: Optimized for mobile devices with touch interaction

## Customization

### Creating Custom Effects

```typescript
// Custom particle configuration
const customConfig: ParticleConfig = {
    position: new Vector2(x, y),
    velocity: new Vector2(vx, vy),
    color: 0xFF00FF,
    size: 4,
    lifetime: 1.5,
    gravity: 100,
    shape: 'star'
};

// Custom emitter
const emitterConfig: EmitterConfig = {
    particleCount: 20,
    particleTemplate: customConfig,
    velocitySpread: 80,
    angleSpread: Math.PI * 2
};
```

### Extending Effect Presets

```typescript
// Add new explosion type
EffectPresets.EXPLOSIONS.CUSTOM_BOSS = (position: Vector2) => ({
    particleCount: 50,
    particleTemplate: {
        position: position,
        color: 0xFF00FF,
        size: 6,
        lifetime: 2.0,
        // ... other properties
    }
});
```

## Future Enhancements

### Planned Features
- **Texture-Based Particles**: Support for sprite-based particles
- **Particle Trails**: Connected particle systems for trails
- **3D Effects**: Pseudo-3D effects for depth
- **Sound Integration**: Synchronized audio-visual effects
- **Effect Scripting**: Timeline-based effect sequences

### Performance Improvements
- **GPU Particles**: WebGL-based particle rendering
- **Instanced Rendering**: Batch rendering for identical particles
- **LOD System**: Level-of-detail for distant effects
- **Adaptive Quality**: Dynamic quality adjustment based on performance

The visual effects system provides a solid foundation for creating engaging and responsive visual feedback in the Robotron 2084 game, with room for future expansion and customization.