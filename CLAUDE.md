# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based remake of the classic arcade game Robotron 2084, built with TypeScript, PixiJS for rendering, and Howler.js for audio. The project is undergoing a significant refactoring from a monolithic structure to a modern, modular architecture using OOP design patterns, performance optimizations, and a comprehensive core systems layer.

**Current State**: The codebase is in a transitional state. The refactoring is partially complete with both legacy and new systems coexisting. The `js/core/` directory contains the new modular architecture, while root-level `js/` files represent the legacy implementation being gradually migrated.

## Development Commands

### Running the Game
```bash
npm run dev          # Start Vite dev server with HMR (default: http://localhost:5173)
npm run build        # TypeScript compilation + Vite production build
npm run preview      # Preview production build locally
```

### Development Notes
- No test runner configured yet (tests are manual imports in main.ts)
- No linting/formatting tools currently set up
- Build output goes to `dist/` directory

## Architecture Overview

### Dual Architecture (Transitional)

**Legacy System** (`js/*.ts`):
- Original IIFE-based modules converted to ES modules
- Global state in `gameState.ts`
- Direct PIXI container management in `main.ts`
- Entity files: `player.ts`, `enemies.ts`, `projectiles.ts`, `humans.ts`, `obstacles.ts`
- Game logic in `gameLogic.ts` (~700 lines)

**New Core System** (`js/core/`):
- Modern OOP architecture with interfaces (`interfaces.ts`)
- Comprehensive systems: `GameEngine.ts`, `AssetManager.ts`, `ErrorHandler.ts`, `EventSystem.ts`
- Advanced features: `CollisionSystem.ts` (spatial partitioning), `RenderSystem.ts` (WebGL optimizations)
- State management: `GameStateManager.ts` with state pattern (`states/` directory)
- Performance: Object pooling, visual effects system, save/load manager
- Dual GameObject classes: Legacy `gameObject.ts` and new `core/GameObject.ts`

### Key System Interactions

1. **Game Loop**: Fixed timestep (60 FPS) in `main.ts` using `requestAnimationFrame`
   - Physics update with accumulator for consistent timing
   - Separate update/render phases
   - Position interpolation for smooth rendering

2. **Rendering Pipeline**:
   - PixiJS v8 with WebGL + canvas fallback
   - Container hierarchy: gameContentContainer > [playerContainer, enemiesContainer, etc.]
   - Pixel-perfect scaling (no antialiasing for retro aesthetic)
   - RenderSystem handles batching, culling, effects

3. **Collision Detection**:
   - Spatial grid/quadtree implementation in `SpatialGrid.ts`
   - Collision layers using bit flags
   - Integration with both legacy and new systems

4. **State Management**:
   - Legacy: String-based states in `gameState.currentGameState`
   - New: State pattern with classes in `core/states/` (TitleState, PlayingState, etc.)
   - Both systems currently active during migration

5. **Input Handling**:
   - Dual-stick arcade controls (movement + shooting)
   - Support: Keyboard (WASD + arrows), Gamepad API, touch virtual joysticks
   - `core/InputManager.ts` for unified input, legacy `inputManager.ts` being phased out

## Code Structure Guidelines

### Entity Creation Pattern

All game entities should extend from base `GameObject` class:

```typescript
// New pattern (core/GameObject.ts)
class Enemy extends GameObject {
  constructor(position: Vector2, type: EntityType) {
    super(type);
    this.transform.position = position;
    // Entity setup with proper lifecycle management
  }
}
```

Legacy entities use PIXI sprites directly - these are being migrated.

### Module Pattern (New Systems)

Core systems use IIFE pattern for encapsulation:

```typescript
export const SystemName = (() => {
  // Private state
  let privateVar = 0;

  // Public interface
  return {
    publicMethod() { /* ... */ }
  };
})();
```

### Event-Driven Communication

Use `EventSystem` for decoupled communication:

```typescript
import { gameEvents } from './core/EventSystem';

// Emit events
gameEvents.emit('enemy:destroyed', { enemyType, score });

// Subscribe to events
gameEvents.subscribe('player:hit', (data) => {
  // Handle player damage
});
```

## Performance Considerations

1. **Object Pooling**: Use for frequently created/destroyed entities (projectiles, effects)
   - Prevents garbage collection stutters
   - Pool implementations in progress for projectile/effect systems

2. **Spatial Partitioning**: Collision detection uses grid-based optimization
   - Reduces O(n²) collision checks to O(n)
   - Configurable grid size in `SpatialGrid.ts`

3. **Rendering Optimization**:
   - Off-screen culling for entities outside viewport
   - Sprite batching to minimize draw calls
   - Texture atlases for related sprites

4. **Memory Management**:
   - Proper cleanup of PIXI resources (sprites, textures)
   - Event listener cleanup on entity destruction
   - Use `destroy()` methods consistently

## Important File Locations

### Configuration
- `js/config.ts` - Game constants (dimensions, speeds, scoring)
- `tsconfig.json` - TypeScript config (strict mode, ES modules)
- `vite.config.ts` - Build tool configuration

### Core Systems
- `js/core/interfaces.ts` - TypeScript interfaces for all major systems
- `js/core/GameEngine.ts` - Main game loop and engine
- `js/core/GameStateManager.ts` - State machine implementation
- `js/core/InputManager.ts` - Unified input system (keyboard, gamepad, touch)
- `js/core/DifficultyManager.ts` - Progressive difficulty scaling with adaptive AI
- `js/core/CollisionSystem.ts` - Optimized collision detection
- `js/core/RenderSystem.ts` - Rendering pipeline with effects
- `js/core/EventSystem.ts` - Event-driven communication between systems

### Game Logic
- `js/main.ts` - Entry point, PIXI initialization, main game loop
- `js/gameLogic.ts` - Legacy game logic (being refactored)
- `js/gameState.ts` - Central game state object

### Entities
- `js/player.ts` - Player class with movement and shooting
- `js/enemies.ts`, `js/enemiesClasses.ts` - Enemy types and AI
- `js/projectiles.ts`, `js/projectile.ts` - Projectile management
- `js/humans.ts`, `js/humanClasses.ts` - Human NPCs

## Refactoring Progress

**Phase 1 - COMPLETE**: Code organization, ES modules, TypeScript setup
**Phase 2 - COMPLETE**: Class-based architecture for entities
**Phase 3 - COMPLETE**: Core systems implementation, state management, unified input, difficulty scaling
**Phase 4 - PLANNED**: Performance optimization (pooling, spatial partitioning)
**Phase 5 - PLANNED**: Testing setup, production optimization

See `GEMINI.md`, `PHASE3_COMPLETION.md`, and `.kiro/specs/robotron-refactoring/` for detailed refactoring plans.

## Common Patterns

### Using the Unified Input System

```typescript
import { UnifiedInputManager, InputAction } from './core/InputManager';

const inputManager = UnifiedInputManager.getInstance();
inputManager.initialize();

// In update loop
inputManager.update();
const movement = inputManager.getMovementVector();  // Returns Vector2
const shooting = inputManager.getShootingVector();  // Returns Vector2

// Check specific actions
if (inputManager.isActionPressed(InputAction.PAUSE)) {
  // Handle pause
}
```

### Using the Difficulty Manager

```typescript
import { difficultyManager, DifficultyLevel } from './core/DifficultyManager';

// Set difficulty
difficultyManager.setDifficultyLevel(DifficultyLevel.HARD);

// Get multipliers for scaling
const multipliers = difficultyManager.getCurrentMultipliers();
const spawnRate = baseSpawnRate * multipliers.enemySpawnRateMultiplier;
const enemySpeed = baseSpeed * multipliers.enemySpeedMultiplier;
const points = basePoints * multipliers.scoreMultiplier;

// Check performance (for adaptive difficulty)
const performance = difficultyManager.getPerformanceScore(); // 0-1

// Debug in browser console
window.difficultyDebug.getDebugInfo();
```

### Adding a New Enemy Type

1. Create class in `enemiesClasses.ts` extending base enemy
2. Add sprite loading in asset manager/main.ts
3. Implement AI behavior (movement, shooting patterns)
4. Add spawn logic in wave management (use difficulty multipliers)
5. Configure collision detection and scoring (apply score multipliers)

### Adding Visual Effects

Use `VisualEffects.ts` system:
- Screen shake, particle effects, flash effects
- Preset configurations in `EffectPresets.ts`
- Effects container in render hierarchy

### Save/Load System

`SaveLoadManager.ts` provides localStorage persistence:
- Game state serialization
- High scores tracking
- Settings persistence (including difficulty preference)
- Version migration support

## Technical Constraints

- **Target Resolution**: 292x240 (original arcade resolution), upscaled via CSS
- **Frame Rate**: 60 FPS target with fixed timestep physics
- **Browser Support**: Modern browsers with WebGL support
- **No Build Dependencies**: Assets loaded at runtime (sprites/, sounds/)

## Testing Approach

Currently no automated test framework. Test files exist as manual imports:
- `core/milestone-test.ts`, `core/milestone2-test.ts`, `core/milestone3-test.ts`
- `core/SaveLoadTest.ts`, `core/VisualEffectsTest.ts`
- Tests are imported in `main.ts` and run via browser console

Future: Vitest/Jest for unit tests, Playwright for E2E (per requirements).

## MCP Integration Notes

The `.kiro/settings/mcp.json` configuration enables:
- **Context7**: Real-time documentation for PixiJS, TypeScript, Vite APIs
- **Playwright**: Browser automation for testing game mechanics, performance monitoring

Use these for library documentation lookups and automated testing when implementing new features.
