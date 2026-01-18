import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { playerProjectiles, enemyProjectiles, enemies, humansAndProgs, obstacles, player, demoPlayer, app, effectsContainer } from './main';
import { UI } from './ui';
import { SoundManager } from './soundManager';
import { Effects } from './effects';
import { Enemies } from './enemies';
import { Humans } from './humans';
import { Obstacles } from './obstacles';
import { gameState } from './gameState';
import { gameEvents } from './core/EventSystem';
import { Vector2 } from './utils/Vector2';

// --- High Score ---
export function loadHighScore() {
    if (!GameConfig) return; // GameConfig might not be ready during initial script parse order
    const savedScore = localStorage.getItem('robotronHighScore');
    if (savedScore !== null) {
        gameState.highScore = parseInt(savedScore, 10);
    } else {
        gameState.highScore = 0;
    }
    // Ensure nextExtraLifeScore is set if it depends on highScore or a default
    gameState.nextExtraLifeScore = GameConfig.EXTRA_LIFE_SCORE_INTERVAL || 25000;
}

export function saveHighScore() {
    localStorage.setItem('robotronHighScore', String(gameState.highScore));
}

// --- Game State Management ---
export function resetGameVariables() {
    if (!GameConfig) { console.warn("resetGameVariables: GameConfig not found."); return; }

    gameState.score = 0;
    gameState.lives = GameConfig.INITIAL_LIVES;
    gameState.wave = 0;
    gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
    gameState.humanRescueBonusDecayTimer = 0;
    gameState.nextExtraLifeScore = GameConfig.EXTRA_LIFE_SCORE_INTERVAL;
    gameState.playerInvulnerableTime = 0;

    clearEntities(true); // Clear all entities on screen including humans for game reset

    if (UI && UI.updateScoreDisplay) UI.updateScoreDisplay();
    if (UI && UI.updateBonusDisplay) UI.updateBonusDisplay();
    // UI.updateUI() will also be called by main loop or state change handler
}

export function clearEntities(clearHumans: boolean = false) {
    // Player projectiles
    if (playerProjectiles) {
        playerProjectiles.forEach(p => { if (p.sprite && !p._destroyed) p.sprite.destroy(); });
        playerProjectiles.length = 0;
    }
    // Enemy projectiles
    if (enemyProjectiles) {
        enemyProjectiles.forEach(p => { if (p.sprite && !p._destroyed) p.sprite.destroy(); });
        enemyProjectiles.length = 0;
    }
    // Enemies
    if (enemies) {
        enemies.forEach(e => { if (e.sprite && !e._destroyed) e.sprite.destroy(); });
        enemies.length = 0;
    }
    // Humans and Progs - only clear if explicitly requested (for game reset)
    if (clearHumans && humansAndProgs) {
        humansAndProgs.forEach(h => { if (h.sprite && !h._destroyed) h.sprite.destroy(); });
        humansAndProgs.length = 0;
    }
    // Obstacles
    if (obstacles) {
        obstacles.forEach(o => { if (o.sprite && !o.sprite._destroyed) o.sprite.destroy(); });
        obstacles.length = 0;
    }
    // Effects
    if (effectsContainer) { // Effects container directly holds children sprites
        // Iterate backwards safely
        for (let i = effectsContainer.children.length - 1; i >= 0; i--) {
            const child = effectsContainer.children[i];
            if (child && (child as any).destroy) (child as any).destroy();
        }
        // PIXI might also have effectsContainer.removeChildren(0, effectsContainer.children.length);
        effectsContainer.removeChildren();
    }

    // Player sprite (if exists and managed by player)
    // createPlayer in Player.js handles its own sprite, but main.js might nullify player
    if (player && !player._destroyed) {
        player.sprite.destroy();
        // player = null; // main.js should manage nullifying player
    }
    // Demo player sprite
    if (demoPlayer && demoPlayer.sprite && !demoPlayer._destroyed) {
        demoPlayer.sprite.destroy();
        // demoPlayer = null; // main.js/attractMode.js should manage this
    }
}

// --- Core Gameplay Logic ---
export function playerHit() {
    if (!player || !player.isAlive || gameState.playerInvulnerableTime > 0) return;
    if (!GameConfig || !SoundManager || !Effects || !UI) {
        console.warn("playerHit: Missing critical dependencies."); return;
    }

    // Emit player hit event for visual effects system
    gameEvents.emit({
        type: 'player:hit',
        timestamp: Date.now(),
        source: 'gameLogic',
        data: {
            position: new Vector2(player.sprite.x, player.sprite.y),
            livesRemaining: gameState.lives - 1
        }
    });

    Effects.createExplosion(player.sprite.x, player.sprite.y);
    SoundManager.play('playerDeath');
    gameState.lives--;
    player.isAlive = false;
    gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
    gameState.humanRescueBonusDecayTimer = 0;
    if(UI.updateBonusDisplay) UI.updateBonusDisplay();


    if (gameState.lives <= 0) {
        gameState.currentGameState = 'GAME_OVER'; // Update global state
        if (UI && UI.showGameOverScreen) UI.showGameOverScreen();
    } else {
        gameState.playerInvulnerableTime = GameConfig.RESPAWN_INVULNERABILITY_TIME;
        if (player.sprite) player.sprite.visible = false; // Hide sprite

        // Respawn timer
        setTimeout(() => {
            if (gameState.currentGameState === 'GAME_OVER') return;
            if (player && player.sprite && GameConfig) {
                player.sprite.x = GameConfig.GAME_WIDTH / 2;
                player.sprite.y = GameConfig.GAME_HEIGHT / 2;
                player.dx = 0;
                player.dy = 0;
                player.sprite.visible = true;
            }
            if (player) player.isAlive = true;
            // playerInvulnerableTime is already set and will be counted down by main game loop
        }, 500);
    }
    if (UI && UI.updateUI) UI.updateUI();
}

export function isColliding(spriteA: PIXI.Sprite | PIXI.Graphics | PIXI.Container, spriteB: PIXI.Sprite | PIXI.Graphics | PIXI.Container, tolerance = 5) {
    if (!spriteA || !spriteB || (spriteA as any)._destroyed || (spriteB as any)._destroyed || !spriteA.visible || !spriteB.visible) return false;
    
    try {
        // Safely access sprite properties with additional error handling
        let centerAX, centerAY, centerBX, centerBY;
        
        try {
            centerAX = spriteA.x;
            centerAY = spriteA.y;
        } catch (error) {
            return false; // spriteA properties are inaccessible
        }
        
        try {
            centerBX = spriteB.x;
            centerBY = spriteB.y;
        } catch (error) {
            return false; // spriteB properties are inaccessible
        }
        
        // Check if position properties are valid numbers
        if (typeof centerAX !== 'number' || typeof centerAY !== 'number' || 
            typeof centerBX !== 'number' || typeof centerBY !== 'number' ||
            centerAX === null || centerAY === null || 
            centerBX === null || centerBY === null ||
            isNaN(centerAX) || isNaN(centerAY) || isNaN(centerBX) || isNaN(centerBY)) {
            return false;
        }
        
        const distance = Math.sqrt(
            Math.pow(centerAX - centerBX, 2) + Math.pow(centerAY - centerBY, 2)
        );
        
        // Debug logging for human rescue collisions (tolerance = 2)
        if (tolerance === 2) {
            console.log('[isColliding] Human rescue check:', {
                playerPos: {x: centerAX, y: centerAY},
                humanPos: {x: centerBX, y: centerBY},
                distance: distance.toFixed(2),
                tolerance: tolerance,
                spriteAWidth: spriteA.width,
                spriteBWidth: spriteB.width,
                result: distance <= tolerance
            });
        }
        
        // Use simple distance-based collision for now
        return distance <= tolerance;
        
    } catch (error) {
        // If any error occurs accessing sprite properties, return false
        console.warn('Collision detection error:', error);
        return false;
    }
}

export function startNextWave() {
    if (!GameConfig || !SoundManager || !Enemies || !Humans || !Obstacles) {
         console.warn("startNextWave: Missing critical dependencies."); return;
    }
    gameState.wave++;
    console.log(`Starting Wave: ${gameState.wave}`);
    SoundManager.play('waveStart');
    gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
    gameState.humanRescueBonusDecayTimer = 0;
    if (UI && UI.updateBonusDisplay) UI.updateBonusDisplay();

    // Clear existing non-player entities for the new wave (optional, depends on desired behavior)
    // Obstacles are typically per-wave. Enemies and projectiles are definitely per-wave.
    // Let's clear obstacles, specific projectiles, and enemies. Humans might persist or be reset.
    // The original code cleared obstacles.
    if (obstacles) {
        obstacles.forEach(o => { if (o.sprite && !o._destroyed) o.sprite.destroy(); });
        obstacles.length = 0;
    }
    // Enemy projectiles clear (player projectiles might be kept briefly or cleared too)
     if (enemyProjectiles) enemyProjectiles.length = 0;
     // if (enemyProjectilesContainer) enemyProjectilesContainer.removeChildren(); // Removed as enemyProjectilesContainer is not imported


    // Reset player position (if player exists)
    if (player && player.sprite && !player._destroyed) {
        player.sprite.x = GameConfig.GAME_WIDTH / 2;
        player.sprite.y = GameConfig.GAME_HEIGHT / 2;
        player.dx = 0;
        player.dy = 0;
    }

    let numGrunts = 0, numHulks = 0, numSpheroids = 0, numBrains = 0, numTanks = 0, numQuarks = 0;
    let numHumansToSpawn = 0, numElectrodes = 0;

    // Wave difficulty scaling logic from original script
    if (gameState.wave === 1) {
        numGrunts = (20 + Math.floor(Math.random() * 11));
        numHumansToSpawn = (5 + Math.floor(Math.random() * 6));
        numElectrodes = 2 + Math.floor(Math.random() * 3);
    } else if (gameState.wave >= 2 && gameState.wave <= 5) {
        numGrunts = 25 + gameState.wave * 3; numHulks = 1 + Math.floor((gameState.wave - 2) / 2);
        numSpheroids = 1 + Math.floor((gameState.wave - 2) / 2); numHumansToSpawn = Math.max(3, 7 - gameState.wave);
        numElectrodes = 3 + gameState.wave -1;
    } else if (gameState.wave >= 6 && gameState.wave <= 10) {
        numGrunts = 30 + gameState.wave * 2; numHulks = 2 + Math.floor((gameState.wave - 6) / 3);
        numSpheroids = 2 + Math.floor((gameState.wave - 6) / 3); numBrains = 1 + Math.floor((gameState.wave - 6) / 2);
        numTanks = 1 + Math.floor((gameState.wave - 6) / 3); numHumansToSpawn = Math.max(2, 5 - Math.floor((gameState.wave-6)/2) );
        numElectrodes = 5 + Math.floor((gameState.wave-6)/2);
    } else {
        numGrunts = 30 + gameState.wave * 2; numHulks = 2 + Math.floor(gameState.wave/5);
        numSpheroids = 2 + Math.floor(gameState.wave/5); numBrains = 2 + Math.floor(gameState.wave/4);
        numTanks = 2 + Math.floor(gameState.wave/4); numQuarks = 1 + Math.floor((gameState.wave-10)/3);
        numHumansToSpawn = Math.max(1, 4 - Math.floor(gameState.wave/5));
        numElectrodes = Math.min(10, 5 + Math.floor(gameState.wave/3));
    }
    // Temp: reduce enemy count for easier testing during refactor
    // numGrunts = Math.floor(numGrunts * 0.1); numHulks = Math.floor(numHulks * 0.2); numSpheroids = Math.floor(numSpheroids * 0.2);
    // numBrains = Math.floor(numBrains * 0.2); numTanks = Math.floor(numTanks * 0.2); numQuarks = Math.floor(numQuarks * 0.2);
    // numHumansToSpawn = Math.max(1, Math.floor(numHumansToSpawn * 0.5));


    for (let i = 0; i < numElectrodes; i++) {
        const elX = GameConfig.GAME_WIDTH * 0.2 + Math.random() * (GameConfig.GAME_WIDTH * 0.6);
        const elY = GameConfig.GAME_HEIGHT * 0.2 + Math.random() * (GameConfig.GAME_HEIGHT * 0.6);
        const elSize = 8 + Math.random() * 8;
        const colors = [0xFF0000, 0xFFFF00, 0x00FFFF, 0xFF00FF, 0x00FF00];
        if (Obstacles && Obstacles.createElectrode) Obstacles.createElectrode(elX, elY, elSize, elSize, colors[i % colors.length]);
    }
    for(let i=0;i<numGrunts;i++){ if (Enemies && Enemies.createGrunt) Enemies.createGrunt(Math.random()*GameConfig.GAME_WIDTH, Math.random()*GameConfig.GAME_HEIGHT);}
    for(let i=0;i<numHulks;i++){ if (Enemies && Enemies.createHulk) Enemies.createHulk(Math.random()*GameConfig.GAME_WIDTH,Math.random()*GameConfig.GAME_HEIGHT);}
    for(let i=0;i<numSpheroids;i++){ if (Enemies && Enemies.createSpheroid) Enemies.createSpheroid(Math.random()*GameConfig.GAME_WIDTH,Math.random()*GameConfig.GAME_HEIGHT);}
    for(let i=0;i<numBrains;i++){ if (Enemies && Enemies.createBrain) Enemies.createBrain(Math.random()*GameConfig.GAME_WIDTH,Math.random()*GameConfig.GAME_HEIGHT);}
    for(let i=0;i<numTanks;i++){ if (Enemies && Enemies.createTank) Enemies.createTank(Math.random()*GameConfig.GAME_WIDTH,Math.random()*GameConfig.GAME_HEIGHT);}
    for(let i=0;i<numQuarks;i++){ if (Enemies && Enemies.createQuark) Enemies.createQuark(Math.random()*GameConfig.GAME_WIDTH,Math.random()*GameConfig.GAME_HEIGHT);}

    console.log(`[GameLogic.startNextWave] About to spawn ${numHumansToSpawn} humans`);
    for (let i = 0; i < Math.max(1, numHumansToSpawn) ; i++) {
        console.log(`[GameLogic.startNextWave] Creating human ${i + 1}/${Math.max(1, numHumansToSpawn)}`);
        if (Humans && Humans.createHuman) {
            const x = Math.random() * (GameConfig.GAME_WIDTH - 20) + 10;
            const y = Math.random() * (GameConfig.GAME_HEIGHT - 20) + 10;
            console.log(`[GameLogic.startNextWave] Calling Humans.createHuman(${x}, ${y})`);
            Humans.createHuman(x, y);
        } else {
            console.error(`[GameLogic.startNextWave] Humans or Humans.createHuman is undefined!`, { Humans, createHuman: Humans?.createHuman });
        }
    }

    if (player) player.isAlive = true;
    gameState.playerInvulnerableTime = GameConfig.RESPAWN_INVULNERABILITY_TIME;
}

export function checkWaveCompletion() {
    if (gameState.currentGameState !== 'PLAYING' || !enemies) return;

    const activeEnemies = enemies.filter(e => !e.indestructible && e.sprite && !(e.sprite as any)._destroyed && e.type !== 'hulk');
    if (activeEnemies.length === 0) {
        console.log("Wave Complete!");
        gameState.currentGameState = 'WAVE_TRANSITION';

        // Emit wave completed event for visual effects system
        gameEvents.emit({
            type: 'wave:completed',
            timestamp: Date.now(),
            source: 'gameLogic',
            data: {
                wave: gameState.wave,
                score: gameState.score,
                centerPosition: new Vector2(GameConfig.GAME_WIDTH / 2, GameConfig.GAME_HEIGHT / 2)
            }
        });

        setTimeout(() => {
            if (gameState.currentGameState === 'GAME_OVER') return;
            gameState.currentGameState = 'PLAYING';
            startNextWave();
        }, 2000);
    }
}

export function checkForExtraLife() {
    if (gameState.currentGameState !== 'PLAYING' || !GameConfig || !SoundManager) return;
    if (gameState.score >= gameState.nextExtraLifeScore) {
        gameState.lives++;
        gameState.nextExtraLifeScore += GameConfig.EXTRA_LIFE_SCORE_INTERVAL;
        console.log(`Extra life awarded! Lives: ${gameState.lives}. Next at: ${gameState.nextExtraLifeScore}`);
        SoundManager.play('extraLife');
        if (UI && UI.updateUI) UI.updateUI();
    }
}

export function updateBonusDecay(delta: number) {
    if (gameState.currentGameState !== 'PLAYING' || !GameConfig) return;
    if (gameState.humanRescueBonusDecayTimer > 0) {
        gameState.humanRescueBonusDecayTimer -= delta;
        if (gameState.humanRescueBonusDecayTimer <= 0) {
            gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
            gameState.humanRescueBonusDecayTimer = 0;
            console.log("Human rescue bonus decayed.");
            if (UI && UI.updateBonusDisplay) UI.updateBonusDisplay();
        }
    }
}

// --- Collision Detection ---
export function checkCollisions() {
    if (typeof gameState.currentGameState === 'undefined' || (gameState.currentGameState !== 'PLAYING' && gameState.currentGameState !== 'DEMO_PLAY')) {
        return;
    }
    if (!GameConfig || !SoundManager || !Effects || !UI ||
        !playerProjectiles || !enemyProjectiles || !enemies || !humansAndProgs || !obstacles) {
        // console.warn("checkCollisions: Missing critical dependencies.");
        return;
    }

    const currentPlayer = gameState.currentGameState === 'DEMO_PLAY' ? demoPlayer : player;
    if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) {
         // If no current player (e.g. during GAME_OVER transition or if demo player dies), skip player-related collisions
    }

    // Player Projectile vs Enemy
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const p = playerProjectiles[i];
        if (!p || !p.sprite || (p.sprite as any)._destroyed) continue;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!enemy || !enemy.sprite || (enemy.sprite as any)._destroyed || enemy.indestructible) continue;

            if (isColliding(p.sprite, enemy.sprite, 5)) {
                if (p.sprite && !(p.sprite as any)._destroyed) (p.sprite as any).destroy();
                playerProjectiles.splice(i, 1);

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

                    // Emit enemy destroyed event for visual effects system
                    gameEvents.emit({
                        type: 'enemy:destroyed',
                        timestamp: Date.now(),
                        source: 'gameLogic',
                        data: {
                            position: new Vector2(enemy.sprite.x, enemy.sprite.y),
                            enemyType: enemy.type,
                            points: enemy.points || 0
                        }
                    });

                    Effects.createExplosion(enemy.sprite.x, enemy.sprite.y, explosionColor);
                    SoundManager.play(soundToPlayKey);
                    if (enemy.sprite && !(enemy.sprite as any)._destroyed) (enemy.sprite as any).destroy();
                    enemies.splice(j, 1);

                    if (gameState.currentGameState === 'PLAYING' && (!p.isDemoProjectile)) {
                        gameState.score += enemy.points || 0;
                        if(UI.updateScoreDisplay) UI.updateScoreDisplay();
                        checkForExtraLife();
                    }
                }
                break;
            }
        }
        if (!p || (p.sprite as any)._destroyed) return; // Projectile might have been destroyed by hitting an enemy

        // Player Projectile vs Human-Converted Prog (from humansAndProgs list)
        for (let k = humansAndProgs.length - 1; k >= 0; k--) {
            const entity = humansAndProgs[k];
            if (entity.type === 'prog' && entity.sprite && !(entity.sprite as any)._destroyed) {
                if (isColliding(p.sprite, entity.sprite, 5)) {
                    if (p.sprite && !(p.sprite as any)._destroyed) (p.sprite as any).destroy();
                    playerProjectiles.splice(i, 1);

                    Effects.createExplosion(entity.sprite.x, entity.sprite.y, 0xFF55FF);
                    SoundManager.play('progDestroy');
                    if (entity.sprite && !(entity.sprite as any)._destroyed) (entity.sprite as any).destroy();
                    humansAndProgs.splice(k, 1);

                    if (gameState.currentGameState === 'PLAYING' && (!p.isDemoProjectile)) {
                        gameState.score += entity.points || 0;
                       if(UI.updateScoreDisplay) UI.updateScoreDisplay();
                        checkForExtraLife();
                    }
                    break;
                }
            }
        }
    }

    if (currentPlayer && currentPlayer.isAlive && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) {
        const invulnerable = gameState.currentGameState === 'PLAYING' && gameState.playerInvulnerableTime > 0;

        // Enemy Projectile vs Player
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const p = enemyProjectiles[i];
            if (!p || !p.sprite || (p.sprite as any)._destroyed) continue;
            if (!invulnerable && isColliding(p.sprite, currentPlayer.sprite, 5)) {
                if (p.sprite && !(p.sprite as any)._destroyed) (p.sprite as any).destroy();
                enemyProjectiles.splice(i,1);
                if (gameState.currentGameState === 'PLAYING') playerHit();
                // Demo player hit logic would be handled by attractMode.js if it has its own collision check
                break;
            }
        }

        // Player vs Enemy
        if (!invulnerable) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                if (!enemy || !enemy.sprite || (enemy.sprite as any)._destroyed) continue;
                if (isColliding(currentPlayer.sprite, enemy.sprite, 8)) {
                    if (gameState.currentGameState === 'PLAYING') playerHit();
                    break;
                }
            }
            // Player vs Human-Converted Prog
            for (let i = humansAndProgs.length - 1; i >= 0; i--) {
                const entity = humansAndProgs[i];
                if (entity.type === 'prog' && entity.sprite && !(entity.sprite as any)._destroyed) {
                    if (isColliding(currentPlayer.sprite, entity.sprite, 8)) {
                       if (gameState.currentGameState === 'PLAYING') playerHit();
                       break;
                    }
                }
            }
        }

        // Player vs Obstacle (Electrodes)
        if (!invulnerable) {
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obstacle = obstacles[i];
                if (!obstacle || !obstacle.sprite || (obstacle.sprite as any)._destroyed) continue;
                if (obstacle.type === 'electrode' && isColliding(currentPlayer.sprite, obstacle.sprite, 6)) {
                    if (gameState.currentGameState === 'PLAYING') playerHit();
                    break;
                }
            }
        }

        // Player vs Human (Rescue) - TEMPORARILY DISABLED FOR DEBUGGING
        for (let i = humansAndProgs.length - 1; i >= 0; i--) {
            const humanEntity = humansAndProgs[i];
             if (humanEntity.type === 'human' && !humanEntity.isRescued && humanEntity.sprite && !(humanEntity.sprite as any)._destroyed) {
                // Use reasonable collision radius - sprites touching or very close
                if (isColliding(currentPlayer.sprite, humanEntity.sprite, 18)) {
                    // Debug the collision
                    const distance = Math.sqrt(
                        Math.pow(currentPlayer.sprite.x - humanEntity.sprite.x, 2) +
                        Math.pow(currentPlayer.sprite.y - humanEntity.sprite.y, 2)
                    );
                    console.log('[GameLogic.checkCollisions] Human collision detected:', {
                        playerPos: {x: currentPlayer.sprite.x, y: currentPlayer.sprite.y},
                        humanPos: {x: humanEntity.sprite.x, y: humanEntity.sprite.y},
                        distance: distance.toFixed(2)
                    });
                    
                    // Mark as rescued but don't destroy sprite here - let humans.js handle it
                    humanEntity.isRescued = true;
                    console.log('[GameLogic.checkCollisions] Human marked as rescued, letting humans.js handle cleanup');
                    
                    // Emit human rescued event for visual effects system
                    gameEvents.emit({
                        type: 'human:rescued',
                        timestamp: Date.now(),
                        source: 'gameLogic',
                        data: {
                            position: new Vector2(humanEntity.sprite.x, humanEntity.sprite.y),
                            bonus: gameState.currentHumanRescueBonus
                        }
                    });
                    
                    if (gameState.currentGameState === 'PLAYING') {
                        gameState.score += gameState.currentHumanRescueBonus;
                        if(UI.updateScoreDisplay) UI.updateScoreDisplay();
                        checkForExtraLife();
                        SoundManager.play('humanRescue');
                        if (gameState.currentHumanRescueBonus < GameConfig.MAX_HUMAN_RESCUE_BONUS) {
                            gameState.currentHumanRescueBonus += GameConfig.HUMAN_RESCUE_BONUS_INCREMENT;
                        }
                        gameState.humanRescueBonusDecayTimer = GameConfig.HUMAN_RESCUE_BONUS_DECAY_DURATION;
                        if(UI.updateBonusDisplay) UI.updateBonusDisplay();
                    }
                    // No specific demo player rescue score/sound in original, handled by demo logic if needed
                }
            }
        }
    } // End of if(currentPlayer && currentPlayer.isAlive)

    // --- Non-Player specific collisions ---
    // Enemy Projectile vs Human (Tank Shells only in original)
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        if (!p || !p.sprite || (p.sprite as any)._destroyed || p.type !== 'tank_shell') continue;
        for (let j = humansAndProgs.length - 1; j >=0; j--) {
            const humanEntity = humansAndProgs[j];
            if (humanEntity.type === 'human' && humanEntity.sprite && !(humanEntity.sprite as any)._destroyed) {
                if (isColliding(p.sprite, humanEntity.sprite, 5)) {
                    if (p.sprite && !(p.sprite as any)._destroyed) (p.sprite as any).destroy();
                    enemyProjectiles.splice(i,1);

                    Effects.createExplosion(humanEntity.sprite.x, humanEntity.sprite.y, 0xCCCCCC);
                    SoundManager.play('humanDeathByEnemy');
                    if (humanEntity.sprite && !(humanEntity.sprite as any)._destroyed) (humanEntity.sprite as any).destroy();
                    humansAndProgs.splice(j, 1);

                    if (gameState.currentGameState === 'PLAYING') {
                        gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
                        gameState.humanRescueBonusDecayTimer = 0;
                        if(UI.updateBonusDisplay) UI.updateBonusDisplay();
                    }
                    break;
                }
            }
        }
    }

    // Enemy vs Human (Hulk killing human)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy || !enemy.sprite || (enemy.sprite as any)._destroyed || enemy.type !== 'hulk') continue;

        for (let j = humansAndProgs.length - 1; j >= 0; j--) {
            const humanEntity = humansAndProgs[j];
            if (humanEntity.type === 'human' && !humanEntity.isRescued && humanEntity.sprite && !(humanEntity.sprite as any)._destroyed) {
                if (isColliding(enemy.sprite, humanEntity.sprite, 10)) {
                    Effects.createExplosion(humanEntity.sprite.x, humanEntity.sprite.y, 0xCCCCCC);
                    SoundManager.play('humanDeathByEnemy');
                    if (humanEntity.sprite && !(humanEntity.sprite as any)._destroyed) (humanEntity.sprite as any).destroy();
                    humansAndProgs.splice(j, 1);
                    if (gameState.currentGameState === 'PLAYING') {
                        gameState.currentHumanRescueBonus = GameConfig.INITIAL_HUMAN_RESCUE_BONUS;
                        gameState.humanRescueBonusDecayTimer = 0;
                       if(UI.updateBonusDisplay) UI.updateBonusDisplay();
                    }
                    // No break here, Hulk might trample multiple humans
                }
            }
        }
    }
}
