(function(PIXI, Howler) {
    if (!PIXI || !Howler) {
        console.error("Fatal Error: PIXI or Howler not found. Game cannot start.");
        // Display an error message to the user on the page itself
        document.body.innerHTML = '<div style="color: white; text-align: center; padding-top: 50px; font-family: monospace;">' +
                                  '<h1>Fatal Error</h1>' +
                                  '<p>PIXI.js or Howler.js failed to load.</p>' +
                                  '<p>Please ensure you have an internet connection and these libraries are accessible.</p>' +
                                  '</div>';
        return;
    }

    // --- Global Variables Setup ---
    window.gameState = 'TITLE_SCREEN'; // Initial game state

    // PIXI App Setup
    window.app = new PIXI.Application({
        width: (window.GameConfig && window.GameConfig.GAME_WIDTH) ? window.GameConfig.GAME_WIDTH : 292, // Use GameConfig, provide fallback
        height: (window.GameConfig && window.GameConfig.GAME_HEIGHT) ? window.GameConfig.GAME_HEIGHT : 240,
        backgroundColor: 0x000000,
        antialias: false,
    });
    document.getElementById('game-container').appendChild(window.app.view);
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

    // Global PIXI Containers (exposed on window for other modules)
    window.titleScreenContainer = new PIXI.Container();
    window.highScoreDisplayContainer = new PIXI.Container();
    window.demoPlayContainer = new PIXI.Container(); // For demo mode elements
    window.playerContainer = new PIXI.Container();
    window.playerProjectilesContainer = new PIXI.Container();
    window.enemyProjectilesContainer = new PIXI.Container();
    window.enemiesContainer = new PIXI.Container();
    window.humansContainer = new PIXI.Container();
    window.obstaclesContainer = new PIXI.Container();
    window.effectsContainer = new PIXI.Container();

    // Add containers to stage (order matters for z-indexing)
    window.app.stage.addChild(window.titleScreenContainer);
    window.app.stage.addChild(window.highScoreDisplayContainer);
    window.app.stage.addChild(window.demoPlayContainer); // Add demo container
    window.app.stage.addChild(window.humansContainer);
    window.app.stage.addChild(window.obstaclesContainer);
    window.app.stage.addChild(window.enemiesContainer);
    window.app.stage.addChild(window.playerProjectilesContainer);
    window.app.stage.addChild(window.enemyProjectilesContainer);
    window.app.stage.addChild(window.playerContainer); // Player on top of most things
    window.app.stage.addChild(window.effectsContainer); // Effects usually on very top

    // Load Global Assets (exposed on window)
    // Ensure these paths are correct and assets are available.
    window.playerTexture = PIXI.Texture.from('sprites/player.png');
    window.gruntTexture = PIXI.Texture.from('sprites/grunt.png');
    window.humanTexture = PIXI.Texture.from('sprites/humans.png');
    // Add error handling for texture loading if possible, or assume they load.
    // For example, listening to texture.baseTexture.once('loaded', ...) or .once('error', ...)

    // Input State
    window.keys = {}; // For keyboard input

    // Gamepad State (to be updated by polling)
    window.gamepadMovementX = 0;
    window.gamepadMovementY = 0;
    window.gamepadShootingX = 0;
    window.gamepadShootingY = 0;
    let lastGamepadTimestamp = 0;
    let gamepadConnected = false;


    // --- Player Object ---
    window.player = null; // Will hold the player object instance
    window.demoPlayer = null; // Will hold the demo player instance

    // --- Entity Arrays ---
    window.playerProjectiles = [];
    window.enemyProjectiles = [];
    window.enemies = [];
    window.humansAndProgs = []; // Combined array for humans and progs converted from humans
    window.obstacles = [];
    // Effects are children of effectsContainer, not usually in a separate array

    // --- Initialization Calls ---
    if (window.GameLogic && window.GameLogic.loadHighScore) {
        window.GameLogic.loadHighScore(); // Load high score early
    } else { console.warn("main.js: GameLogic.loadHighScore not found."); }

    // Initial UI setup (e.g. resize, attract mode will set up title screen)
    if (window.UI && window.UI.resizeGame) {
         window.UI.resizeGame(); // Initial resize
    } else { console.warn("main.js: UI.resizeGame not found."); }

    if (window.Attract && window.Attract.showTitleScreen) {
        window.Attract.showTitleScreen(); // Start with the title screen
    } else { console.warn("main.js: Attract.showTitleScreen not found. Game will not start correctly."); }


    // --- Global Event Listeners ---
    window.addEventListener('resize', () => {
        if (window.UI && window.UI.resizeGame) window.UI.resizeGame();
    });

    window.addEventListener('keydown', (e) => {
        window.keys[e.code] = true;
        // Start game from Title/HS/Demo on Enter/Space
        if ((window.gameState === 'TITLE_SCREEN' || window.gameState === 'HIGH_SCORE_DISPLAY_SCREEN' || window.gameState === 'DEMO_PLAY') &&
            (e.code === 'Enter' || e.code === 'Space')) {
            startGameFromTitle();
        }
    });
    window.addEventListener('keyup', (e) => {
        window.keys[e.code] = false;
    });

    // Audio Initialization on first user interaction
    let audioInitialized = false;
    function initializeAudioOnce() {
        if (!audioInitialized) {
            if (window.initAudio) { // initAudio is on window from soundManager.js
                window.initAudio();
                audioInitialized = true;
            } else { console.warn("main.js: window.initAudio not found for audio initialization.");}
            // Remove these specific listeners after first use if desired, or let them be.
            document.removeEventListener('click', initializeAudioOnce);
            document.removeEventListener('keydown', initializeAudioOnceKey);
        }
    }
    function initializeAudioOnceKey(event) { // Separate keydown for audio init to avoid conflict
        if (!audioInitialized && !(event.code === 'Enter' || event.code === 'Space')) { // Don't init on start keys
             initializeAudioOnce();
        }
    }
    document.addEventListener('click', initializeAudioOnce);
    document.addEventListener('keydown', initializeAudioOnceKey);


    // --- Gamepad Handling ---
    function pollGamepads() {
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        if (!gps) return;

        let foundGamepad = false;
        for (const gamepad of gps) {
            if (gamepad) {
                foundGamepad = true;
                if (!gamepadConnected) { // New connection
                    console.log("Gamepad connected:", gamepad.id);
                    gamepadConnected = true;
                }

                if (gamepad.timestamp === lastGamepadTimestamp) continue; // No new data
                lastGamepadTimestamp = gamepad.timestamp;

                // Update global gamepad state variables
                const deadzone = (window.GameConfig && window.GameConfig.GAMEPAD_DEADZONE) ? window.GameConfig.GAMEPAD_DEADZONE : 0.2;
                window.gamepadMovementX = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
                window.gamepadMovementY = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;
                window.gamepadShootingX = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
                window.gamepadShootingY = Math.abs(gamepad.axes[3]) > deadzone ? gamepad.axes[3] : 0;

                // Gamepad start button
                const startButtonIndex = (window.GameConfig && typeof window.GameConfig.GAMEPAD_START_BUTTON_INDEX !== 'undefined') ? window.GameConfig.GAMEPAD_START_BUTTON_INDEX : 9;
                const aButtonIndex = (window.GameConfig && typeof window.GameConfig.GAMEPAD_A_BUTTON_INDEX !== 'undefined') ? window.GameConfig.GAMEPAD_A_BUTTON_INDEX : 0;

                const startButtonPressed = gamepad.buttons[startButtonIndex]?.pressed;
                const aButtonPressed = gamepad.buttons[aButtonIndex]?.pressed;

                if ((window.gameState === 'TITLE_SCREEN' || window.gameState === 'HIGH_SCORE_DISPLAY_SCREEN' || window.gameState === 'DEMO_PLAY') &&
                    (startButtonPressed || aButtonPressed)) {
                    startGameFromTitle();
                }
                break; // Process first connected gamepad
            }
        }
        if (!foundGamepad && gamepadConnected) {
            console.log("Gamepad disconnected.");
            gamepadConnected = false;
            // Reset gamepad state vars
            window.gamepadMovementX = 0; window.gamepadMovementY = 0;
            window.gamepadShootingX = 0; window.gamepadShootingY = 0;
        }
    }


    // --- Game Start Logic ---
    function startGameFromTitle() {
        if (window.gameState !== 'TITLE_SCREEN' && window.gameState !== 'HIGH_SCORE_DISPLAY_SCREEN' && window.gameState !== 'DEMO_PLAY') return;

        if (!window.GameLogic || !window.Player || !window.SoundManager || !window.UI || !window.GameConfig) {
            console.error("startGameFromTitle: Critical modules missing!"); return;
        }

        window.SoundManager.play('insertCoin');

        window.gameState = 'PLAYING';
        window.GameLogic.resetGameVariables();
        window.player = window.Player.createPlayer();

        if (!window.player) {
            console.error("Failed to create player! Aborting game start.");
            window.gameState = 'TITLE_SCREEN';
            if(window.Attract && window.Attract.showTitleScreen) window.Attract.showTitleScreen();
            return;
        }

        window.playerInvulnerableTime = window.GameConfig.RESPAWN_INVULNERABILITY_TIME || 2000;

        window.GameLogic.startNextWave();

        if(window.UI.updateUI) window.UI.updateUI();
        if(window.UI.hideTitleScreen) window.UI.hideTitleScreen();
        if(window.UI.hideHighScoreDisplayScreen) window.UI.hideHighScoreDisplayScreen();
        const demoContainer = window.demoPlayContainer;
        if(demoContainer) demoContainer.visible = false;

        const messageBox = document.getElementById('message-box');
        if(messageBox) messageBox.style.display = 'none';
    }

    // --- Main Game Loop ---
    function gameLoop() {
        // PIXI ticker provides delta directly via app.ticker.deltaTime (for v5+)
        // or app.ticker.deltaMS / (1000/60) for a factor based on 60FPS if using MS.
        // For simplicity, using app.ticker.deltaTime which is a factor (e.g., 1 for 60FPS).
        const delta = window.app.ticker.deltaTime;

        pollGamepads();

        if (window.gameState === 'TITLE_SCREEN' || window.gameState === 'HIGH_SCORE_DISPLAY_SCREEN' || window.gameState === 'DEMO_PLAY') {
            if (window.Attract && window.Attract.updateAttractMode) {
                window.Attract.updateAttractMode(delta);
            }
        } else if (window.gameState === 'PLAYING') {
            if (!window.player) {
                console.error("Game in PLAYING state but no player object!");
                window.gameState = 'TITLE_SCREEN';
                if(window.Attract && window.Attract.showTitleScreen) window.Attract.showTitleScreen();
                return;
            }

            if (window.playerInvulnerableTime > 0) {
                window.playerInvulnerableTime -= window.app.ticker.elapsedMS;
                if (window.playerInvulnerableTime < 0) window.playerInvulnerableTime = 0;
            }

            if (window.Player) {
                if(window.Player.handlePlayerKeyboardInput) window.Player.handlePlayerKeyboardInput(window.player);
                if(gamepadConnected && window.Player.handlePlayerGamepadInput) window.Player.handlePlayerGamepadInput(window.player);
                if(window.Player.updatePlayer) window.Player.updatePlayer(window.player, delta);
            }

            if (window.Projectiles) {
                if (window.Projectiles.updatePlayerProjectiles) window.Projectiles.updatePlayerProjectiles(delta);
                if (window.Projectiles.updateEnemyProjectiles) window.Projectiles.updateEnemyProjectiles(delta);
            }
            if (window.Enemies && window.Enemies.updateEnemies) window.Enemies.updateEnemies(delta);
            if (window.Humans && window.Humans.updateHumansAndProgs) window.Humans.updateHumansAndProgs(delta);
            if (window.Obstacles && window.Obstacles.updateObstacles) window.Obstacles.updateObstacles(delta);
            if (window.GameLogic && window.GameLogic.updateBonusDecay) window.GameLogic.updateBonusDecay(delta);
            if (window.Effects && window.Effects.updateEffects) window.Effects.updateEffects(delta);

            if (window.GameLogic) {
                if (window.GameLogic.checkCollisions) window.GameLogic.checkCollisions();
                if (window.GameLogic.checkForExtraLife) window.GameLogic.checkForExtraLife(); // Moved here
                if (window.GameLogic.checkWaveCompletion) window.GameLogic.checkWaveCompletion();
            }

            if (window.UI && window.UI.updateUI) window.UI.updateUI();

        } else if (window.gameState === 'WAVE_TRANSITION') {
            // Handled by GameLogic.checkWaveCompletion's setTimeout
        } else if (window.gameState === 'GAME_OVER') {
            // Handled by UI.showGameOverScreen
        }
    }

    window.app.ticker.add(gameLoop);

})(window.PIXI, window.Howler);
