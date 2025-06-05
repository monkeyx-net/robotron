(function() {
    // Assumes window.PIXI, window.GameConfig, window.SoundManager,
    // window.humansContainer, window.humansAndProgs (array),
    // window.gameState, window.player, window.demoPlayer, window.humanTexture are available.

    function createHuman(x, y) {
        if (!window.PIXI || !window.humanTexture || !window.humansContainer || !window.humansAndProgs || !window.GameConfig || !window.GameConfig.HUMAN_SPEED) {
            console.warn("Humans.createHuman: Missing dependencies.");
            return null;
        }
        const humanSprite = new window.PIXI.Sprite(window.humanTexture);
        humanSprite.anchor.set(0.5);
        humanSprite.x = x;
        humanSprite.y = y;
        window.humansContainer.addChild(humanSprite);
        const human = {
            sprite: humanSprite,
            type: 'human',
            originalColor: 0xFFFFFF, // Not used in current logic but was in original struct
            isEvil: false,           // For brain interaction
            reprogramTimer: 0,     // For brain interaction
            isRescued: false,        // Added to track if human was rescued, for brain targeting logic
            dx: (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2, // Original had HUMAN_SPEED * 2 effectively
            dy: (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2, // Original had HUMAN_SPEED * 2 effectively
            wanderTimer: Math.random() * 100 + 50,
            flashTimer: 0 // Not used in current human logic but was in original struct
        };
        window.humansAndProgs.push(human);
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
