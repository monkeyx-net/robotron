(function() {
    // Initialize and expose game state variables
    // These are intended to be accessible globally via window.VAR_NAME
    // gameState is initialized/managed by main.js/attractMode.js primarily.
    // gameLogic functions will read/update it.
    window.score = 0;
    window.lives = 0; // Will be set by GameConfig.INITIAL_LIVES in resetGameVariables
    window.wave = 0;
    window.currentHumanRescueBonus = 0; // Initialized in resetGameVariables or startNextWave
    window.humanRescueBonusDecayTimer = 0;
    window.nextExtraLifeScore = 0; // Initialized in resetGameVariables
    window.highScore = 0; // Loaded by loadHighScore
    window.playerInvulnerableTime = 0; // Time in ms

    // --- High Score ---
    function loadHighScore() {
        if (!window.GameConfig) return; // GameConfig might not be ready during initial script parse order
        const savedScore = localStorage.getItem('robotronHighScore');
        if (savedScore !== null) {
            window.highScore = parseInt(savedScore, 10);
        } else {
            window.highScore = 0;
        }
        // Ensure nextExtraLifeScore is set if it depends on highScore or a default
        window.nextExtraLifeScore = window.GameConfig.EXTRA_LIFE_SCORE_INTERVAL || 25000;
    }

    function saveHighScore() {
        localStorage.setItem('robotronHighScore', String(window.highScore));
    }

    // --- Game State Management ---
    function resetGameVariables() {
        if (!window.GameConfig) { console.warn("resetGameVariables: GameConfig not found."); return; }

        window.score = 0;
        window.lives = window.GameConfig.INITIAL_LIVES;
        window.wave = 0;
        window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
        window.humanRescueBonusDecayTimer = 0;
        window.nextExtraLifeScore = window.GameConfig.EXTRA_LIFE_SCORE_INTERVAL;
        window.playerInvulnerableTime = 0;

        clearEntities(); // Clear all entities on screen

        if (window.UI && window.UI.updateScoreDisplay) window.UI.updateScoreDisplay();
        if (window.UI && window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();
        // UI.updateUI() will also be called by main loop or state change handler
    }

    function clearEntities() {
        // Player projectiles
        if (window.playerProjectiles && window.playerProjectilesContainer) {
            window.playerProjectiles.forEach(p => { if (p.sprite && !p.sprite._destroyed) p.sprite.destroy(); });
            window.playerProjectiles.length = 0;
        }
        // Enemy projectiles
        if (window.enemyProjectiles && window.enemyProjectilesContainer) {
            window.enemyProjectiles.forEach(p => { if (p.sprite && !p.sprite._destroyed) p.sprite.destroy(); });
            window.enemyProjectiles.length = 0;
        }
        // Enemies
        if (window.enemies && window.enemiesContainer) {
            window.enemies.forEach(e => { if (e.sprite && !e.sprite._destroyed) e.sprite.destroy(); });
            window.enemies.length = 0;
        }
        // Humans and Progs
        if (window.humansAndProgs && window.humansContainer) {
            window.humansAndProgs.forEach(h => { if (h.sprite && !h.sprite._destroyed) h.sprite.destroy(); });
            window.humansAndProgs.length = 0;
        }
        // Obstacles
        if (window.obstacles && window.obstaclesContainer) {
            window.obstacles.forEach(o => { if (o.sprite && !o.sprite._destroyed) o.sprite.destroy(); });
            window.obstacles.length = 0;
        }
        // Effects
        if (window.effectsContainer) { // Effects container directly holds children sprites
            // Iterate backwards safely
            for (let i = window.effectsContainer.children.length - 1; i >= 0; i--) {
                const child = window.effectsContainer.children[i];
                if (child && child.destroy) child.destroy();
            }
            // PIXI might also have effectsContainer.removeChildren(0, effectsContainer.children.length);
            window.effectsContainer.removeChildren();
        }

        // Player sprite (if exists and managed by window.player)
        // createPlayer in Player.js handles its own sprite, but main.js might nullify window.player
        if (window.player && window.player.sprite && !window.player.sprite._destroyed) {
            window.player.sprite.destroy();
            // window.player = null; // main.js should manage nullifying window.player
        }
        // Demo player sprite
        if (window.demoPlayer && window.demoPlayer.sprite && !window.demoPlayer.sprite._destroyed) {
            window.demoPlayer.sprite.destroy();
            // window.demoPlayer = null; // main.js/attractMode.js should manage this
        }
    }

    // --- Core Gameplay Logic ---
    function playerHit() {
        if (!window.player || !window.player.isAlive || window.playerInvulnerableTime > 0) return;
        if (!window.GameConfig || !window.SoundManager || !window.Effects || !window.UI) {
            console.warn("playerHit: Missing critical dependencies."); return;
        }

        window.Effects.createExplosion(window.player.sprite.x, window.player.sprite.y);
        window.SoundManager.play('playerDeath');
        window.lives--;
        window.player.isAlive = false;
        window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
        window.humanRescueBonusDecayTimer = 0;
        if(window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();


        if (window.lives <= 0) {
            window.gameState = 'GAME_OVER'; // Update global state
            if (window.UI && window.UI.showGameOverScreen) window.UI.showGameOverScreen();
        } else {
            window.playerInvulnerableTime = window.GameConfig.RESPAWN_INVULNERABILITY_TIME;
            if (window.player.sprite) window.player.sprite.visible = false; // Hide sprite

            // Respawn timer
            setTimeout(() => {
                if (window.gameState === 'GAME_OVER') return; // Don't respawn if game ended
                if (window.player && window.player.sprite && window.GameConfig) { // Check player still exists
                    window.player.sprite.x = window.GameConfig.GAME_WIDTH / 2;
                    window.player.sprite.y = window.GameConfig.GAME_HEIGHT / 2;
                    window.player.sprite.dx = 0; // Reset momentum
                    window.player.sprite.dy = 0;
                    window.player.sprite.visible = true;
                }
                if (window.player) window.player.isAlive = true;
                // playerInvulnerableTime is already set and will be counted down by main game loop
            }, 500); // Short delay before repositioning and making visible
        }
        if (window.UI && window.UI.updateUI) window.UI.updateUI(); // Update lives display etc.
    }

    function isColliding(spriteA, spriteB, tolerance = 5) {
        if (!spriteA || !spriteB || spriteA._destroyed || spriteB._destroyed || !spriteA.visible || !spriteB.visible) return false;
        // Ensure getBounds() is available, indicates a valid PIXI display object
        if (typeof spriteA.getBounds !== 'function' || typeof spriteB.getBounds !== 'function') return false;

        const a = spriteA.getBounds(true); // Pass true for local bounds if sprite has children and complex pivot
        const b = spriteB.getBounds(true);

        return a.x + tolerance < b.x + b.width &&
               a.x + a.width > b.x + tolerance &&
               a.y + tolerance < b.y + b.height &&
               a.y + a.height > b.y + tolerance;
    }

    function startNextWave() {
        if (!window.GameConfig || !window.SoundManager || !window.Enemies || !window.Humans || !window.Obstacles) {
             console.warn("startNextWave: Missing critical dependencies."); return;
        }
        window.wave++;
        console.log(`Starting Wave: ${window.wave}`);
        window.SoundManager.play('waveStart');
        window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
        window.humanRescueBonusDecayTimer = 0;
        if (window.UI && window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();

        // Clear existing non-player entities for the new wave (optional, depends on desired behavior)
        // Obstacles are typically per-wave. Enemies and projectiles are definitely per-wave.
        // Let's clear obstacles, specific projectiles, and enemies. Humans might persist or be reset.
        // The original code cleared obstacles.
        if (window.obstacles && window.obstaclesContainer) {
            window.obstacles.forEach(o => { if (o.sprite && !o.sprite._destroyed) o.sprite.destroy(); });
            window.obstacles.length = 0;
        }
        // Enemy projectiles clear (player projectiles might be kept briefly or cleared too)
         if (window.enemyProjectiles) window.enemyProjectiles.length = 0;
         if (window.enemyProjectilesContainer) window.enemyProjectilesContainer.removeChildren();


        // Reset player position (if player exists)
        if (window.player && window.player.sprite && !window.player.sprite._destroyed) {
            window.player.sprite.x = window.GameConfig.GAME_WIDTH / 2;
            window.player.sprite.y = window.GameConfig.GAME_HEIGHT / 2;
            window.player.dx = 0; // Reset momentum
            window.player.dy = 0;
        }

        let numGrunts = 0, numHulks = 0, numSpheroids = 0, numBrains = 0, numTanks = 0, numQuarks = 0;
        let numHumansToSpawn = 0, numElectrodes = 0;

        // Wave difficulty scaling logic from original script
        if (window.wave === 1) {
            numGrunts = (20 + Math.floor(Math.random() * 11));
            numHumansToSpawn = (5 + Math.floor(Math.random() * 6));
            numElectrodes = 2 + Math.floor(Math.random() * 3);
        } else if (window.wave >= 2 && window.wave <= 5) {
            numGrunts = 25 + window.wave * 3; numHulks = 1 + Math.floor((window.wave - 2) / 2);
            numSpheroids = 1 + Math.floor((window.wave - 2) / 2); numHumansToSpawn = Math.max(3, 7 - window.wave);
            numElectrodes = 3 + window.wave -1;
        } else if (window.wave >= 6 && window.wave <= 10) {
            numGrunts = 30 + window.wave * 2; numHulks = 2 + Math.floor((window.wave - 6) / 3);
            numSpheroids = 2 + Math.floor((window.wave - 6) / 3); numBrains = 1 + Math.floor((window.wave - 6) / 2);
            numTanks = 1 + Math.floor((window.wave - 6) / 3); numHumansToSpawn = Math.max(2, 5 - Math.floor((window.wave-6)/2) );
            numElectrodes = 5 + Math.floor((window.wave-6)/2);
        } else {
            numGrunts = 30 + window.wave * 2; numHulks = 2 + Math.floor(window.wave/5);
            numSpheroids = 2 + Math.floor(window.wave/5); numBrains = 2 + Math.floor(window.wave/4);
            numTanks = 2 + Math.floor(window.wave/4); numQuarks = 1 + Math.floor((window.wave-10)/3);
            numHumansToSpawn = Math.max(1, 4 - Math.floor(window.wave/5));
            numElectrodes = Math.min(10, 5 + Math.floor(window.wave/3));
        }
        // Temp: reduce enemy count for easier testing during refactor
        // numGrunts = Math.floor(numGrunts * 0.1); numHulks = Math.floor(numHulks * 0.2); numSpheroids = Math.floor(numSpheroids * 0.2);
        // numBrains = Math.floor(numBrains * 0.2); numTanks = Math.floor(numTanks * 0.2); numQuarks = Math.floor(numQuarks * 0.2);
        // numHumansToSpawn = Math.max(1, Math.floor(numHumansToSpawn * 0.5));


        for (let i = 0; i < numElectrodes; i++) {
            const elX = window.GameConfig.GAME_WIDTH * 0.2 + Math.random() * (window.GameConfig.GAME_WIDTH * 0.6);
            const elY = window.GameConfig.GAME_HEIGHT * 0.2 + Math.random() * (window.GameConfig.GAME_HEIGHT * 0.6);
            const elSize = 8 + Math.random() * 8;
            const colors = [0xFF0000, 0xFFFF00, 0x00FFFF, 0xFF00FF, 0x00FF00];
            if (window.Obstacles && window.Obstacles.createElectrode) window.Obstacles.createElectrode(elX, elY, elSize, elSize, colors[i % colors.length]);
        }
        for(let i=0;i<numGrunts;i++){ if (window.Enemies && window.Enemies.createGrunt) window.Enemies.createGrunt(Math.random()*window.GameConfig.GAME_WIDTH, Math.random()*window.GameConfig.GAME_HEIGHT);}
        for(let i=0;i<numHulks;i++){ if (window.Enemies && window.Enemies.createHulk) window.Enemies.createHulk(Math.random()*window.GameConfig.GAME_WIDTH,Math.random()*window.GameConfig.GAME_HEIGHT);}
        for(let i=0;i<numSpheroids;i++){ if (window.Enemies && window.Enemies.createSpheroid) window.Enemies.createSpheroid(Math.random()*window.GameConfig.GAME_WIDTH,Math.random()*window.GameConfig.GAME_HEIGHT);}
        for(let i=0;i<numBrains;i++){ if (window.Enemies && window.Enemies.createBrain) window.Enemies.createBrain(Math.random()*window.GameConfig.GAME_WIDTH,Math.random()*window.GameConfig.GAME_HEIGHT);}
        for(let i=0;i<numTanks;i++){ if (window.Enemies && window.Enemies.createTank) window.Enemies.createTank(Math.random()*window.GameConfig.GAME_WIDTH,Math.random()*window.GameConfig.GAME_HEIGHT);}
        for(let i=0;i<numQuarks;i++){ if (window.Enemies && window.Enemies.createQuark) window.Enemies.createQuark(Math.random()*window.GameConfig.GAME_WIDTH,Math.random()*window.GameConfig.GAME_HEIGHT);}

        for (let i = 0; i < Math.max(1, numHumansToSpawn) ; i++) {
            if (window.Humans && window.Humans.createHuman) window.Humans.createHuman(Math.random() * (window.GameConfig.GAME_WIDTH - 20) + 10, Math.random() * (window.GameConfig.GAME_HEIGHT - 20) + 10);
        }

        if (window.player) window.player.isAlive = true; // Ensure player is alive for the new wave
        window.playerInvulnerableTime = window.GameConfig.RESPAWN_INVULNERABILITY_TIME; // Give brief invulnerability at wave start
    }

    function checkWaveCompletion() {
        if (window.gameState !== 'PLAYING' || !window.enemies) return;

        const activeEnemies = window.enemies.filter(e => !e.indestructible && e.sprite && !e.sprite._destroyed && e.type !== 'hulk'); // Hulks are indestructible
        if (activeEnemies.length === 0) {
            console.log("Wave Complete!");
            window.gameState = 'WAVE_TRANSITION'; // Intermediate state
            // Clear remaining hulks or other indestructible entities if desired
            // window.enemies = window.enemies.filter(e => e.indestructible); // Keep only indestructibles

            setTimeout(() => {
                if (window.gameState === 'GAME_OVER') return; // Game might have ended during transition
                window.gameState = 'PLAYING'; // Set back to PLAYING before starting next wave
                startNextWave();
            }, 2000); // 2-second delay
        }
    }

    function checkForExtraLife() {
        if (window.gameState !== 'PLAYING' || !window.GameConfig || !window.SoundManager) return;
        if (window.score >= window.nextExtraLifeScore) {
            window.lives++;
            window.nextExtraLifeScore += window.GameConfig.EXTRA_LIFE_SCORE_INTERVAL;
            console.log(`Extra life awarded! Lives: ${window.lives}. Next at: ${window.nextExtraLifeScore}`);
            window.SoundManager.play('extraLife');
            if (window.UI && window.UI.updateUI) window.UI.updateUI(); // Update lives display
        }
    }

    function updateBonusDecay(delta) {
        if (window.gameState !== 'PLAYING' || !window.GameConfig) return;
        if (window.humanRescueBonusDecayTimer > 0) {
            window.humanRescueBonusDecayTimer -= delta;
            if (window.humanRescueBonusDecayTimer <= 0) {
                window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
                window.humanRescueBonusDecayTimer = 0;
                console.log("Human rescue bonus decayed.");
                if (window.UI && window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();
            }
        }
    }

    // --- Collision Detection ---
    function checkCollisions() {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.GameConfig || !window.SoundManager || !window.Effects || !window.UI ||
            !window.playerProjectiles || !window.enemyProjectiles || !window.enemies || !window.humansAndProgs || !window.obstacles) {
            // console.warn("checkCollisions: Missing critical dependencies.");
            return;
        }

        const currentPlayer = window.gameState === 'DEMO_PLAY' ? window.demoPlayer : window.player;
        if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) {
             // If no current player (e.g. during GAME_OVER transition or if demo player dies), skip player-related collisions
        }

        // Player Projectile vs Enemy
        for (let i = window.playerProjectiles.length - 1; i >= 0; i--) {
            const p = window.playerProjectiles[i];
            if (!p || !p.sprite || p.sprite._destroyed) continue;

            for (let j = window.enemies.length - 1; j >= 0; j--) {
                const enemy = window.enemies[j];
                if (!enemy || !enemy.sprite || enemy.sprite._destroyed || enemy.indestructible) continue;

                if (isColliding(p.sprite, enemy.sprite, 5)) {
                    if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                    window.playerProjectiles.splice(i, 1);

                    enemy.health--;
                    if (enemy.health <= 0) {
                        let explosionColor = 0xFF0000;
                        let soundToPlayKey = 'gruntPop'; // Default, actual sound keys are in SoundManager

                        if (enemy.type === 'spheroid') { explosionColor = 0xFF8800; soundToPlayKey = 'spheroidPop'; }
                        else if (enemy.type === 'enforcer') { explosionColor = 0x00AAFF; soundToPlayKey = 'enforcerPop'; }
                        else if (enemy.type === 'brain') { explosionColor = 0xFF88FF; soundToPlayKey = 'brainPop'; }
                        else if (enemy.type === 'tank') { explosionColor = 0xAAAAAA; soundToPlayKey = 'tankPop'; }
                        else if (enemy.type === 'quark') { explosionColor = 0xF0F0F0; soundToPlayKey = 'quarkPop'; }
                        else if (enemy.type === 'sub_quark') { explosionColor = 0xD0D0D0; soundToPlayKey = 'subQuarkPop'; }
                        else if (enemy.type === 'prog_enemy') { explosionColor = 0xFF55FF; soundToPlayKey = 'progDestroy';}


                        window.Effects.createExplosion(enemy.sprite.x, enemy.sprite.y, explosionColor);
                        window.SoundManager.play(soundToPlayKey);
                        if (enemy.sprite && !enemy.sprite._destroyed) enemy.sprite.destroy();
                        window.enemies.splice(j, 1);

                        if (window.gameState === 'PLAYING' && (!p.isDemoProjectile)) { // Ensure score only for player
                            window.score += enemy.points || 0; // Use points from enemy object
                            if(window.UI.updateScoreDisplay) window.UI.updateScoreDisplay();
                            checkForExtraLife();
                        }
                    }
                    break; // Projectile is consumed
                }
            }
            if (!p || p.sprite._destroyed) continue; // Projectile might have been destroyed by hitting an enemy

            // Player Projectile vs Human-Converted Prog (from humansAndProgs list)
            for (let k = window.humansAndProgs.length - 1; k >= 0; k--) {
                const entity = window.humansAndProgs[k];
                if (entity.type === 'prog' && entity.sprite && !entity.sprite._destroyed) { // 'prog' from human conversion
                    if (isColliding(p.sprite, entity.sprite, 5)) {
                        if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                        window.playerProjectiles.splice(i, 1);

                        window.Effects.createExplosion(entity.sprite.x, entity.sprite.y, 0xFF55FF);
                        window.SoundManager.play('progDestroy');
                        if (entity.sprite && !entity.sprite._destroyed) entity.sprite.destroy();
                        window.humansAndProgs.splice(k, 1);

                        if (window.gameState === 'PLAYING' && (!p.isDemoProjectile)) {
                            window.score += entity.points || 0; // Use points from prog object
                           if(window.UI.updateScoreDisplay) window.UI.updateScoreDisplay();
                            checkForExtraLife();
                        }
                        break; // Projectile is consumed
                    }
                }
            }
        }

        if (currentPlayer && currentPlayer.isAlive && currentPlayer.sprite && !currentPlayer.sprite._destroyed) {
            const invulnerable = window.gameState === 'PLAYING' && window.playerInvulnerableTime > 0;

            // Enemy Projectile vs Player
            for (let i = window.enemyProjectiles.length - 1; i >= 0; i--) {
                const p = window.enemyProjectiles[i];
                if (!p || !p.sprite || p.sprite._destroyed) continue;
                if (!invulnerable && isColliding(p.sprite, currentPlayer.sprite, 5)) {
                    if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                    window.enemyProjectiles.splice(i,1);
                    if (window.gameState === 'PLAYING') playerHit();
                    // Demo player hit logic would be handled by attractMode.js if it has its own collision check
                    break;
                }
            }

            // Player vs Enemy
            if (!invulnerable) {
                for (let i = window.enemies.length - 1; i >= 0; i--) {
                    const enemy = window.enemies[i];
                    if (!enemy || !enemy.sprite || enemy.sprite._destroyed) continue;
                    if (isColliding(currentPlayer.sprite, enemy.sprite, 8)) {
                        if (window.gameState === 'PLAYING') playerHit();
                        break;
                    }
                }
                // Player vs Human-Converted Prog
                for (let i = window.humansAndProgs.length - 1; i >= 0; i--) {
                    const entity = window.humansAndProgs[i];
                    if (entity.type === 'prog' && entity.sprite && !entity.sprite._destroyed) {
                        if (isColliding(currentPlayer.sprite, entity.sprite, 8)) {
                           if (window.gameState === 'PLAYING') playerHit();
                           break;
                        }
                    }
                }
            }

            // Player vs Obstacle (Electrodes)
            if (!invulnerable) {
                for (let i = window.obstacles.length - 1; i >= 0; i--) {
                    const obstacle = window.obstacles[i];
                    if (!obstacle || !obstacle.sprite || obstacle.sprite._destroyed) continue;
                    if (obstacle.type === 'electrode' && isColliding(currentPlayer.sprite, obstacle.sprite, 6)) {
                        if (window.gameState === 'PLAYING') playerHit();
                        break;
                    }
                }
            }

            // Player vs Human (Rescue)
            for (let i = window.humansAndProgs.length - 1; i >= 0; i--) {
                const humanEntity = window.humansAndProgs[i];
                 if (humanEntity.type === 'human' && !humanEntity.isRescued && humanEntity.sprite && !humanEntity.sprite._destroyed) {
                    if (isColliding(currentPlayer.sprite, humanEntity.sprite, 8)) {
                        if (humanEntity.sprite && !humanEntity.sprite._destroyed) humanEntity.sprite.destroy();
                        window.humansAndProgs.splice(i, 1);
                        if (window.gameState === 'PLAYING') {
                            window.score += window.currentHumanRescueBonus;
                            if(window.UI.updateScoreDisplay) window.UI.updateScoreDisplay();
                            checkForExtraLife();
                            window.SoundManager.play('humanRescue');
                            if (window.currentHumanRescueBonus < window.GameConfig.MAX_HUMAN_RESCUE_BONUS) {
                                window.currentHumanRescueBonus += window.GameConfig.HUMAN_RESCUE_BONUS_INCREMENT;
                            }
                            window.humanRescueBonusDecayTimer = window.GameConfig.HUMAN_RESCUE_BONUS_DECAY_DURATION;
                            if(window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();
                        }
                        // No specific demo player rescue score/sound in original, handled by demo logic if needed
                    }
                }
            }
        } // End of if(currentPlayer && currentPlayer.isAlive)

        // --- Non-Player specific collisions ---
        // Enemy Projectile vs Human (Tank Shells only in original)
        for (let i = window.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = window.enemyProjectiles[i];
            if (!p || !p.sprite || p.sprite._destroyed || p.type !== 'tank_shell') continue;
            for (let j = window.humansAndProgs.length - 1; j >=0; j--) {
                const humanEntity = window.humansAndProgs[j];
                if (humanEntity.type === 'human' && humanEntity.sprite && !humanEntity.sprite._destroyed) {
                    if (isColliding(p.sprite, humanEntity.sprite, 5)) {
                        if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                        window.enemyProjectiles.splice(i,1);

                        window.Effects.createExplosion(humanEntity.sprite.x, humanEntity.sprite.y, 0xCCCCCC);
                        window.SoundManager.play('humanDeathByEnemy');
                        if (humanEntity.sprite && !humanEntity.sprite._destroyed) humanEntity.sprite.destroy();
                        window.humansAndProgs.splice(j, 1);

                        if (window.gameState === 'PLAYING') { // Only reset bonus if it's actual gameplay
                            window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
                            window.humanRescueBonusDecayTimer = 0;
                            if(window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();
                        }
                        break;
                    }
                }
            }
        }

        // Enemy vs Human (Hulk killing human)
        for (let i = window.enemies.length - 1; i >= 0; i--) {
            const enemy = window.enemies[i];
            if (!enemy || !enemy.sprite || enemy.sprite._destroyed || enemy.type !== 'hulk') continue;

            for (let j = window.humansAndProgs.length - 1; j >= 0; j--) {
                const humanEntity = window.humansAndProgs[j];
                if (humanEntity.type === 'human' && !humanEntity.isRescued && humanEntity.sprite && !humanEntity.sprite._destroyed) {
                    if (isColliding(enemy.sprite, humanEntity.sprite, 10)) {
                        window.Effects.createExplosion(humanEntity.sprite.x, humanEntity.sprite.y, 0xCCCCCC);
                        window.SoundManager.play('humanDeathByEnemy');
                        if (humanEntity.sprite && !humanEntity.sprite._destroyed) humanEntity.sprite.destroy();
                        window.humansAndProgs.splice(j, 1);
                        if (window.gameState === 'PLAYING') {
                            window.currentHumanRescueBonus = window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
                            window.humanRescueBonusDecayTimer = 0;
                           if(window.UI.updateBonusDisplay) window.UI.updateBonusDisplay();
                        }
                        // No break here, Hulk might trample multiple humans
                    }
                }
            }
        }
    } // End checkCollisions

    window.GameLogic = {
        loadHighScore, saveHighScore,
        resetGameVariables, clearEntities,
        playerHit, isColliding, startNextWave, checkWaveCompletion,
        checkForExtraLife, updateBonusDecay, checkCollisions
    };

    // Initial load of high score when script is parsed
    // loadHighScore(); // This might be too early if GameConfig is not yet on window.
                       // main.js should call loadHighScore once all configs are set.
})();
