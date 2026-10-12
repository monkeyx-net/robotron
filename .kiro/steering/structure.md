# Project Structure & Organization

## Directory Layout

```
/
├── js/                          # All TypeScript/JavaScript source code
│   ├── core/                    # Core game engine and systems
│   │   ├── states/              # Game state implementations
│   │   ├── GameEngine.ts        # Main game loop with fixed timestep
│   │   ├── GameStateManager.ts  # State management system
│   │   ├── CollisionSystem.ts   # Collision detection and spatial grid
│   │   ├── RenderSystem.ts      # Rendering pipeline and optimization
│   │   ├── InputManager.ts      # Unified input handling
│   │   ├── EventSystem.ts       # Event-driven communication
│   │   ├── AssetManager.ts      # Asset loading and management
│   │   ├── ErrorHandler.ts      # Error handling and recovery
│   │   ├── SaveLoadManager.ts   # Save/load system
│   │   ├── VisualEffects.ts     # Particle effects and screen shake
│   │   └── interfaces.ts        # Core type definitions
│   ├── entities/                # Game entity classes
│   │   ├── Player.ts            # Player character implementation
│   │   ├── Enemy.ts             # Base enemy class
│   │   ├── Human.ts             # Human rescue targets
│   │   └── Projectile.ts        # Projectile entities
│   ├── utils/                   # Utility classes and helpers
│   │   ├── Vector2.ts           # 2D vector math
│   │   ├── Rectangle.ts         # Rectangle collision bounds
│   │   ├── ObjectPool.ts        # Object pooling for performance
│   │   └── Constants.ts         # Game constants and configuration
│   ├── ui/                      # User interface components
│   │   └── SaveLoadUI.ts        # Save/load interface
│   ├── config.ts                # Game configuration and constants
│   └── main.ts                  # Application entry point
├── sounds/                      # Audio assets organized by type
├── sprites/                     # Image assets and sprite sheets
├── .kiro/                       # Kiro IDE configuration
│   ├── steering/                # AI assistant guidance documents
│   └── settings/                # IDE and MCP settings
└── index.html                   # Main HTML entry point
```

## Architecture Patterns

### Core Systems Architecture
- **GameEngine**: Fixed timestep game loop with system management
- **Component System**: GameObject with attachable components (Transform, SpriteRenderer, Collider, Rigidbody)
- **State Machine**: Game states (Title, Playing, Paused, GameOver, etc.)
- **Event System**: Decoupled communication between systems
- **Object Pooling**: Performance optimization for frequently created objects

### Entity Organization
- **Base Classes**: GameObject with component system
- **Specialized Entities**: Player, Enemy types, Projectiles, Humans
- **Inheritance Hierarchy**: Shared behavior through base classes
- **Component Composition**: Flexible entity behavior through components

### Module Structure
- **Core Systems**: Engine, rendering, collision, input, audio
- **Game Logic**: Entities, gameplay mechanics, wave management
- **Utilities**: Math, data structures, constants, helpers
- **UI**: Interface components and state management

## Coding Conventions

### File Naming
- **PascalCase** for classes and main modules (`GameEngine.ts`, `Player.ts`)
- **camelCase** for utility functions and simple modules (`config.ts`, `main.ts`)
- **kebab-case** for test files (`milestone-test.ts`, `test-integration.ts`)

### Code Organization
- **Single Responsibility**: Each class/module has one clear purpose
- **Interface Segregation**: Small, focused interfaces in `interfaces.ts`
- **Dependency Injection**: Systems receive dependencies rather than creating them
- **Error Handling**: Comprehensive error handling with recovery strategies

### TypeScript Patterns
- **Strict Mode**: Full TypeScript strict mode enabled
- **Interface First**: Define interfaces before implementations
- **Type Safety**: Avoid `any` type, use proper type definitions
- **Modern ES Features**: Use ES6+ features (classes, modules, async/await)

### Performance Considerations
- **Object Pooling**: Reuse objects instead of creating/destroying
- **Spatial Partitioning**: Grid-based collision detection
- **Batch Rendering**: Group similar render operations
- **Fixed Timestep**: Consistent physics simulation

## Integration Points

### PIXI.js Integration
- **Containers**: Organized rendering hierarchy with proper z-ordering
- **Texture Management**: Efficient loading and caching
- **Sprite Batching**: Automatic batching for performance
- **Modern API**: Uses PIXI v8 async initialization patterns

### Input System
- **Multi-Input**: Keyboard, gamepad, and touch support
- **Action Mapping**: Abstract actions mapped to physical inputs
- **Dead Zone Handling**: Proper gamepad analog stick processing
- **Event-Driven**: Input events propagated through event system

### Save System
- **Local Storage**: Browser localStorage for persistence
- **Settings Management**: Separate settings and game state
- **Serialization**: JSON-based save format
- **Validation**: Save data integrity checking