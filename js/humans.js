(function() {
    // Assumes window.PIXI, window.GameConfig, window.SoundManager,
    // window.humansContainer, window.humansAndProgs (array),
    // window.gameState, window.player, window.demoPlayer, window.humanTexture are available.

    function createHuman(x, y) {
        console.log("[Humans.createHuman] Called with x:", x, "y:", y);

        if (!window.PIXI) {
            console.warn("[Humans.createHuman] FAILED: window.PIXI is missing.");
            return null;
        }
        if (!window.humanTexture || !window.humanTexture.baseTexture || !window.humanTexture.baseTexture.valid) { // Added more detailed texture check
            console.warn("[Humans.createHuman] FAILED: window.humanTexture is missing or invalid. Valid:", window.humanTexture && window.humanTexture.baseTexture ? window.humanTexture.baseTexture.valid : 'N/A');
            return null;
        }
        if (!window.humansContainer) {
            console.warn("[Humans.createHuman] FAILED: window.humansContainer is missing.");
            return null;
        }
        if (!window.humansAndProgs) {
            console.warn("[Humans.createHuman] FAILED: window.humansAndProgs array is missing.");
            return null;
        }
        if (!window.GameConfig || !window.GameConfig.HUMAN_SPEED) {
            console.warn("[Humans.createHuman] FAILED: window.GameConfig or HUMAN_SPEED is missing. GameConfig exists:", !!window.GameConfig, "HUMAN_SPEED exists:", !!(window.GameConfig && window.GameConfig.HUMAN_SPEED));
            return null;
        }

        console.log("[Humans.createHuman] All dependencies seem OK.");

        const humanSprite = new window.PIXI.Sprite(window.gruntTexture); // TEMP: Using gruntTexture for humans
        console.log("[Humans.createHuman] Attempting to use texture:", window.gruntTexture ? "gruntTexture" : "MISSING gruntTexture", "for human sprite. Original humanTexture valid:", window.humanTexture && window.humanTexture.baseTexture ? window.humanTexture.baseTexture.valid : 'N/A');
        humanSprite.anchor.set(0.5);
        humanSprite.x = x;
        humanSprite.y = y;

        console.log("[Humans.createHuman] Human sprite created at x:", humanSprite.x, "y:", humanSprite.y);

        window.humansContainer.addChild(humanSprite);
        console.log("[Humans.createHuman] Human sprite added to humansContainer. Container children:", window.humansContainer.children.length);

        const human = {
            sprite: humanSprite,
            type: 'human',
            originalColor: 0xFFFFFF,
            isEvil: false,
            reprogramTimer: 0,
            isRescued: false,
            dx: (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2,
            dy: (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2,
            wanderTimer: Math.random() * 100 + 50,
            flashTimer: 0
        };

        window.humansAndProgs.push(human);
        console.log("[Humans.createHuman] Human object pushed to humansAndProgs array. Array length:", window.humansAndProgs.length);

        return human;
    }

    function convertToProg(humanEntity) {
        if (!humanEntity || humanEntity.type === 'prog' || !humanEntity.sprite || humanEntity.sprite._destroyed) return;
        if (!window.SoundManager) {
            console.warn("Humans.convertToProg: Missing SoundManager.");
            return;
        }
        humanEntity.type = 'prog';
        humanEntity.health = 1;
        humanEntity.points = (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.PROG : 100; // Use GameConfig if available
        humanEntity.sprite.tint = 0xFF00FF;
        humanEntity.flashTimer = 0; // Reset flashTimer for prog animation
        window.SoundManager.play('humanToProg');
    }

    function updateHumansAndProgs(delta) {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.humansAndProgs || !window.GameConfig) {
            // console.warn("Humans.updateHumansAndProgs: Missing dependencies.");
            return;
        }

        const currentPlayer = window.gameState === 'DEMO_PLAY' ? window.demoPlayer : window.player;

        for (let i = window.humansAndProgs.length - 1; i >= 0; i--) {
            const entity = window.humansAndProgs[i];
            if (!entity || !entity.sprite || entity.sprite._destroyed) {
                window.humansAndProgs.splice(i, 1);
                continue;
            }

            if (entity.type === 'human') {
                // If being reprogrammed by a brain, the brain controls its tint.
                // Otherwise, if it became evil (e.g. by brain), it might have specific behavior or appearance.
                // For now, basic wandering unless being reprogrammed.
                if (!entity.isEvil && entity.reprogramTimer <= 0) { // Not actively being reprogrammed
                     entity.sprite.tint = 0xFFFFFF; // Default human color
                }


                entity.wanderTimer -= delta;
                if (entity.wanderTimer <= 0) {
                    entity.dx = (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2; // Original had HUMAN_SPEED * 2
                    entity.dy = (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2; // Original had HUMAN_SPEED * 2
                    entity.wanderTimer = Math.random() * 100 + 50;
                }
                entity.sprite.x += entity.dx * delta;
                entity.sprite.y += entity.dy * delta;

                // Boundary checks
                if (entity.sprite.x < 5) { entity.sprite.x = 5; entity.dx *= -1; }
                if (entity.sprite.x > window.GameConfig.GAME_WIDTH - 5) { entity.sprite.x = window.GameConfig.GAME_WIDTH - 5; entity.dx *= -1; }
                if (entity.sprite.y < 5) { entity.sprite.y = 5; entity.dy *= -1; }
                if (entity.sprite.y > window.GameConfig.GAME_HEIGHT - 5) { entity.sprite.y = window.GameConfig.GAME_HEIGHT - 5; entity.dy *= -1; }

            } else if (entity.type === 'prog') {
                if (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) {
                    const angle = Math.atan2(currentPlayer.sprite.y - entity.sprite.y, currentPlayer.sprite.x - entity.sprite.x);
                    // Prog movement can be made more erratic or direct based on original intent.
                    // Original had 'erraticAngle', let's keep it simple for now or match original more closely if specified.
                    // const erraticAngle = angle + (Math.random() - 0.5) * 0.5;
                    entity.sprite.x += Math.cos(angle) * window.GameConfig.PROG_SPEED * delta;
                    entity.sprite.y += Math.sin(angle) * window.GameConfig.PROG_SPEED * delta;
                }
                entity.flashTimer += 0.2 * delta;
                entity.sprite.alpha = 0.5 + Math.sin(entity.flashTimer) * 0.5;

                // Boundary checks for Prog
                entity.sprite.x = Math.max(5, Math.min(window.GameConfig.GAME_WIDTH - 5, entity.sprite.x));
                entity.sprite.y = Math.max(5, Math.min(window.GameConfig.GAME_HEIGHT - 5, entity.sprite.y));
            }
        }
    }

    window.Humans = {
        createHuman,
        convertToProg,
        updateHumansAndProgs
    };

})();
