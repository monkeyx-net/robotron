# Technology Stack & Build System

## Core Technologies

### Frontend Stack
- **TypeScript** - Primary language for type safety and maintainability
- **PixiJS v8** - High-performance 2D WebGL rendering engine for pixel-perfect graphics
- **Howler.js** - Cross-browser audio management and Web Audio API wrapper
- **Vite** - Fast development server with HMR and optimized production builds

### Build System
- **Vite** as the primary build tool and dev server
- **TypeScript compiler** for type checking and compilation
- **Modern ES modules** with tree-shaking for optimal bundle size

## Common Commands

```bash
# Development
npm run dev          # Start development server with HMR
npm run build        # Build for production (TypeScript + Vite)
npm run preview      # Preview production build locally

# Testing
npm test             # Run test suite (currently placeholder)
```

## Project Configuration

### TypeScript Configuration
- Target: ESNext with modern browser support
- Strict mode enabled with comprehensive type checking
- Module resolution: Node with ES modules
- Includes: `js/**/*.ts` and `js/**/*.js`
- Types: Node, Howler.js, PixiJS

### PixiJS Setup
- Modern v8 API with async initialization
- WebGL rendering with canvas fallback
- Pixel-perfect scaling with `scaleMode: 'nearest'`
- No anti-aliasing for authentic pixel art

### Audio System
- Howler.js for cross-browser compatibility
- Audio sprites for efficient sound management
- Web Audio API integration for advanced effects

## MCP Server Integration

### Context7 MCP Server
- **Documentation Access**: Get up-to-date API documentation for PixiJS, TypeScript, Vite
- **Version Verification**: Ensure compatibility with current library versions
- **Code Examples**: Access official examples and best practices
- **Migration Guides**: Stay current with API changes and deprecations

### Playwright MCP Server  
- **Browser Testing**: Automated testing of game functionality
- **Performance Monitoring**: Real-time FPS and performance metrics
- **Cross-Browser Validation**: Test compatibility across different browsers
- **Debug Assistance**: Interactive debugging of rendering and input issues

## Development Guidelines

### Performance Requirements
- Target 60 FPS consistently
- Object pooling for frequently created/destroyed entities
- Spatial partitioning for collision detection optimization
- Fixed timestep physics simulation

### Asset Management
- Sprites loaded via PixiJS Assets API
- Texture atlases for efficient GPU usage
- Sound files organized by category in `/sounds`
- Sprite sheets in `/sprites` directory

### Browser Compatibility
- Modern browsers with WebGL support
- Gamepad API for controller support
- Touch events for mobile virtual joysticks
- Keyboard input with proper event handling

### MCP-Enhanced Development Workflow
1. **Research**: Use Context7 to verify current API documentation
2. **Implement**: Follow official examples and best practices
3. **Test**: Use Playwright for automated browser testing
4. **Debug**: Leverage Playwright for interactive debugging
5. **Validate**: Continuous performance monitoring via MCP tools