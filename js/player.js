(function() {
    // Assumes window.PIXI, window.GameConfig, window.Projectiles,
    // window.playerContainer, window.playerTexture, window.keys (object for keyboard state)
    // window.gameState, window.player (the player object itself, managed by main.js/gameLogic.js)
    // window.playerInvulnerableTime (managed by gameLogic.js)
    // window.SoundManager (for sounds, though createPlayerProjectile handles it)
    // window.gamepadMovementX, window.gamepadMovementY, window.gamepadShootingX, window.gamepadShootingY (from main.js gamepad polling)

    function createPlayer() {
        if (!window.PIXI || !window.playerTexture || !window.playerContainer || !window.GameConfig) {
            console.warn("Player.createPlayer: Missing dependencies.");
            return null;
        }
        // If a player sprite already exists in the container from a previous game, remove it.
        // This assumes playerContainer might hold an old sprite. A better cleanup is in clearEntities.
        // For now, this is a defensive measure if createPlayer is called mid-session without full clear.
        if (window.player && window.player.sprite && !window.player.sprite._destroyed) {
            window.player.sprite.destroy();
        }

        const playerSprite = new window.PIXI.Sprite(window.playerTexture);
        playerSprite.anchor.set(0.5);
        playerSprite.x = window.GameConfig.GAME_WIDTH / 2;
        playerSprite.y = window.GameConfig.GAME_HEIGHT / 2;
        window.playerContainer.addChild(playerSprite);

        const newPlayer = {
            sprite: playerSprite,
            dx: 0,
            dy: 0,
            // shootCooldown: 0, // Original, replaced by lastShootTime
            lastShootTime: 0,
            // shootDelay: 8, // Original, effectively PLAYER_SHOOT_RATE now
            isAlive: true,
            // shieldEffect: null, // Will be created in updatePlayer if needed
            // isDemoPlayer: false, // Property for demo player, not for regular player
            // aiMoveTimer: 0,    // Properties for demo player
            // aiShootTimer: 0   // Properties for demo player
        };
        return newPlayer; // Return the player object
    }

    // Handles keyboard input for player movement and shooting
    function handlePlayerKeyboardInput(playerInstance) {
        if (!playerInstance || !playerInstance.isAlive || !window.keys || !window.GameConfig || !window.Projectiles) {
            return;
        }
        if (window.gameState !== 'PLAYING') return;


        playerInstance.dx = 0;
        playerInstance.dy = 0;
        if (window.keys['KeyW']) playerInstance.dy = -1;
        if (window.keys['KeyS']) playerInstance.dy = 1;
        if (window.keys['KeyA']) playerInstance.dx = -1;
        if (window.keys['KeyD']) playerInstance.dx = 1;

        if (playerInstance.dx !== 0 && playerInstance.dy !== 0) {
            const length = Math.sqrt(playerInstance.dx * playerInstance.dx + playerInstance.dy * playerInstance.dy);
            playerInstance.dx /= length;
            playerInstance.dy /= length;
        }

        const currentTime = Date.now();
        if (currentTime - playerInstance.lastShootTime >= (window.GameConfig.PLAYER_SHOOT_RATE || 100)) {
            let shootX = 0, shootY = 0;
            if (window.keys['ArrowUp']) shootY = -1;
            if (window.keys['ArrowDown']) shootY = 1;
            if (window.keys['ArrowLeft']) shootX = -1;
            if (window.keys['ArrowRight']) shootX = 1;

            if (shootX !== 0 || shootY !== 0) {
                if (shootX !== 0 && shootY !== 0) {
                    const length = Math.sqrt(shootX * shootX + shootY * shootY);
                    shootX /= length;
                    shootY /= length;
                }
                window.Projectiles.createPlayerProjectile(playerInstance.sprite.x, playerInstance.sprite.y, shootX, shootY);
                playerInstance.lastShootTime = currentTime;
                // Sound is played by createPlayerProjectile
            }
        }
    }

    // Handles gamepad input for player movement and shooting
    function handlePlayerGamepadInput(playerInstance) {
        if (!playerInstance || !playerInstance.isAlive || !window.GameConfig || !window.Projectiles) {
            return false; // Indicate gamepad not used or player not active
        }
        if (window.gameState !== 'PLAYING') return false;

        let gamepadInputProcessed = false;

        // Values like window.gamepadMovementX are assumed to be updated by a global gamepad polling mechanism in main.js
        const moveX = typeof window.gamepadMovementX === 'number' ? window.gamepadMovementX : 0;
        const moveY = typeof window.gamepadMovementY === 'number' ? window.gamepadMovementY : 0;
        const shootX = typeof window.gamepadShootingX === 'number' ? window.gamepadShootingX : 0;
        const shootY = typeof window.gamepadShootingY === 'number' ? window.gamepadShootingY : 0;

        if (moveX !== 0 || moveY !== 0) {
            playerInstance.dx = moveX;
            playerInstance.dy = moveY;
            const length = Math.sqrt(playerInstance.dx * playerInstance.dx + playerInstance.dy * playerInstance.dy);
            if (length > 1) { // Normalize if magnitude > 1 (sticks can go beyond unit circle)
               playerInstance.dx /= length;
               playerInstance.dy /= length;
            }
            gamepadInputProcessed = true;
        } else {
            // If no gamepad movement, ensure keyboard input can take over by not setting dx/dy to 0 here
            // playerInstance.dx = 0;
            // playerInstance.dy = 0;
        }


        const currentTime = Date.now();
        if (currentTime - playerInstance.lastShootTime >= (window.GameConfig.PLAYER_SHOOT_RATE || 100)) {
            if (shootX !== 0 || shootY !== 0) {
                const shootLength = Math.sqrt(shootX * shootX + shootY * shootY);
                // shootLength check is important, as deadzone might make shootX/Y small but non-zero
                if (shootLength > (window.GameConfig.GAMEPAD_DEADZONE || 0.2)) {
                    window.Projectiles.createPlayerProjectile(playerInstance.sprite.x, playerInstance.sprite.y, shootX / shootLength, shootY / shootLength);
                    playerInstance.lastShootTime = currentTime;
                    gamepadInputProcessed = true;
                }
            }
        }
        return gamepadInputProcessed;
    }


    function updatePlayer(playerInstance, delta) {
        if (!playerInstance || !playerInstance.isAlive || !playerInstance.sprite || playerInstance.sprite._destroyed || !window.GameConfig) {
            return;
        }
        // This function is for the human player. Demo player logic will be in attractMode.js
        if (window.gameState !== 'PLAYING') return;


        playerInstance.sprite.x += playerInstance.dx * (window.GameConfig.PLAYER_SPEED || 2) * delta;
        playerInstance.sprite.y += playerInstance.dy * (window.GameConfig.PLAYER_SPEED || 2) * delta;

        playerInstance.sprite.x = Math.max(5, Math.min(window.GameConfig.GAME_WIDTH - 5, playerInstance.sprite.x));
        playerInstance.sprite.y = Math.max(5, Math.min(window.GameConfig.GAME_HEIGHT - 5, playerInstance.sprite.y));

        // Invulnerability and shield effect
        // window.playerInvulnerableTime is managed by gameLogic.js
        if (typeof window.playerInvulnerableTime !== 'undefined' && window.playerInvulnerableTime > 0) {
            // playerInvulnerableTime is assumed to be decreased in gameLogic's update loop or main loop

            const invulnerablePhase = (window.playerInvulnerableTime / 1000) * Math.PI * 2 * 2; // Faster pulse
            playerInstance.sprite.alpha = 0.6 + Math.sin(invulnerablePhase * 3) * 0.4; // More pronounced alpha blink

            if (!playerInstance.shieldEffect || playerInstance.shieldEffect._destroyed) {
                if (window.PIXI) {
                    playerInstance.shieldEffect = new window.PIXI.Graphics();
                    playerInstance.shieldEffect.beginFill(0x00FFFF, 0.25); // Cyan, slightly more opaque
                    playerInstance.shieldEffect.drawCircle(0, 0, 10); // Slightly smaller circle for player sprite
                    playerInstance.shieldEffect.endFill();
                    playerInstance.sprite.addChild(playerInstance.shieldEffect);
                }
            }

            if (playerInstance.shieldEffect && !playerInstance.shieldEffect._destroyed) {
                const shieldScale = 1.0 + Math.sin(invulnerablePhase * 2) * 0.15;
                playerInstance.shieldEffect.scale.set(shieldScale);
                playerInstance.shieldEffect.rotation = invulnerablePhase * 0.5;
                playerInstance.shieldEffect.alpha = 0.3 + Math.sin(invulnerablePhase * 5) * 0.2;
            }
        } else { // Not invulnerable
            playerInstance.sprite.alpha = 1.0;
            if (playerInstance.shieldEffect && !playerInstance.shieldEffect._destroyed) {
                playerInstance.sprite.removeChild(playerInstance.shieldEffect);
                playerInstance.shieldEffect.destroy();
                playerInstance.shieldEffect = null;
            }
        }
    }

    window.Player = {
        createPlayer,
        handlePlayerKeyboardInput,
        handlePlayerGamepadInput,
        updatePlayer
    };

})();
