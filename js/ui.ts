import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { titleScreenContainer, highScoreDisplayContainer, demoPlayContainer, app, gameContentContainer, player } from './main';
import { DeathBeat } from './core/DeathBeat';
import { gameState } from './gameState';
import { saveHighScore, clearEntities } from './gameLogic';
import { ArcadeHud } from './core/ArcadeHud';
import { HighScoreEntry } from './core/HighScoreEntry';
import { BitmapFont } from './core/BitmapFont';
import { HeroesScreen } from './core/HeroesScreen';
import { ArcadeBorder } from './core/ArcadeBorder';
import { TwoPlayer } from './core/TwoPlayer';
import { Attract } from './attractMode';
import { gameEvents } from './core/EventSystem';

// PIXI objects to be defined within setup functions and then potentially exposed
let titleText: PIXI.Text | null = null;
export let insertCoinText: PIXI.Text;
export let pressStartText: PIXI.Text;
let highScoreTextElement: PIXI.Text | null = null;

// UI Elements (HTML) - define these at the top of the module
const bonusTextEl = document.getElementById('bonus');
const uiContainerEl = document.getElementById('ui-container');

// Save/Load message display
let saveLoadMessageTimeout: number | null = null;

// Setup save/load UI event listeners
gameEvents.on('ui:show_message', (event) => {
    const { message, type, duration } = event.data;
    showSaveLoadMessage(message, type, duration);
});

/**
 * Show a temporary message for save/load operations
 */
export function showSaveLoadMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 2000) {
    // Clear any existing timeout
    if (saveLoadMessageTimeout) {
        clearTimeout(saveLoadMessageTimeout);
    }
    
    // Create or get message element
    let messageElement = document.getElementById('save-load-message');
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'save-load-message';
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            padding: 10px 15px;
            border: 1px solid #00ff00;
            border-radius: 4px;
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            z-index: 2000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(messageElement);
    }
    
    // Set message and color based on type
    messageElement.textContent = message;
    switch (type) {
        case 'success':
            messageElement.style.color = '#00ff00';
            messageElement.style.borderColor = '#00ff00';
            break;
        case 'error':
            messageElement.style.color = '#ff4444';
            messageElement.style.borderColor = '#ff4444';
            break;
        case 'warning':
            messageElement.style.color = '#ffaa00';
            messageElement.style.borderColor = '#ffaa00';
            break;
        case 'info':
        default:
            messageElement.style.color = '#00aaff';
            messageElement.style.borderColor = '#00aaff';
            break;
    }
    
    // Show message
    messageElement.style.opacity = '1';
    
    // Hide message after duration
    saveLoadMessageTimeout = window.setTimeout(() => {
        if (messageElement) {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement && messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }
        saveLoadMessageTimeout = null;
    }, duration);
}

export function updateScoreDisplay() {
    if (typeof gameState !== 'undefined') {
        ArcadeHud.update(gameState.score, gameState.lives, gameState.wave);
    }
}

export function updateBonusDisplay() {
    if (bonusTextEl && typeof gameState !== 'undefined') {
        bonusTextEl.textContent = `BONUS: ${gameState.currentHumanRescueBonus}`;
    }
}

export function updateUI() {
    if (typeof gameState === 'undefined') return;

    const inGame = gameState.currentGameState === 'PLAYING' || gameState.currentGameState === 'DEMO_PLAY'
        || gameState.currentGameState === 'WAVE_TRANSITION';
    ArcadeHud.setVisible(inGame);
    if (uiContainerEl) uiContainerEl.style.visibility = 'hidden'; // DOM HUD retired (in-canvas HUD)
    if (inGame) updateScoreDisplay();
}

export function setupTitleScreen() {
    if (!titleScreenContainer || !PIXI || !GameConfig || typeof gameState === 'undefined') {
        console.warn("UI.setupTitleScreen: Missing dependencies (titleScreenContainer, PIXI, GameConfig, or gameState). Title screen may not render correctly.");
        return;
    }

    titleScreenContainer.removeChildren();
    // ROM alt-font title, like the arcade attract card
    const cx = GameConfig.GAME_WIDTH / 2;
    const addTitleLine = (text: string, y: number, tint: number, font: 'main' | 'alt' = 'main', scale = 1) => {
        const t = BitmapFont.createText(text, { font, tint });
        t.scale.set(scale);
        t.x = cx - (BitmapFont.measure(text, { font }) * scale) / 2;
        t.y = y;
        titleScreenContainer.addChild(t);
        return t;
    };
    addTitleLine('ROBOTRON: 2084', 56, 0xFFFF44, 'alt', 2);
    addTitleLine('(C) 1982 WILLIAMS ELECTRONICS INC.', 96, 0xFFFFFF);
    addTitleLine(`HIGH SCORE ${gameState.highScore}`, 116, 0x44FFFF);
    const insertCoinBmp = addTitleLine('INSERT COIN', 176, 0xFFFFFF, 'alt');
    insertCoinText = insertCoinBmp as any;
    const pressStartBmp = addTitleLine('PRESS ENTER TO START', 200, 0x44FF44);
    pressStartText = pressStartBmp as any;

    titleScreenContainer.visible = true;
    if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
    if (demoPlayContainer) demoPlayContainer.visible = false;
}

export function setupHighScoreDisplayScreen() {
    if (!highScoreDisplayContainer || !PIXI || !GameConfig || typeof gameState === 'undefined') {
        console.warn("UI.setupHighScoreDisplayScreen: Missing dependencies. High score screen may not render correctly.");
        return;
    }

    // The arcade heroes screen (ROBOTRON HEROES + ALL TIME HEROES), from MAME.
    HeroesScreen.show(highScoreDisplayContainer);
    ArcadeBorder.setVisible(false);
    highScoreDisplayContainer.visible = true;
    if (titleScreenContainer) titleScreenContainer.visible = false;
    if (demoPlayContainer) demoPlayContainer.visible = false;
}

export function hideHighScoreDisplayScreen() {
    if (highScoreDisplayContainer?.visible) ArcadeBorder.setVisible(true);
    HeroesScreen.stop();
    if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
}

export function hideTitleScreen() {
    if (titleScreenContainer) titleScreenContainer.visible = false;
}

// Arcade game over (MAME, robotron-re REVERSE.md Phase 21 "Game over"): the
// playfield freezes with everything still on it while the last man flashes
// and fades (core/DeathBeat.ts; 120 frames), then GAME OVER shows over it for 120 frames. Then a
// qualifying score goes to initials entry, and either way the heroes table
// follows for ~580 frames before the attract cycle carries on. There is no
// "play again" prompt: START begins a new game from any attract screen.
const GAME_OVER_DEATH_FRAMES = 120;
const GAME_OVER_TEXT_FRAMES = 120;
const GAME_OVER_HEROES_FRAMES = 580;
const GAME_OVER_TEXT_POS = { x: 118, y: 121 };   // MAME snapshot, colour $AEFF00
let gameOverTick: ((t: PIXI.Ticker) => void) | null = null;
let gameOverText: PIXI.Container | null = null;

function stopGameOverBeat(): void {
    if (gameOverTick) { PIXI.Ticker.shared.remove(gameOverTick); gameOverTick = null; }
    if (gameOverText) { gameOverText.destroy({ children: true }); gameOverText = null; }
}

export function showGameOverScreen() {
    if (typeof gameState === 'undefined') {
         console.warn("UI.showGameOverScreen: Missing global state (gameState). Game over screen may not display correctly.");
         return;
    }
    stopGameOverBeat();
    gameState.currentGameState = 'GAME_OVER';
    // the last man flashes and fades on the frozen field first (MAME: GAME OVER
    // appears 120 frames after the hit)
    const p = player as any;
    if (p && p.sprite && !p.sprite.destroyed) DeathBeat.play(p.sprite, () => {}, () => gameState.currentGameState === 'GAME_OVER');
    let frames = 0;
    gameOverTick = (t: PIXI.Ticker) => {
        // a new game started from somewhere else: drop the beat
        if (gameState.currentGameState !== 'GAME_OVER') { stopGameOverBeat(); return; }
        frames += t.deltaTime;
        if (!gameOverText && frames >= GAME_OVER_DEATH_FRAMES && gameContentContainer) {
            gameOverText = BitmapFont.createText('GAME OVER', { tint: 0xAEFF00 });
            gameOverText.x = GAME_OVER_TEXT_POS.x;
            gameOverText.y = GAME_OVER_TEXT_POS.y;
            gameContentContainer.addChild(gameOverText);
        }
        if (frames >= GAME_OVER_DEATH_FRAMES + GAME_OVER_TEXT_FRAMES) {
            stopGameOverBeat();
            afterGameOverText();
        }
    };
    PIXI.Ticker.shared.add(gameOverTick);
}

function afterGameOverText(): void {
    // Arcade flow: the playfield is wiped before the initials / heroes screens.
    clearEntities(true);

    // A qualifying score goes to 3-initial entry first.
    // In 2P mode, the best of both players' scores is entered.
    const bestScore = Math.max(gameState.score, ...TwoPlayer.allScores());
    gameState.score = bestScore;
    if (HighScoreEntry.qualifies(bestScore) && app?.stage) {
        if (titleScreenContainer) titleScreenContainer.visible = false;
        if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
        if (demoPlayContainer) demoPlayContainer.visible = false;
        if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';
        const finalScore = gameState.score;
        HighScoreEntry.show(app.stage, finalScore, () => {
            gameState.score = finalScore;
            showHeroesAfterGame();
        });
        return;
    }
    showHeroesAfterGame();
}

function showHeroesAfterGame(): void {
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        saveHighScore();
    }
    if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';
    Attract.showHighScoreDisplayScreen(GAME_OVER_HEROES_FRAMES);
}

export function resizeGame() {
    if (!GameConfig || !app || !app.renderer || !app.stage) {
        // Do not resize if essential components are missing, especially during initial load.
        return;
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const gameWrapper = document.getElementById('game-wrapper');
    const gameContainer = document.getElementById('game-container');

    // Reserve space for UI at the bottom
    const UI_HEIGHT = 40; // Space for score/lives display
    const PADDING = 20; // Padding around the game

    // Calculate available space for the game canvas
    const availableWidth = screenWidth - (PADDING * 2);
    const availableHeight = screenHeight - UI_HEIGHT - (PADDING * 2);

    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = availableWidth / GameConfig.GAME_WIDTH;
    const scaleY = availableHeight / GameConfig.GAME_HEIGHT;

    // Use the smaller scale to ensure the game fits in both dimensions
    let scale = Math.min(scaleX, scaleY);

    // Ensure minimum scale for visibility
    scale = Math.max(1.0, scale);

    // For crisp pixels, optionally use integer scaling (can be disabled for smoother scaling)
    // Uncomment the line below for strict integer scaling (2x, 3x, 4x, etc.)
    // scale = Math.floor(scale);

    // Calculate final canvas dimensions
    const canvasWidth = Math.round(GameConfig.GAME_WIDTH * scale);
    const canvasHeight = Math.round(GameConfig.GAME_HEIGHT * scale);

    // Resize the renderer and set the stage scale
    app.renderer.resize(canvasWidth, canvasHeight);
    app.stage.scale.set(scale);

    // Update container dimensions
    if (gameContainer) {
        gameContainer.style.width = canvasWidth + 'px';
        gameContainer.style.height = canvasHeight + 'px';
    }

    // Update UI container width to match canvas
    if (uiContainerEl) {
        uiContainerEl.style.width = canvasWidth + 'px';

        // Scale UI font size based on canvas scale
        let uiFontSize = Math.max(8, Math.min(16, Math.floor(10 * (scale / 2))));
        uiContainerEl.style.fontSize = uiFontSize + 'px';
    }

    // Center the game wrapper
    if (gameWrapper) {
        gameWrapper.style.position = 'absolute';
        gameWrapper.style.left = '50%';
        gameWrapper.style.top = '50%';
        gameWrapper.style.transform = 'translate(-50%, -50%)';
    }

    console.log(`Game scaled to ${canvasWidth}x${canvasHeight} (${scale.toFixed(2)}x scale)`);
}

export const UI = {
    setupTitleScreen,
    setupHighScoreDisplayScreen,
    hideHighScoreDisplayScreen,
    hideTitleScreen,
    showGameOverScreen,
    updateUI,
    resizeGame,
    updateScoreDisplay,
    updateBonusDisplay,
    // Remove direct references to uninitialized variables
    // These can be accessed through getter functions if needed
    get titleText() { return titleText; },
    get insertCoinText() { return insertCoinText; },
    get pressStartText() { return pressStartText; },
    get highScoreTextElement() { return highScoreTextElement; }
};
