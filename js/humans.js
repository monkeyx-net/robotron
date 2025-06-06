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

        const humanSprite = new window.PIXI.Sprite(window.humanTexture);
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
        if (!window.humansAndProgs || !window.GameConfig || !window.humansContainer) {
            // console.warn("Humans.updateHumansAndProgs: Missing dependencies."); // Already have this guard
            return;
        }

        // Log container visibility once per state change or first call in relevant state
        if (window.Humans && (typeof window.Humans.lastLoggedHCVisible === 'undefined' || window.Humans.lastLoggedHCVisible !== window.humansContainer.visible || window.Humans.lastLoggedHCAlpha !== window.humansContainer.alpha)) {
            console.log(`[updateHumansAndProgs] humansContainer: visible=${window.humansContainer.visible}, alpha=${window.humansContainer.alpha.toFixed(2)}, children=${window.humansContainer.children.length}`);
            window.Humans.lastLoggedHCVisible = window.humansContainer.visible;
            window.Humans.lastLoggedHCAlpha = window.humansContainer.alpha;
        }

        const currentPlayer = window.gameState === 'DEMO_PLAY' ? window.demoPlayer : window.player;

        for (let i = window.humansAndProgs.length - 1; i >= 0; i--) {
            const entity = window.humansAndProgs[i];
            if (!entity || !entity.sprite || entity.sprite._destroyed) {
                console.log(`[updateHumansAndProgs] Splicing invalid entity at index ${i}. Type was: ${entity ? entity.type : 'unknown'}`);
                window.humansAndProgs.splice(i, 1);
                continue;
            }

            if (entity.type === 'human') {
                // Check if sprite still has a parent; if not, it was removed from container elsewhere
                const parentInfo = entity.sprite.parent ? `parent=${entity.sprite.parent === window.humansContainer ? 'humansContainer' : 'DIFFERENT_PARENT!'}` : "NO_PARENT";
                console.log(
                    `[updateHumansAndProgs] Human: id=${i}, x=${entity.sprite.x.toFixed(1)}, y=${entity.sprite.y.toFixed(1)}, visible=${entity.sprite.visible}, alpha=${entity.sprite.alpha.toFixed(2)}, ${parentInfo}, arrayLen=${window.humansAndProgs.length}`
                );

                if (!entity.sprite.parent) { // If sprite lost its parent, don't try to update it further here
                    console.warn(`[updateHumansAndProgs] Human sprite at index ${i} has no parent, skipping update logic for it.`);
                    // It might have been removed by collision logic already.
                    // Consider if it should be spliced from humansAndProgs here if it has no parent.
                    // For now, just log and skip its update. Collision logic should handle splicing from humansAndProgs.
                    continue;
                }

                if (!entity.isEvil && entity.reprogramTimer <= 0) {
                     entity.sprite.tint = 0xFFFFFF;
                }

                entity.wanderTimer -= delta;
                if (entity.wanderTimer <= 0) {
                    entity.dx = (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2;
                    entity.dy = (Math.random() - 0.5) * window.GameConfig.HUMAN_SPEED * 2;
                    entity.wanderTimer = Math.random() * 100 + 50;
                }
                entity.sprite.x += entity.dx * delta;
                entity.sprite.y += entity.dy * delta;

                if (entity.sprite.x < 5) { entity.sprite.x = 5; entity.dx *= -1; }
                if (entity.sprite.x > window.GameConfig.GAME_WIDTH - 5) { entity.sprite.x = window.GameConfig.GAME_WIDTH - 5; entity.dx *= -1; }
                if (entity.sprite.y < 5) { entity.sprite.y = 5; entity.dy *= -1; }
                if (entity.sprite.y > window.GameConfig.GAME_HEIGHT - 5) { entity.sprite.y = window.GameConfig.GAME_HEIGHT - 5; entity.dy *= -1; }

            } else if (entity.type === 'prog') {
                // Prog logic (unchanged for now, can add logging if needed later)
                if (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) {
                    const angle = Math.atan2(currentPlayer.sprite.y - entity.sprite.y, currentPlayer.sprite.x - entity.sprite.x);
                    entity.sprite.x += Math.cos(angle) * window.GameConfig.PROG_SPEED * delta;
                    entity.sprite.y += Math.sin(angle) * window.GameConfig.PROG_SPEED * delta;
                }
                entity.flashTimer += 0.2 * delta;
                entity.sprite.alpha = 0.5 + Math.sin(entity.flashTimer) * 0.5;
                entity.sprite.x = Math.max(5, Math.min(window.GameConfig.GAME_WIDTH - 5, entity.sprite.x));
                entity.sprite.y = Math.max(5, Math.min(window.GameConfig.GAME_HEIGHT - 5, entity.sprite.y));
            }
        }
    }

    const HumansModule = {
        createHuman,
        convertToProg,
        updateHumansAndProgs,
        lastLoggedHCVisible: undefined, // For logging humansContainer state
        lastLoggedHCAlpha: undefined   // For logging humansContainer state
    };
    window.Humans = HumansModule;

})();
