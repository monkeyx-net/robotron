(function() {
    // PIXI objects to be defined within setup functions and then potentially exposed
    let titleText, williamsText, insertCoinText, pressStartText, highScoreTextElement;
    let highScoreScreenTitleText, highScoreValueText, attractOverlayText1, attractOverlayText2, attractOverlayText3;

    // UI Elements (HTML) - define these at the top of the IIFE
    const scoreTextEl = document.getElementById('score');
    const livesTextEl = document.getElementById('lives');
    const bonusTextEl = document.getElementById('bonus');
    const uiContainerEl = document.getElementById('ui-container');
    const messageBoxEl = document.getElementById('message-box');
    const messageTitleEl = document.getElementById('message-title');
    const messageTextEl = document.getElementById('message-text');
    const playAgainButtonEl = document.getElementById('play-again-button');

    function updateScoreDisplay() {
        if (scoreTextEl && typeof window.score !== 'undefined') {
            scoreTextEl.textContent = `SCORE: ${window.score}`;
        }
    }

    function updateBonusDisplay() {
        if (bonusTextEl && typeof window.currentHumanRescueBonus !== 'undefined') {
            bonusTextEl.textContent = `BONUS: ${window.currentHumanRescueBonus}`;
        }
    }

    function updateUI() {
        if (typeof window.gameState === 'undefined') return;

        if (window.gameState === 'PLAYING') {
            if (uiContainerEl) uiContainerEl.style.visibility = 'visible';
            updateScoreDisplay();
            if (livesTextEl && typeof window.lives !== 'undefined') livesTextEl.textContent = `LIVES: ${window.lives}`;
            updateBonusDisplay();
        } else {
            if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';
        }
    }

    function setupTitleScreen() {
        const titleScreenContainer = window.titleScreenContainer;
        if (!titleScreenContainer || !window.PIXI || !window.GameConfig || typeof window.highScore === 'undefined') {
            console.warn("UI.setupTitleScreen: Missing dependencies (titleScreenContainer, PIXI, GameConfig, or highScore). Title screen may not render correctly.");
            return;
        }

        titleScreenContainer.removeChildren();
        const titleStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 28, fill: 0xFFFF00, align: 'center', dropShadow: true, dropShadowColor: 0xFF0000, dropShadowDistance: 2 });
        titleText = new window.PIXI.Text('ROBOTRON\n2084', titleStyle);
        titleText.anchor.set(0.5); titleText.x = window.GameConfig.GAME_WIDTH / 2; titleText.y = window.GameConfig.GAME_HEIGHT / 3;
        titleScreenContainer.addChild(titleText);

        const williamsStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xFFFFFF });
        williamsText = new window.PIXI.Text('(Williams Electronics, Inc.)', williamsStyle);
        williamsText.anchor.set(0.5); williamsText.x = window.GameConfig.GAME_WIDTH / 2; williamsText.y = titleText.y + titleText.height / 2 + 20;
        titleScreenContainer.addChild(williamsText);

        const insertCoinStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 12, fill: 0xFFFFFF, align: 'center' });
        insertCoinText = new window.PIXI.Text('INSERT COIN', insertCoinStyle);
        insertCoinText.anchor.set(0.5); insertCoinText.x = window.GameConfig.GAME_WIDTH / 2; insertCoinText.y = window.GameConfig.GAME_HEIGHT * 0.8;
        titleScreenContainer.addChild(insertCoinText);

        const pressStartStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0x00FF00, align: 'center' });
        pressStartText = new window.PIXI.Text('PRESS ENTER TO START', pressStartStyle);
        pressStartText.anchor.set(0.5); pressStartText.x = window.GameConfig.GAME_WIDTH / 2; pressStartText.y = insertCoinText.y + 25;
        titleScreenContainer.addChild(pressStartText);

        const highScoreStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0x00FFFF, align: 'center' });
        highScoreTextElement = new window.PIXI.Text(`HIGH SCORE: ${window.highScore}`, highScoreStyle);
        highScoreTextElement.anchor.set(0.5);
        highScoreTextElement.x = window.GameConfig.GAME_WIDTH / 2;
        highScoreTextElement.y = williamsText.y + williamsText.height + 20;
        titleScreenContainer.addChild(highScoreTextElement);

        titleScreenContainer.visible = true;
        if (window.highScoreDisplayContainer) window.highScoreDisplayContainer.visible = false;
        if (window.demoPlayContainer) window.demoPlayContainer.visible = false;

        if(!window.UI) window.UI = {}; // Ensure UI object exists
        window.UI.titleText = titleText;
        window.UI.insertCoinText = insertCoinText;
        window.UI.pressStartText = pressStartText;
        window.UI.highScoreTextElement = highScoreTextElement;
    }

    function setupHighScoreDisplayScreen() {
        const highScoreDisplayContainer = window.highScoreDisplayContainer;
        if (!highScoreDisplayContainer || !window.PIXI || !window.GameConfig || typeof window.highScore === 'undefined') {
            console.warn("UI.setupHighScoreDisplayScreen: Missing dependencies. High score screen may not render correctly.");
            return;
        }

        highScoreDisplayContainer.removeChildren();
        const hsTitleStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 20, fill: 0x00FFFF, align: 'center' });
        highScoreScreenTitleText = new window.PIXI.Text('HIGH SCORE', hsTitleStyle);
        highScoreScreenTitleText.anchor.set(0.5); highScoreScreenTitleText.x = window.GameConfig.GAME_WIDTH / 2; highScoreScreenTitleText.y = window.GameConfig.GAME_HEIGHT / 4;
        highScoreDisplayContainer.addChild(highScoreScreenTitleText);

        const hsValueStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 24, fill: 0xFFFF00, align: 'center' });
        highScoreValueText = new window.PIXI.Text(String(window.highScore), hsValueStyle);
        highScoreValueText.anchor.set(0.5); highScoreValueText.x = window.GameConfig.GAME_WIDTH / 2; highScoreValueText.y = highScoreScreenTitleText.y + 40;
        highScoreDisplayContainer.addChild(highScoreValueText);

        const overlayStyle = new window.PIXI.TextStyle({ fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xFF0000, align: 'center', wordWrap: true, wordWrapWidth: window.GameConfig.GAME_WIDTH - 40 });
        attractOverlayText1 = new window.PIXI.Text('SAVE THE LAST HUMAN FAMILY', overlayStyle);
        attractOverlayText1.anchor.set(0.5); attractOverlayText1.x = window.GameConfig.GAME_WIDTH / 2; attractOverlayText1.y = highScoreValueText.y + 40;
        highScoreDisplayContainer.addChild(attractOverlayText1);

        attractOverlayText2 = new window.PIXI.Text('DESTROY THE ROBOTS', overlayStyle);
        attractOverlayText2.anchor.set(0.5); attractOverlayText2.x = window.GameConfig.GAME_WIDTH / 2; attractOverlayText2.y = attractOverlayText1.y + 20;
        highScoreDisplayContainer.addChild(attractOverlayText2);

        attractOverlayText3 = new window.PIXI.Text('2084', {...overlayStyle, fontSize: 18, fill: 0xFF0000});
        attractOverlayText3.anchor.set(0.5); attractOverlayText3.x = window.GameConfig.GAME_WIDTH / 2; attractOverlayText3.y = attractOverlayText2.y + 30;
        highScoreDisplayContainer.addChild(attractOverlayText3);

        highScoreDisplayContainer.visible = true;
        if (window.titleScreenContainer) window.titleScreenContainer.visible = false;
        if (window.demoPlayContainer) window.demoPlayContainer.visible = false;
    }

    function hideHighScoreDisplayScreen() {
        if (window.highScoreDisplayContainer) window.highScoreDisplayContainer.visible = false;
    }

    function hideTitleScreen() {
        if (window.titleScreenContainer) window.titleScreenContainer.visible = false;
    }

    function showGameOverScreen() {
        if (typeof window.gameState === 'undefined' || typeof window.score === 'undefined' || typeof window.highScore === 'undefined') {
             console.warn("UI.showGameOverScreen: Missing global state (gameState, score, or highScore). Game over screen may not display correctly.");
        }
        window.gameState = 'GAME_OVER'; // Set gameState

        if (window.titleScreenContainer) window.titleScreenContainer.visible = false;
        if (window.highScoreDisplayContainer) window.highScoreDisplayContainer.visible = false;
        if (window.demoPlayContainer) window.demoPlayContainer.visible = false;
        if (uiContainerEl) uiContainerEl.style.visibility = 'hidden';

        if (window.score > window.highScore) {
            window.highScore = window.score;
            if (window.GameLogic && window.GameLogic.saveHighScore) {
                window.GameLogic.saveHighScore();
            }
        }

        if (messageBoxEl) messageBoxEl.style.display = 'block';
        if (messageTitleEl) messageTitleEl.textContent = 'GAME OVER';
        if (messageTextEl) messageTextEl.textContent = `FINAL SCORE: ${window.score}\nHIGH SCORE: ${window.highScore}`;
        if (playAgainButtonEl) {
            playAgainButtonEl.textContent = 'PLAY AGAIN?';
            playAgainButtonEl.onclick = () => {
                if (window.Attract && window.Attract.showTitleScreen) {
                    window.Attract.showTitleScreen();
                } else {
                    console.warn("UI.showGameOverScreen: window.Attract.showTitleScreen not found for Play Again button.");
                }
            };
        }
        resizeGame();
    }

    function resizeGame() {
        if (!window.GameConfig || !window.app || !window.app.renderer || !window.app.stage) {
            // console.warn("UI.resizeGame: Missing dependencies (GameConfig or app). Game may not resize correctly.");
            // Do not resize if essential components are missing, especially during initial load.
            return;
        }

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const gameWrapper = document.getElementById('game-wrapper');

        const baseUiHeight = uiContainerEl ? uiContainerEl.offsetHeight : 30;

        const scaleX = screenWidth / window.GameConfig.GAME_WIDTH;
        const availableHeightForCanvas = Math.max(1, screenHeight - baseUiHeight - 20);
        const scaleY = availableHeightForCanvas / window.GameConfig.GAME_HEIGHT;

        let scale = Math.min(scaleX, scaleY);
        scale = Math.max(0.5, scale);

        const newCanvasWidth = window.GameConfig.GAME_WIDTH * scale;
        const newCanvasHeight = window.GameConfig.GAME_HEIGHT * scale;

        window.app.renderer.resize(newCanvasWidth, newCanvasHeight);
        window.app.stage.scale.set(scale);

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.width = newCanvasWidth + 'px';
            gameContainer.style.height = newCanvasHeight + 'px';
        }

        if (uiContainerEl) {
            uiContainerEl.style.width = newCanvasWidth + 'px';
            let uiFontSize = 10;
            if (scale < 1.2) uiFontSize = 8;
            else if (scale < 2) uiFontSize = 10;
            else if (scale < 3) uiFontSize = 12;
            else uiFontSize = 14;
            uiContainerEl.style.fontSize = uiFontSize + 'px';
        }

        if (messageBoxEl) {
            let newMsgFontSize;
            if (scale < 1.2) newMsgFontSize = 10;
            else if (scale < 1.8) newMsgFontSize = 12;
            else if (scale < 2.5) newMsgFontSize = 14;
            else if (scale < 3.5) newMsgFontSize = 16;
            else newMsgFontSize = 18;

            messageBoxEl.style.fontSize = newMsgFontSize + 'px';
            if (messageTitleEl) messageTitleEl.style.fontSize = Math.floor(newMsgFontSize * 1.2) + 'px';

            if (playAgainButtonEl) {
                playAgainButtonEl.style.fontSize = Math.floor(newMsgFontSize * 0.8) + 'px';
                const paddingAmount = Math.floor(Math.max(4, 10 * Math.min(1, scale * 0.6)));
                const marginAmount = Math.floor(Math.max(6, 15 * Math.min(1, scale * 0.6)));
                playAgainButtonEl.style.padding = `${paddingAmount}px ${marginAmount}px`;
                playAgainButtonEl.style.marginTop = `${Math.floor(Math.max(5, 10 * Math.min(1, scale*0.6)))}px`;
            }
        }
        if (gameWrapper) {
            gameWrapper.style.position = 'absolute';
            gameWrapper.style.left = '50%';
            gameWrapper.style.top = '50%';
            gameWrapper.style.transform = 'translate(-50%, -50%)';
        }
    }

    if(!window.UI) window.UI = {}; // Ensure UI object exists before assigning to it

    window.UI.setupTitleScreen = setupTitleScreen;
    window.UI.setupHighScoreDisplayScreen = setupHighScoreDisplayScreen;
    window.UI.hideHighScoreDisplayScreen = hideHighScoreDisplayScreen;
    window.UI.hideTitleScreen = hideTitleScreen;
    window.UI.showGameOverScreen = showGameOverScreen;
    window.UI.updateUI = updateUI;
    window.UI.resizeGame = resizeGame;
    window.UI.updateScoreDisplay = updateScoreDisplay;
    window.UI.updateBonusDisplay = updateBonusDisplay;
    // PIXI text elements are exposed within setupTitleScreen after creation
})();
