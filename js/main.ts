import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { RobotronGame } from './core/GameModule';
import { testFoundationalSystems } from './core/test-integration';
import { runMilestone1Tests, testGameLoading } from './core/milestone-test';
import { Attract } from './attractMode';
import { loadHighScore, resetGameVariables, startNextWave, checkCollisions, checkForExtraLife, checkWaveCompletion, updateBonusDecay } from './gameLogic';
import { collisionIntegration, IntegrationUtils } from './core/CollisionIntegration';
import { gameEngine, GameSystem, EngineUtils } from './core/GameEngine';
import { createPlayer, Player } from './player';
import { Projectiles } from './projectiles';
import { Enemies } from './enemies';
import { Humans } from './humans';
import { Obstacles } from './obstacles';
import { Effects } from './effects';
import { SoundManager, initAudio } from './soundManager';
import { UI } from './ui';
import { InputManager } from './inputManager';
import { gameState } from './gameState';
// --- Global Variables Setup ---
// Fixed Timestep for physics
const FIXED_TIME_STEP = 1000 / 60; // 60 frames per second
let accumulator = 0;

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
        app.stage.addChild(titleScreenContainer);
        app.stage.addChild(highScoreDisplayContainer);
        app.stage.addChild(demoPlayContainer);
        app.stage.addChild(obstaclesContainer);
        app.stage.addChild(humansContainer);
        app.stage.addChild(enemiesContainer);
        app.stage.addChild(playerProjectilesContainer);
        app.stage.addChild(enemyProjectilesContainer);
        app.stage.addChild(playerContainer);
        app.stage.addChild(effectsContainer);
        
        // Initialize the new game module
        console.log('Initializing foundational systems...');
        const moduleInitialized = RobotronGame.init();
        if (!moduleInitialized) {
            console.error('Failed to initialize RobotronGame module');
            return;
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
        InputManager.init();
        UI.resizeGame();
        resetGameVariables();
        Attract.showTitleScreen();
        
        // Set up the new GameEngine
        setupGameEngine();
        
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
}

// --- GameEngine Setup ---
function setupGameEngine() {
    // Create game systems for different parts of the game
    const inputSystem = EngineUtils.createSystem(
        'InputSystem',
        (deltaTime: number) => {
            InputManager.pollGamepads();
        },
        undefined,
        100 // High priority
    );
    
    const attractModeSystem = EngineUtils.createSystem(
        'AttractModeSystem',
        (deltaTime: number) => {
            if (gameState.currentGameState === 'TITLE_SCREEN' || 
                gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN' || 
                gameState.currentGameState === 'DEMO_PLAY') {
                
                Attract.updateAttractMode(deltaTime / (1000 / 60)); // Convert to PIXI delta format
                
                // Check for start game input
                if (InputManager.isKeyDown('Enter') || InputManager.isKeyDown('Space') || 
                    (InputManager.isGamepadConnected() && 
                     (navigator.getGamepads()[0]?.buttons[GameConfig.GAMEPAD_START_BUTTON_INDEX]?.pressed || 
                      navigator.getGamepads()[0]?.buttons[GameConfig.GAMEPAD_A_BUTTON_INDEX]?.pressed))) {
                    startGameFromTitle();
                }
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
                
                player.handleKeyboardInput();
                if(InputManager.isGamepadConnected()) player.handleGamepadInput();
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
    
    // Add systems to the game engine
    gameEngine.addSystem(inputSystem);
    gameEngine.addSystem(attractModeSystem);
    gameEngine.addSystem(gameplaySystem);
    gameEngine.addSystem(uiSystem);
    
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

window.addEventListener('keydown', (e) => {
    // Start game from Title/HS/Demo on Enter/Space
    if ((gameState.currentGameState === 'TITLE_SCREEN' || gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN' || gameState.currentGameState === 'DEMO_PLAY') &&
        (e.code === 'Enter' || e.code === 'Space')) {
        startGameFromTitle();
    }
});

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
    if (gameState.currentGameState !== 'TITLE_SCREEN' && gameState.currentGameState !== 'HIGH_SCORE_DISPLAY_SCREEN' && gameState.currentGameState !== 'DEMO_PLAY') return;

    SoundManager.play('insertCoin');

    gameState.currentGameState = 'PLAYING';
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

