import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { RobotronGame } from './core/GameModule';
import { testFoundationalSystems } from './core/test-integration';
import { Attract } from './attractMode';
import { loadHighScore, resetGameVariables, startNextWave, checkCollisions, checkForExtraLife, checkWaveCompletion, updateBonusDecay } from './gameLogic';
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
        
        // Start the game loop
        app.ticker.add(gameLoop);
        
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
        
        // Initialize game systems after async setup is complete
        loadHighScore();
        InputManager.init();
        UI.resizeGame();
        resetGameVariables();
        Attract.showTitleScreen();
        
        console.log('Game initialization completed successfully');
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
};

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

// --- Main Game Loop ---
function gameLoop(delta: number) {
    // delta is PIXI's deltaTime, which is 1 by default for 60 FPS.
    const elapsedMS = app.ticker.elapsedMS;
    accumulator += elapsedMS;

    InputManager.pollGamepads(); // Poll gamepads via InputManager

    if (gameState.currentGameState === 'TITLE_SCREEN' || gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN' || gameState.currentGameState === 'DEMO_PLAY') {
        Attract.updateAttractMode(delta);
        // Check for start game input from InputManager
        if (InputManager.isKeyDown('Enter') || InputManager.isKeyDown('Space') || 
            (InputManager.isGamepadConnected() && 
             (navigator.getGamepads()[0]?.buttons[GameConfig.GAMEPAD_START_BUTTON_INDEX]?.pressed || 
              navigator.getGamepads()[0]?.buttons[GameConfig.GAMEPAD_A_BUTTON_INDEX]?.pressed))) {
            startGameFromTitle();
        }
    } else if (gameState.currentGameState === 'PLAYING') {
        if (!player) {
            console.error("Game in PLAYING state but no player object!");
            gameState.currentGameState = 'TITLE_SCREEN';
            Attract.showTitleScreen();
            return;
        }

        // Fixed timestep updates for physics and game logic
        while (accumulator >= FIXED_TIME_STEP) {
            if (gameState.playerInvulnerableTime > 0) {
                gameState.playerInvulnerableTime -= FIXED_TIME_STEP;
                if (gameState.playerInvulnerableTime < 0) gameState.playerInvulnerableTime = 0;
            }

            player.handleKeyboardInput();
            if(InputManager.isGamepadConnected()) player.handleGamepadInput();
            player.update(FIXED_TIME_STEP / (1000 / 60)); // Pass a consistent delta for updates

            Projectiles.updatePlayerProjectiles(FIXED_TIME_STEP / (1000 / 60));
            Projectiles.updateEnemyProjectiles(FIXED_TIME_STEP / (1000 / 60));
            Enemies.updateEnemies(FIXED_TIME_STEP / (1000 / 60));
            Humans.updateHumansAndProgs(FIXED_TIME_STEP / (1000 / 60));
            Obstacles.updateObstacles(FIXED_TIME_STEP / (1000 / 60));
            updateBonusDecay(FIXED_TIME_STEP / (1000 / 60));
            Effects.updateEffects(FIXED_TIME_STEP / (1000 / 60));

            checkCollisions();
            checkForExtraLife();
            checkWaveCompletion();

            accumulator -= FIXED_TIME_STEP;
        }

        // Render updates (can be frame-rate dependent)
        UI.updateUI();

    } else if (gameState.currentGameState === 'WAVE_TRANSITION') {
        // Handled by GameLogic.checkWaveCompletion's setTimeout
    } else if (gameState.currentGameState === 'GAME_OVER') {
        // Handled by UI.showGameOverScreen
    }
}

