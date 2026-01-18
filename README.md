# Robotron: 2084 Web Remake

A faithful recreation of the classic 1982 arcade game **Robotron: 2084** built with modern web technologies.

[![Play Now](https://img.shields.io/badge/Play-Demo-brightgreen?style=for-the-badge)](https://shatch.github.io/robotron/)
[![Release](https://img.shields.io/github/v/release/shatch/robotron?style=for-the-badge)](https://github.com/shatch/robotron/releases)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

## 🎮 Play Now

**[▶️ Launch Game Demo](https://shatch.github.io/robotron/)**

## 📖 About

Robotron: 2084 is a multi-directional shooter arcade game developed by Eugene Jarvis and Larry DeMar of Vid Kidz. This web-based remake faithfully recreates the intense gameplay, featuring:

- **Dual-stick controls**: Move and shoot independently in 8 directions
- **Wave-based gameplay**: Survive increasingly difficult waves of robots
- **Rescue mechanics**: Save human family members for bonus points
- **Multiple enemy types**: Grunts, Hulks, Spheroids, Enforcers, Brains, Tanks, and Quarks
- **Classic arcade feel**: Authentic retro graphics and sound effects

## ✨ Release 2.0 Features

### 🏗️ Complete Architectural Refactoring

Version 2.0 represents a ground-up refactoring using modern software engineering patterns:

- **State Pattern**: Clean state management for Title, Playing, Paused, Game Over states
- **Entity-Component System**: Modular, maintainable game entity architecture
- **Event-Driven Architecture**: Decoupled communication between systems
- **Singleton Pattern**: Unified input and difficulty managers
- **Fixed Timestep Game Loop**: Consistent 60 FPS physics simulation

### 🎯 New Gameplay Features

- **Progressive Difficulty Scaling**:
  - 5 difficulty levels: Easy, Normal, Hard, Nightmare, Adaptive
  - Dynamic difficulty adjustment based on player performance
  - Wave-based scaling that increases challenge over time

- **Enhanced Controls**:
  - Unified input system supporting keyboard, gamepad, and touch
  - Configurable key bindings
  - Input buffering for responsive controls
  - Mac-friendly keyboard shortcuts

- **Improved Enemy AI**:
  - Spheroids now seek corners after spawning (authentic arcade behavior)
  - Better pathfinding for all enemy types
  - Performance-optimized collision detection

- **Visual Polish**:
  - Screen shake effects on damage
  - Particle system for explosions
  - User-configurable visual effects
  - Crisp pixel-perfect scaling

### 🛠️ Technical Improvements

- **Rendering System**: Optimized sprite batching and viewport culling
- **Collision System**: Spatial partitioning for performance
- **Save/Load System**: LocalStorage-based game state persistence
- **Error Handling**: Comprehensive error tracking and recovery
- **Debug Tools**: Built-in console debugging interfaces

### 🐛 Bug Fixes

- Fixed game scaling to properly adapt to browser window size
- Fixed sprite flickering during gameplay
- Fixed enemy spawning positions (no more clumping at origin)
- Fixed pause/resume to preserve game state
- Fixed Spheroid movement to match original arcade behavior
- Game now starts with correct 30 lives (original arcade behavior)

### ✅ Testing & Quality

- **43 automated tests** with 88% pass rate
- Browser-verified with Playwright automated testing
- Comprehensive test coverage for core systems
- Performance monitoring and profiling tools

## 🕹️ Controls

### Keyboard
- **Movement**: WASD or Arrow Keys
- **Shooting**: Arrow Keys (independent of movement)
- **Pause**: P or Escape
- **Start Game**: Enter

### Gamepad
- **Left Stick**: Movement
- **Right Stick**: Shooting direction
- **Start Button**: Pause/Resume
- **A Button**: Start game

### Touch (Mobile)
- Virtual joysticks for movement and shooting

## 🚀 Quick Start

### Play Online
Simply visit the [live demo](https://shatch.github.io/robotron/) - no installation required!

### Run Locally

```bash
# Clone the repository
git clone https://github.com/shatch/robotron.git
cd robotron

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build
npm run preview
```

## 📦 Tech Stack

- **TypeScript**: Static typing for robust code
- **PixiJS v8**: High-performance WebGL 2D rendering
- **Vite**: Lightning-fast build tool and dev server
- **Howler.js**: Cross-browser audio management
- **Modern ES Modules**: Clean, maintainable code structure

## 📁 Project Structure

```
robotron/
├── js/
│   ├── core/              # Core game systems
│   │   ├── GameEngine.ts
│   │   ├── GameStateManager.ts
│   │   ├── InputManager.ts
│   │   ├── DifficultyManager.ts
│   │   ├── CollisionSystem.ts
│   │   └── RenderSystem.ts
│   ├── entities/          # Game entity classes
│   ├── states/            # Game state implementations
│   ├── enemies.ts         # Enemy behavior
│   ├── player.ts          # Player logic
│   └── main.ts            # Entry point
├── assets/                # Textures and sounds
├── index.html
└── package.json
```

## 🎮 Gameplay Tips

1. **Keep Moving**: Standing still is death in Robotron
2. **Prioritize Spheroids**: They spawn Enforcers that will overwhelm you
3. **Save Humans**: Rescue bonus increases with each save
4. **Corner Strategy**: Use corners to funnel enemies
5. **Watch for Brains**: They convert humans into hostile Progs
6. **Difficulty Scaling**: Choose your difficulty level wisely

## 📊 Debug Console

Press F12 to open browser console and access debug commands:

```javascript
// Difficulty System
difficultyDebug.setLevel('nightmare')
difficultyDebug.getMultipliers()
difficultyDebug.getDebugInfo()

// Input System
globalInputManager.inputManager.getMovementVector()

// State System
gameStateDebug.getCurrentState()
gameStateDebug.forceTransition('PLAYING')

// Run automated tests
difficultyTests.runAll()
```

## 🔄 Version History

### Version 2.0 (Current)
- Complete Phase 3 refactoring with modern architecture
- Progressive difficulty scaling system
- Unified input management
- Enhanced visual effects
- Comprehensive bug fixes
- 43 automated tests

### Version 1.0
- Original working implementation
- All classic enemy types
- Human rescue mechanics
- Attract mode and demo play
- Basic gamepad support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Eugene Jarvis & Larry DeMar**: Original Robotron: 2084 creators
- **Williams Electronics**: Original arcade game publisher
- Classic arcade gaming community for preservation efforts
- Modern web development community for amazing tools

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/shatch/robotron/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shatch/robotron/discussions)

## 🎯 Roadmap

### Phase 4 (Planned)
- [ ] Performance optimization with object pooling
- [ ] Enhanced particle effects
- [ ] Online leaderboards
- [ ] Replay system
- [ ] Additional arcade modes

---

**Made with ❤️ by the retro gaming community**

*Robotron: 2084 is a trademark of Williams Electronics. This is an unofficial fan remake for educational purposes.*
