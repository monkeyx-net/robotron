import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { RobotronGame } from './core/GameModule';
import { testFoundationalSystems } from './core/test-integration';
import { runMilestone1Tests, testGameLoading } from './core/milestone-test';
import { runMilestone2Tests } from './core/milestone2-test';
import { runMilestone3Tests } from './core/milestone3-test';
import { Attract } from './attractMode';
import { loadHighScore, resetGameVariables, startNextWave, checkCollisions, checkForExtraLife, checkWaveCompletion, updateBonusDecay } from './gameLogic';
import { collisionIntegration, IntegrationUtils } from './core/CollisionIntegration';
import { gameEngine, GameSystem, EngineUtils } from './core/GameEngine';
import { RenderSystem, RenderLayer, RenderUtils } from './core/RenderSystem';
import { RenderIntegration, GameObjectType } from './core/RenderIntegration';
import { createPlayer, Player } from './player';
import { Projectiles } from './projectiles';
import { Enemies } from './enemies';
import { Humans } from './humans';
import { Obstacles } from './obstacles';
import { Effects } from './effects';
import { SoundManager, initAudio } from './soundManager';
import { UI } from './ui';
// Removed old InputManager - using unified input manager instead
import { gameState } from './gameState';
import { gameEvents } from './core/EventSystem';
import { saveLoadManager } from './core/SaveLoadManager';
import { saveLoadUI } from './ui/SaveLoadUI';
import './core/SaveLoadTest'; // Import for manual testing
import { VisualEffectsSystem } from './core/VisualEffects';
import { EffectPresets, EffectCombinations } from './core/EffectPresets';
import './core/VisualEffectsTest'; // Import for manual testing
import { Vector2 } from './utils/Vector2';
import { Vector2 } from './utils/Vector2';
import { Vector2 } from './utils/Vector2';
import { Vector2 } from './utils/Vector2';
// --- Global Variables Setup ---
// Fixed Timestep for physics
const FIXED_TIME_STEP = 1000 / 60; // 60 frames per second
let accumulator = 0;

// Global input manager reference (will be set after async import)
let globalInputManager: any = null;

// PIXI App Setup - Using modern PIXI v8 API
export let app: PIXI.Application;

// Initialize PIXI app asynchronously
const initPixiApp = async () => {
    app = new PIXI.Application();
    await app.init({
        width: GameConfig.GAME_WIDTH,
        height: GameConfig.GAME_HEIGHT,
        backgroundColor: 0x000000,
        antialias: false,
    });
    document.getElementById('game-container')!.appendChild(app.canvas);
};
// PIXI.settings is deprecated in v8, scale mode is now set per texture

// Global PIXI Containers (exposed on window for other modules)
export const gameContentContainer = new PIXI.Container(); // Main container for all game content
export const titleScreenContainer = new PIXI.Container();
export const highScoreDisplayContainer = new PIXI.Container();
export const demoPlayContainer = new PIXI.Container(); // For demo mode elements
export const playerContainer = new PIXI.Container();
export const playerProjectilesContainer = new PIXI.Container();
export const enemyProjectilesContainer = new PIXI.Container();
export const enemiesContainer = new PIXI.Container();
export const humansContainer = new PIXI.Container();
export const obstaclesContainer = new PIXI.Container();
export const effectsContainer = new PIXI.Container();

// Containers will be added to stage after app is initialized

// Debug function to check container states and monitor changes
function debugContainers() {
    console.log('=== Container Debug Info ===');
    console.log('Stage children:', app.stage.children.length);
    
    app.stage.children.forEach((container, index) => {
        console.log(`Container ${index}:`, {
            name: container.name || container.constructor.name,
            children: container.children.length,
            visible: container.visible,
            alpha: container.alpha,
            x: container.x,
            y: container.y
        });
        
        if (container === humansContainer) {
            console.log('  ^ This is the humans container');
            container.children.forEach((child, childIndex) => {
                console.log(`    Child ${childIndex}:`, {
                    type: child.constructor.name,
                    x: child.x,
                    y: child.y,
                    visible: child.visible,
                    alpha: child.alpha,
                    width: child.width,
                    height: child.height
                });
            });
        }
        
        // Also check enemies container for human sprites
        if (container === enemiesContainer) {
            console.log('  ^ This is the enemies container');
            let humanSpritesInEnemies = 0;
            container.children.forEach((child, childIndex) => {
                // Check if this might be a human sprite (Graphics object with specific size)
                if (child.constructor.name === 'r' && child.width === 32 && child.height === 32) {
                    humanSpritesInEnemies++;
                    if (childIndex < 5) { // Only log first few to avoid spam
                        console.log(`    Possible human sprite ${childIndex}:`, {
                            type: child.constructor.name,
                            x: child.x,
                            y: child.y,
                            width: child.width,
                            height: child.height
                        });
                    }
                }
            });
            if (humanSpritesInEnemies > 0) {
                console.warn(`    Found ${humanSpritesInEnemies} possible human sprites in enemies container!`);
            }
        }
    });
    console.log('=== End Container Debug ===');
}

// Make debug function available globally
// window.debugContainers = debugContainers; // No longer global

console.log('PIXI containers initialized and added to stage');

// Add debugging to track when sprites are moved between containers
const originalRemoveChild = humansContainer.removeChild;
humansContainer.removeChild = function(child) {
    console.log('[DEBUG] Removing child from humans container:', {
        type: child.constructor.name,
        x: child.x,
        y: child.y,
        stack: new Error().stack.split('\n').slice(1, 4).join('\n') // Show more stack trace
    });
    const result = originalRemoveChild.call(this, child);
    
    // Check where the child goes after removal
    setTimeout(() => {
        console.log('[DEBUG] Child after removal:', {
            hasParent: !!child.parent,
            parentType: child.parent ? child.parent.constructor.name : 'none',
            destroyed: (child as any)._destroyed || false
        });
    }, 0);
    
    return result;
};

// Debug functions will be set up after app is initialized

const originalAddChild = enemiesContainer.addChild;
enemiesContainer.addChild = function(child) {
    // Check if this looks like a human sprite
    if (child.constructor.name === 'r' && (child as any).width === 16 && (child as any).height === 16) {
        console.warn('[DEBUG] Adding possible human sprite to enemies container:', {
            type: child.constructor.name,
            x: child.x,
            y: child.y,
            width: (child as any).width,
            height: (child as any).height,
            stack: new Error().stack.split('\n').slice(1, 4).join('\n')
        });
    }
    return originalAddChild.call(this, child);
};

// Load Global Assets (exposed on window)
// Ensure these paths are correct and assets are available.
// Load Global Assets with unique cache IDs to avoid conflicts
export let playerTexture: PIXI.Texture | null = null;
export let gruntTexture: PIXI.Texture | null = null;
export let humanTexture: PIXI.Texture | null = null;

const loadTextures = async () => {
    try {
        console.log('Starting texture loading...');
        
        // Modern PIXI Assets API for texture loading
        const loadTexture = async (url: string, id: string): Promise<PIXI.Texture> => {
            try {
                const texture = await PIXI.Assets.load(url);
                texture.source.scaleMode = 'nearest'; // Modern way to set scale mode
                console.log(`Texture loaded successfully: ${url}`, {
                    width: texture.width,
                    height: texture.height
                });
                return texture;
            } catch (error) {
                console.error(`Texture load error for ${url}:`, error);
                throw new Error(`Failed to load texture: ${url}`);
            }
        };

        // Load all textures with unique IDs
        try {
            playerTexture = await loadTexture('sprites/player.png', 'playerTexture');
            console.log('Player texture loaded');
        } catch (error) {
            console.warn('Failed to load player texture, will use fallback');
        }

        try {
            gruntTexture = await loadTexture('sprites/grunt.png', 'gruntTexture');
            console.log('Grunt texture loaded');
        } catch (error) {
            console.warn('Failed to load grunt texture, will use fallback');
        }

        try {
            humanTexture = await loadTexture('sprites/humans.png', 'humanTexture');
            console.log('Human texture loaded:', {
                width: humanTexture.width,
                height: humanTexture.height
            });
        } catch (error) {
            console.warn('Failed to load human texture, will use fallback');
            humanTexture = null; // Let humans.js create fallback
        }

        console.log('Texture loading completed');
        return true;
        
    } catch (error) {
        console.error('Failed to load textures:', error);
        return false;
    }
};

// Load textures before proceeding with game initialization
const initializeGame = async () => {
    try {
        // Initialize PIXI app first
        console.log('Initializing PIXI application...');
        await initPixiApp();
        
        // Add containers to stage after app is initialized (order matters for z-indexing)
        // First add the main game content container that can be shaken independently
        app.stage.addChild(gameContentContainer);
        
        // Add game containers to the game content container (these will shake with screen shake)
        gameContentContainer.addChild(obstaclesContainer);
        gameContentContainer.addChild(humansContainer);
        gameContentContainer.addChild(enemiesContainer);
        gameContentContainer.addChild(playerProjectilesContainer);
        gameContentContainer.addChild(enemyProjectilesContainer);
        gameContentContainer.addChild(playerContainer);
        gameContentContainer.addChild(effectsContainer);
        
        // Add UI containers directly to stage (these won't shake)
        app.stage.addChild(titleScreenContainer);
        app.stage.addChild(highScoreDisplayContainer);
        app.stage.addChild(demoPlayContainer);
        
        // Initialize the new game module
        console.log('Initializing foundational systems...');
        const moduleInitialized = RobotronGame.init();
        if (!moduleInitialized) {
            console.error('Failed to initialize RobotronGame module');
            return;
        }

        // Initialize save/load system
        console.log('Initializing save/load system...');
        // The save/load manager is already initialized as a singleton
        // Load settings on startup
        const settings = saveLoadManager.loadSettings();
        console.log('Loaded game settings:', settings);
        
        // Apply loaded settings to the game
        if (settings.soundEnabled !== undefined) {
            // Apply sound settings when sound system is available
            gameEvents.emit({
                type: 'settings:sound_enabled',
                timestamp: Date.now(),
                source: 'main',
                data: { enabled: settings.soundEnabled }
            });
        }

        const success = await loadTextures();
        if (!success) {
            console.error('Failed to initialize game due to texture loading failure');
            return;
        }
        
        // Run integration tests to verify everything works
        const testsPass = testFoundationalSystems();
        if (!testsPass) {
            console.warn('Some foundational system tests failed, but continuing...');
        }
        
        // Run Milestone 1 tests
        console.log('Running Milestone 1 comprehensive tests...');
        const milestone1Pass = runMilestone1Tests();
        if (milestone1Pass) {
            console.log('🎉 Milestone 1: All foundational systems are working correctly!');
        } else {
            console.warn('⚠️ Milestone 1: Some tests failed, but game will continue...');
        }
        
        // Test game loading after a short delay
        setTimeout(() => {
            const gameLoadingPass = testGameLoading();
            if (gameLoadingPass) {
                console.log('✅ Game loading verification passed');
            }
        }, 1000);
        
        // Set up collision system debugging
        setupCollisionDebugging();
        
        // Initialize game systems after async setup is complete
        loadHighScore();
        
        // Initialize new unified input manager
        const { inputManager, InputAction } = await import('./core/InputManager');
        console.log('Input manager imported:', inputManager);
        inputManager.initialize();
        inputManager.loadKeyBindings();
        
        // Set global reference for use in systems
        globalInputManager = { inputManager, InputAction };
        console.log('Global input manager set:', globalInputManager);
        
        // Test input manager functionality
        console.log('Testing input manager methods:');
        console.log('- getMovementVector:', inputManager.getMovementVector());
        console.log('- isActionPressed(MOVE_UP):', inputManager.isActionPressed(InputAction.MOVE_UP));
        
        // Test if keyboard events are being received at all
        console.log('Press any key to test keyboard input...');
        
        // Set up fallback game start logic using the input manager events
        gameEvents.on('input:start', (event) => {
            if (event.data.pressed && 
                (gameState.currentGameState === 'TITLE_SCREEN' || 
                 gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN' || 
                 gameState.currentGameState === 'DEMO_PLAY')) {
                console.log('Fallback game start triggered via input manager');
                startGameFromTitle();
            }
        });
        
        // Set up save/load keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // F5 - Quick Save
            if (event.key === 'F5' && !event.repeat) {
                event.preventDefault();
                saveLoadManager.quickSave();
            }
            // F9 - Quick Load
            else if (event.key === 'F9' && !event.repeat) {
                event.preventDefault();
                saveLoadManager.quickLoad();
            }
            // F10 - Show Save/Load UI
            else if (event.key === 'F10' && !event.repeat) {
                event.preventDefault();
                gameEvents.emit({
                    type: 'ui:show_save_load',
                    timestamp: Date.now(),
                    source: 'main',
                    data: {}
                });
            }
        });
        
        // Test the input system (optional - can be removed in production)
        if (process.env.NODE_ENV === 'development') {
            const { testUnifiedInputManager } = await import('./core/InputManager.test');
            testUnifiedInputManager();
        }
        
        // Test the input system (optional - can be removed in production)
        if (process.env.NODE_ENV === 'development') {
            const { testUnifiedInputManager } = await import('./core/InputManager.test');
            testUnifiedInputManager();
        }
        
        UI.resizeGame();
        resetGameVariables();
        Attract.showTitleScreen();
        
        // Initialize the RenderSystem
        const renderSystem = RenderSystem.getInstance(app);
        renderSystem.initialize();
        
        // Initialize RenderIntegration
        RenderIntegration.initialize(renderSystem);
        
        // Initialize Visual Effects System
        console.log('Initializing visual effects system...');
        const visualEffects = VisualEffectsSystem.initialize(effectsContainer, gameContentContainer);
        
        // Make visual effects available globally for debugging
        (window as any).visualEffects = visualEffects;
        (window as any).effectsDebug = {
            getStats: () => visualEffects.getStats(),
            createExplosion: (x: number, y: number, type: 'enemy' | 'player' | 'projectile' = 'enemy') => {
                visualEffects.createExplosion(new Vector2(x, y), type);
            },
            startScreenShake: (intensity: number = 5, duration: number = 0.3) => {
                visualEffects.startScreenShake({ intensity, duration });
            },
            clearEffects: () => visualEffects.clearAllEffects(),
            
            // Test different effects
            testExplosions: () => {
                const centerX = GameConfig.GAME_WIDTH / 2;
                const centerY = GameConfig.GAME_HEIGHT / 2;
                visualEffects.createExplosion(new Vector2(centerX - 100, centerY), 'enemy');
                setTimeout(() => visualEffects.createExplosion(new Vector2(centerX, centerY), 'player'), 500);
                setTimeout(() => visualEffects.createExplosion(new Vector2(centerX + 100, centerY), 'projectile'), 1000);
            }
        };
        
        console.log('🎆 Visual effects system initialized. Use window.effectsDebug for testing.');
        console.log('   - effectsDebug.testExplosions() - Test different explosion types');
        console.log('   - effectsDebug.createExplosion(x, y, type) - Create explosion at position');
        console.log('   - effectsDebug.startScreenShake(intensity, duration) - Test screen shake');
        
        // Add scaling debug function
        (window as any).scalingDebug = {
            checkContainers: () => {
                console.log('=== Scaling Debug Info ===');
                console.log('App stage scale:', app.stage.scale.x, app.stage.scale.y);
                console.log('Game content container scale:', gameContentContainer.scale.x, gameContentContainer.scale.y);
                console.log('Game content container position:', gameContentContainer.x, gameContentContainer.y);
                console.log('Canvas size:', app.canvas.width, app.canvas.height);
                console.log('Renderer size:', app.renderer.width, app.renderer.height);
                console.log('Window size:', window.innerWidth, window.innerHeight);
                console.log('Game config size:', GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT);
            },
            forceResize: () => {
                console.log('Forcing resize...');
                UI.resizeGame();
            }
        };
        
        console.log('🔧 Scaling debug available: window.scalingDebug.checkContainers()');
        
        // Set up the new GameEngine
        setupGameEngine();
        
        // Ensure proper initial scaling
        UI.resizeGame();
        
        console.log('Game initialization completed successfully');
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
};

// --- Collision System Debugging Setup ---
function setupCollisionDebugging() {
    // Make collision debugging functions available globally for console access
    (window as any).collisionDebug = {
        enableTesting: () => IntegrationUtils.enableTesting(),
        enableHybrid: () => IntegrationUtils.enableHybrid(),
        enableFull: () => IntegrationUtils.enableFull(),
        getStats: () => collisionIntegration.getStats(),
        getDebugData: () => collisionIntegration.getDebugData(),
        
        // Quick test functions
        testSpatialGrid: () => {
            console.log('🔍 Spatial Grid Stats:', collisionIntegration.getStats().collisionSystem.spatialGridStats);
        },
        
        logPerformance: () => {
            const stats = collisionIntegration.getStats();
            console.log('📊 Collision Performance:', {
                integration: stats.integration.performance,
                spatialGrid: stats.collisionSystem.spatialGridStats
            });
        }
    };
    
    console.log('🔧 Collision debugging setup complete. Use window.collisionDebug for testing.');
    console.log('   - collisionDebug.enableTesting() - Enable new system for testing');
    console.log('   - collisionDebug.enableHybrid() - Run both systems');
    console.log('   - collisionDebug.getStats() - Get performance stats');
    
    // Make render system debugging available globally
    (window as any).renderDebug = {
        getMetrics: () => RenderSystem.getInstance().getMetrics(),
        getDebugInfo: () => RenderSystem.getInstance().getDebugInfo(),
        getConfiguration: () => RenderSystem.getInstance().getConfiguration(),
        
        // Configuration controls
        enableBatching: (enable: boolean) => RenderSystem.getInstance().updateConfiguration({ enableBatching: enable }),
        enableCulling: (enable: boolean) => RenderSystem.getInstance().updateConfiguration({ enableCulling: enable }),
        enableLayering: (enable: boolean) => RenderSystem.getInstance().updateConfiguration({ enableLayering: enable }),
        
        // Performance testing
        logPerformance: () => {
            const metrics = RenderSystem.getInstance().getMetrics();
            console.log('🎨 RenderSystem Performance:', {
                totalObjects: metrics.totalObjects,
                visibleObjects: metrics.visibleObjects,
                culledObjects: metrics.culledObjects,
                drawCalls: metrics.drawCalls,
                batchedSprites: metrics.batchedSprites,
                renderTime: metrics.renderTime.toFixed(2) + 'ms'
            });
        }
    };
    
    console.log('🎨 Render debugging setup complete. Use window.renderDebug for testing.');
    console.log('   - renderDebug.getMetrics() - Get rendering performance metrics');
    console.log('   - renderDebug.logPerformance() - Log detailed render performance');
    console.log('   - renderDebug.enableBatching(true/false) - Toggle sprite batching');
}

// --- GameEngine Setup ---
function setupGameEngine() {
    // Create game systems for different parts of the game
    const inputSystem = EngineUtils.createSystem(
        'InputSystem',
        (deltaTime: number) => {
            // The new unified input manager handles gamepad polling automatically
            // No manual polling needed
        },
        undefined,
        100 // High priority
    );
    
    const attractModeSystem = EngineUtils.createSystem(
        'AttractModeSystem',
        (deltaTime: number) => {
            try {
                if (gameState.currentGameState === 'TITLE_SCREEN' || 
                    gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN' || 
                    gameState.currentGameState === 'DEMO_PLAY') {
                    
                    // Update attract mode safely
                    try {
                        Attract.updateAttractMode(deltaTime / (1000 / 60)); // Convert to PIXI delta format
                    } catch (attractError) {
                        console.error('Attract mode update error:', attractError);
                        // Don't let attract mode errors break the system
                    }
                    
                    // Check for start game input using the global input manager reference
                    if (globalInputManager && globalInputManager.inputManager) {
                        const { inputManager, InputAction } = globalInputManager;
                        
                        try {
                            const startPressed = inputManager.isActionPressed(InputAction.START);
                            const selectPressed = inputManager.isActionPressed(InputAction.SELECT);
                            
                            // Debug logging to see if attract mode is checking for input
                            console.log('Attract mode checking input:', { startPressed, selectPressed, gameState: gameState.currentGameState });
                            
                            if (startPressed || selectPressed) {
                                console.log('Input detected in attract mode:', { startPressed, selectPressed });
                                startGameFromTitle();
                            }
                        } catch (inputError) {
                            console.warn('Input manager error in attract mode:', inputError);
                        }
                    } else {
                        // Debug logging to see if globalInputManager is available
                        if (!globalInputManager) {
                            console.warn('globalInputManager is null in attractModeSystem');
                        }
                    }
                }
            } catch (error) {
                console.error('AttractModeSystem error:', error);
            }
        },
        undefined,
        90
    );
    
    const gameplaySystem = EngineUtils.createSystem(
        'GameplaySystem',
        (deltaTime: number) => {
            if (gameState.currentGameState === 'PLAYING') {
                if (!player) {
                    console.error("Game in PLAYING state but no player object!");
                    gameState.currentGameState = 'TITLE_SCREEN';
                    Attract.showTitleScreen();
                    return;
                }
                
                // Update player invulnerability
                if (gameState.playerInvulnerableTime > 0) {
                    gameState.playerInvulnerableTime -= deltaTime;
                    if (gameState.playerInvulnerableTime < 0) gameState.playerInvulnerableTime = 0;
                }
                
                // Update game entities
                const normalizedDelta = deltaTime / (1000 / 60); // Convert to expected delta format
                
                // Player input processing (debug logging removed to avoid console spam)
                player.handleKeyboardInput();
                // Gamepad input is now handled automatically by the unified input manager
                player.update(normalizedDelta);
                
                Projectiles.updatePlayerProjectiles(normalizedDelta);
                Projectiles.updateEnemyProjectiles(normalizedDelta);
                Enemies.updateEnemies(normalizedDelta);
                Humans.updateHumansAndProgs(normalizedDelta);
                Obstacles.updateObstacles(normalizedDelta);
                updateBonusDecay(normalizedDelta);
                Effects.updateEffects(normalizedDelta);
                
                // Collision detection
                checkCollisions();
                
                // Register objects with new collision system for testing
                collisionIntegration.registerGameObjects(
                    playerProjectiles,
                    enemyProjectiles,
                    enemies,
                    humansAndProgs,
                    obstacles,
                    player
                );
                
                // Run new collision system (currently in testing mode)
                collisionIntegration.checkCollisions();
                
                checkForExtraLife();
                checkWaveCompletion();
            }
        },
        undefined,
        80
    );
    
    const uiSystem = EngineUtils.createSystem(
        'UISystem',
        (deltaTime: number) => {
            // UI updates can happen every frame
            if (gameState.currentGameState === 'PLAYING') {
                UI.updateUI();
            }
        },
        undefined,
        10 // Lower priority
    );
    
    const visualEffectsSystem = EngineUtils.createSystem(
        'VisualEffectsSystem',
        (deltaTime: number) => {
            // Update visual effects system
            try {
                const visualEffects = VisualEffectsSystem.getInstance();
                visualEffects.update(deltaTime / 1000); // Convert to seconds
            } catch (error) {
                // Visual effects system might not be initialized yet
                // This is okay during startup
            }
        },
        undefined,
        15 // Medium priority - after gameplay but before render
    );
    
    const renderSystem = EngineUtils.createSystem(
        'RenderSystem',
        (deltaTime: number) => {
            // Update render system (culling, batching, etc.)
            const renderSys = RenderSystem.getInstance();
            renderSys.render();
        },
        (interpolation: number) => {
            // Render with interpolation for smooth visuals
            const renderSys = RenderSystem.getInstance();
            renderSys.render(interpolation);
        },
        5 // Lowest priority - render last
    );
    
    // Add systems to the game engine
    gameEngine.addSystem(inputSystem);
    gameEngine.addSystem(attractModeSystem);
    gameEngine.addSystem(gameplaySystem);
    gameEngine.addSystem(uiSystem);
    gameEngine.addSystem(visualEffectsSystem);
    gameEngine.addSystem(renderSystem);
    
    // Set up performance monitoring
    gameEngine.setPerformanceCallback((metrics) => {
        // Make performance metrics available globally for debugging
        (window as any).gamePerformance = metrics;
        
        // Log performance warnings if needed
        if (metrics.fps < 30) {
            console.warn('Low FPS detected:', metrics.fps.toFixed(1));
        }
    });
    
    // Start the game engine
    gameEngine.start();
    
    // Make game engine available globally for debugging
    (window as any).gameEngine = gameEngine;
    (window as any).engineDebug = {
        getMetrics: () => gameEngine.getMetrics(),
        getState: () => gameEngine.getState(),
        pause: () => gameEngine.pause(),
        resume: () => gameEngine.resume(),
        stop: () => gameEngine.stop(),
        start: () => gameEngine.start(),
        
        // System management
        enableSystem: (name: string) => gameEngine.setSystemEnabled(name, true),
        disableSystem: (name: string) => gameEngine.setSystemEnabled(name, false),
        getSystem: (name: string) => gameEngine.getSystem(name),
        
        // Performance testing
        logPerformance: () => {
            const metrics = gameEngine.getMetrics();
            console.log('🎮 GameEngine Performance:', {
                fps: metrics.fps.toFixed(1),
                averageFps: metrics.averageFps.toFixed(1),
                frameTime: metrics.frameTime.toFixed(2) + 'ms',
                updateTime: metrics.updateTime.toFixed(2) + 'ms',
                renderTime: metrics.renderTime.toFixed(2) + 'ms',
                totalFrames: metrics.totalFrames,
                droppedFrames: metrics.droppedFrames
            });
        }
    };
    
    console.log('🚀 GameEngine setup complete. Use window.engineDebug for testing.');
    console.log('   - engineDebug.getMetrics() - Get performance metrics');
    console.log('   - engineDebug.logPerformance() - Log detailed performance');
    console.log('   - engineDebug.pause() / engineDebug.resume() - Control game loop');
    
    // Run Milestone 2 tests after GameEngine is running
    setTimeout(() => {
        console.log('Running Milestone 2 comprehensive tests...');
        const milestone2Pass = runMilestone2Tests();
        if (milestone2Pass) {
            console.log('🎉 Milestone 2: Core systems integration is working correctly!');
        } else {
            console.warn('⚠️ Milestone 2: Some integration tests failed, but game will continue...');
        }
        
        // Run Milestone 3 tests after Milestone 2
        setTimeout(async () => {
            console.log('Running Milestone 3 comprehensive tests...');
            const milestone3Pass = await runMilestone3Tests(app);
            if (milestone3Pass) {
                console.log('🎉 Milestone 3: Entity refactoring is working correctly!');
            } else {
                console.warn('⚠️ Milestone 3: Some entity tests failed, but game will continue...');
            }
        }, 2000); // Wait 2 more seconds after Milestone 2
    }, 3000); // Wait 3 seconds for systems to stabilize
}

initializeGame();

// --- Player Object ---
export let player: Player | null = null; // Will hold the player object instance
export let demoPlayer: Player | null = null; // Will hold the demo player instance

// Setter functions for external modules to modify these variables
export function setPlayer(newPlayer: Player | null): void {
    player = newPlayer;
}

export function setDemoPlayer(newDemoPlayer: Player | null): void {
    demoPlayer = newDemoPlayer;
}

// --- Entity Arrays ---
export let playerProjectiles: any[] = [];
export let enemyProjectiles: any[] = [];
export let enemies: any[] = [];
export let humansAndProgs: any[] = []; // Combined array for humans and progs converted from humans
export let obstacles: any[] = [];
// Effects are children of effectsContainer, not usually in a separate array

// --- Initialization Calls ---
// Set up GameConfig with all required values
// GameConfig is now imported

// Initialize all entity arrays (already done with export let)

// These will be called after async initialization
// Moved to initializeGame() function


// --- Global Event Listeners ---
window.addEventListener('resize', () => {
    UI.resizeGame();
});

// Legacy keydown listener removed - now handled by unified input manager in attractModeSystem

// Audio Initialization on first user interaction
let audioInitialized = false;
function initializeAudioOnce() {
    if (!audioInitialized) {
        initAudio();
        audioInitialized = true;
        // Remove these specific listeners after first use if desired, or let them be.
        document.removeEventListener('click', initializeAudioOnce);
        document.removeEventListener('keydown', initializeAudioOnceKey);
    }
}
function initializeAudioOnceKey(event: KeyboardEvent) { // Separate keydown for audio init to avoid conflict
    if (!audioInitialized && !(event.code === 'Enter' || event.code === 'Space')) { // Don't init on start keys
         initializeAudioOnce();
    }
}
document.addEventListener('click', initializeAudioOnce);
document.addEventListener('keydown', initializeAudioOnceKey);


// --- Game Start Logic ---
function startGameFromTitle() {
    console.log('startGameFromTitle called, current state:', gameState.currentGameState);
    
    if (gameState.currentGameState !== 'TITLE_SCREEN' && gameState.currentGameState !== 'HIGH_SCORE_DISPLAY_SCREEN' && gameState.currentGameState !== 'DEMO_PLAY') return;

    SoundManager.play('insertCoin');

    gameState.currentGameState = 'PLAYING';
    console.log('Game state changed to PLAYING');
    resetGameVariables();
    player = createPlayer();

    if (!player) {
        console.error("Failed to create player! Aborting game start.");
        gameState.currentGameState = 'TITLE_SCREEN';
        Attract.showTitleScreen();
        return;
    }

    gameState.playerInvulnerableTime = GameConfig.RESPAWN_INVULNERABILITY_TIME;

    startNextWave();

    UI.updateUI();
    UI.hideTitleScreen();
    UI.hideHighScoreDisplayScreen();
    const demoContainer = demoPlayContainer;
    if(demoContainer) demoContainer.visible = false;

    const messageBox = document.getElementById('message-box');
    if(messageBox) messageBox.style.display = 'none';
}

// --- Legacy Game Loop (Replaced by GameEngine) ---
// The old game loop has been replaced by the new GameEngine system.
// All game logic is now handled by the GameEngine's system-based architecture.

