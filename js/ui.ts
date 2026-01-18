import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { titleScreenContainer, highScoreDisplayContainer, demoPlayContainer, app } from './main';
import { gameState } from './gameState';
import { saveHighScore } from './gameLogic';
import { Attract } from './attractMode';
import { gameEvents } from './core/EventSystem';

// PIXI objects to be defined within setup functions and then potentially exposed
let titleText: PIXI.Text;
let williamsText: PIXI.Text;
export let insertCoinText: PIXI.Text;
export let pressStartText: PIXI.Text;
let highScoreTextElement: PIXI.Text;
let highScoreScreenTitleText: PIXI.Text;
let highScoreValueText: PIXI.Text;
let attractOverlayText1: PIXI.Text;
let attractOverlayText2: PIXI.Text;
let attractOverlayText3: PIXI.Text;

// UI Elements (HTML) - define these at the top of the module
const scoreTextEl = document.getElementById('score');
const livesTextEl = document.getElementById('lives');
const bonusTextEl = document.getElementById('bonus');
const uiContainerEl = document.getElementById('ui-container');
const messageBoxEl = document.getElementById('message-box');
const messageTitleEl = document.getElementById('message-title');
const messageTextEl = document.getElementById('message-text');
const playAgainButtonEl = document.getElementById('play-again-button');

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
    if (scoreTextEl && typeof gameState !== 'undefined') {
        scoreTextEl.textContent = `SCORE: ${gameState.score}`;
    }
}

export function updateBonusDisplay() {
    if (bonusTextEl && typeof gameState !== 'undefined') {
        bonusTextEl.textContent = `BONUS: ${gameState.currentHumanRescueBonus}`;
    }
}

export function updateUI() {
    if (typeof gameState === 'undefined') return;

    if (gameState.currentGameState === 'PLAYING') {
        if (uiContainerEl) uiContainerEl.style.visibility = 'visible';
        updateScoreDisplay();
        if (livesTextEl) livesTextEl.textContent = `LIVES: ${gameState.lives}`;
        updateBonusDisplay();
    } else {
        if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';
    }
}

export function setupTitleScreen() {
    if (!titleScreenContainer || !PIXI || !GameConfig || typeof gameState === 'undefined') {
        console.warn("UI.setupTitleScreen: Missing dependencies (titleScreenContainer, PIXI, GameConfig, or gameState). Title screen may not render correctly.");
        return;
    }

    titleScreenContainer.removeChildren();
    const titleStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 28, fill: 0xFFFF00, align: 'center', dropShadow: true, dropShadowColor: 0xFF0000, dropShadowDistance: 2 });
    titleText = new PIXI.Text('ROBOTRON\n2084', titleStyle);
    titleText.anchor.set(0.5); titleText.x = GameConfig.GAME_WIDTH / 2; titleText.y = GameConfig.GAME_HEIGHT / 3;
    titleScreenContainer.addChild(titleText);

    const williamsStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xFFFFFF });
    williamsText = new PIXI.Text('(Williams Electronics, Inc.)', williamsStyle);
    williamsText.anchor.set(0.5); williamsText.x = GameConfig.GAME_WIDTH / 2; williamsText.y = titleText.y + titleText.height / 2 + 20;
    titleScreenContainer.addChild(williamsText);

    const insertCoinStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 12, fill: 0xFFFFFF, align: 'center' });
    insertCoinText = new PIXI.Text('INSERT COIN', insertCoinStyle);
    insertCoinText.anchor.set(0.5); insertCoinText.x = GameConfig.GAME_WIDTH / 2; insertCoinText.y = GameConfig.GAME_HEIGHT * 0.8;
    titleScreenContainer.addChild(insertCoinText);

    const pressStartStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0x00FF00, align: 'center' });
    pressStartText = new PIXI.Text('PRESS ENTER TO START', pressStartStyle);
    pressStartText.anchor.set(0.5); pressStartText.x = GameConfig.GAME_WIDTH / 2; pressStartText.y = insertCoinText.y + 25;
    titleScreenContainer.addChild(pressStartText);

    const highScoreStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0x00FFFF, align: 'center' });
    highScoreTextElement = new PIXI.Text(`HIGH SCORE: ${gameState.highScore}`, highScoreStyle);
    highScoreTextElement.anchor.set(0.5);
    highScoreTextElement.x = GameConfig.GAME_WIDTH / 2;
    highScoreTextElement.y = williamsText.y + williamsText.height + 20;
    titleScreenContainer.addChild(highScoreTextElement);

    titleScreenContainer.visible = true;
    if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
    if (demoPlayContainer) demoPlayContainer.visible = false;
}

export function setupHighScoreDisplayScreen() {
    if (!highScoreDisplayContainer || !PIXI || !GameConfig || typeof gameState === 'undefined') {
        console.warn("UI.setupHighScoreDisplayScreen: Missing dependencies. High score screen may not render correctly.");
        return;
    }

    highScoreDisplayContainer.removeChildren();
    const hsTitleStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 20, fill: 0x00FFFF, align: 'center' });
    highScoreScreenTitleText = new PIXI.Text('HIGH SCORE', hsTitleStyle);
    highScoreScreenTitleText.anchor.set(0.5); highScoreScreenTitleText.x = GameConfig.GAME_WIDTH / 2; highScoreScreenTitleText.y = GameConfig.GAME_HEIGHT / 4;
    highScoreDisplayContainer.addChild(highScoreScreenTitleText);

    const hsValueStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 24, fill: 0xFFFF00, align: 'center' });
    highScoreValueText = new PIXI.Text(String(gameState.highScore), hsValueStyle);
    highScoreValueText.anchor.set(0.5); highScoreValueText.x = GameConfig.GAME_WIDTH / 2; highScoreValueText.y = highScoreScreenTitleText.y + 40;
    highScoreDisplayContainer.addChild(highScoreValueText);

    const overlayStyle = new PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xFF0000, align: 'center', wordWrap: true, wordWrapWidth: GameConfig.GAME_WIDTH - 40 });
    attractOverlayText1 = new PIXI.Text('SAVE THE LAST HUMAN FAMILY', overlayStyle);
    attractOverlayText1.anchor.set(0.5); attractOverlayText1.x = GameConfig.GAME_WIDTH / 2; attractOverlayText1.y = highScoreValueText.y + 40;
    highScoreDisplayContainer.addChild(attractOverlayText1);

    attractOverlayText2 = new PIXI.Text('DESTROY THE ROBOTS', overlayStyle);
    attractOverlayText2.anchor.set(0.5); attractOverlayText2.x = GameConfig.GAME_WIDTH / 2; attractOverlayText2.y = attractOverlayText1.y + 20;
    highScoreDisplayContainer.addChild(attractOverlayText2);

    attractOverlayText3 = new PIXI.Text('2084', {...overlayStyle, fontSize: 18, fill: 0xFF0000});
    attractOverlayText3.anchor.set(0.5); attractOverlayText3.x = GameConfig.GAME_WIDTH / 2; attractOverlayText3.y = attractOverlayText2.y + 30;
    highScoreDisplayContainer.addChild(attractOverlayText3);

    highScoreDisplayContainer.visible = true;
    if (titleScreenContainer) titleScreenContainer.visible = false;
    if (demoPlayContainer) demoPlayContainer.visible = false;
}

export function hideHighScoreDisplayScreen() {
    if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
}

export function hideTitleScreen() {
    if (titleScreenContainer) titleScreenContainer.visible = false;
}

export function showGameOverScreen() {
    if (typeof gameState === 'undefined') {
         console.warn("UI.showGameOverScreen: Missing global state (gameState). Game over screen may not display correctly.");
         return;
    }
    gameState.currentGameState = 'GAME_OVER';

    if (titleScreenContainer) titleScreenContainer.visible = false;
    if (highScoreDisplayContainer) highScoreDisplayContainer.visible = false;
    if (demoPlayContainer) demoPlayContainer.visible = false;
    if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';

    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        saveHighScore();
    }

    if (messageBoxEl) messageBoxEl.style.display = 'block';
    if (messageTitleEl) messageTitleEl.textContent = 'GAME OVER';
    if (messageTextEl) messageTextEl.textContent = `FINAL SCORE: ${gameState.score}\nHIGH SCORE: ${gameState.highScore}`;
    if (playAgainButtonEl) {
        playAgainButtonEl.textContent = 'PLAY AGAIN?';
        playAgainButtonEl.onclick = () => {
            if (Attract && Attract.showTitleScreen) {
                Attract.showTitleScreen();
            } else {
                console.warn("UI.showGameOverScreen: Attract.showTitleScreen not found for Play Again button.");
            }
        };
    }
    resizeGame();
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

    // Update message box font size
    if (messageBoxEl) {
        let msgFontSize = Math.max(10, Math.min(20, Math.floor(12 * (scale / 2))));
        messageBoxEl.style.fontSize = msgFontSize + 'px';

        if (messageTitleEl) {
            messageTitleEl.style.fontSize = Math.floor(msgFontSize * 1.2) + 'px';
        }

        if (playAgainButtonEl) {
            playAgainButtonEl.style.fontSize = Math.floor(msgFontSize * 0.8) + 'px';
            const paddingAmount = Math.max(8, Math.floor(10 * (scale / 2)));
            const marginAmount = Math.max(10, Math.floor(15 * (scale / 2)));
            playAgainButtonEl.style.padding = `${paddingAmount}px ${marginAmount}px`;
            playAgainButtonEl.style.marginTop = `${Math.max(10, Math.floor(10 * (scale / 2)))}px`;
        }
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
