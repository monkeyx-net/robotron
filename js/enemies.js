(function() {
    // Assumes window.PIXI, window.GameConfig, window.SoundManager,
    // window.enemiesContainer, window.enemies (array),
    // window.gameState, window.player, window.demoPlayer,
    // window.gruntTexture, window.Projectiles, window.Humans (for brain logic)
    // window.humansAndProgs (for brain targeting humans)

    // Helper function to create animated sprites (used by Brain)
    function createAnimatedSprite(frames, animationSpeed = 0.1) {
        if (!window.PIXI) { console.warn("Enemies.createAnimatedSprite: Missing PIXI."); return null; }
        const container = new window.PIXI.Container();
        container.frames = frames;
        container.currentFrame = 0;
        container.animationTimer = 0;
        container.animationSpeed = animationSpeed;

        const initialFrame = new window.PIXI.Graphics();
        frames[0](initialFrame);
        container.addChild(initialFrame);
        container.currentGraphics = initialFrame;

        return container;
    }

    // Update animation frame (used by Brain)
    function updateSpriteAnimation(spriteInstance, delta) {
        if (!spriteInstance || !spriteInstance.frames || !spriteInstance.currentGraphics) return;

        spriteInstance.animationTimer += delta;
        if (spriteInstance.animationTimer >= spriteInstance.animationSpeed) {
            spriteInstance.animationTimer = 0;
            spriteInstance.currentFrame = (spriteInstance.currentFrame + 1) % spriteInstance.frames.length;

            spriteInstance.removeChild(spriteInstance.currentGraphics); // Remove old frame
            if (spriteInstance.currentGraphics.destroy) spriteInstance.currentGraphics.destroy(); // Destroy old graphics object

            const newFrame = new window.PIXI.Graphics();
            spriteInstance.frames[spriteInstance.currentFrame](newFrame);
            spriteInstance.addChild(newFrame);
            spriteInstance.currentGraphics = newFrame;
        }
    }

    function createGrunt(x, y) {
        if (!window.PIXI || !window.gruntTexture || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createGrunt: Missing dependencies."); return null;
        }
        const gruntSprite = new window.PIXI.Sprite(window.gruntTexture);
        gruntSprite.anchor.set(0.5);
        gruntSprite.x = x;
        gruntSprite.y = y;
        window.enemiesContainer.addChild(gruntSprite);

        const grunt = {
            sprite: gruntSprite,
            type: 'grunt',
            health: 1,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.GRUNT : 100,
            dx: 0,
            dy: 0,
            speed: window.GameConfig.GRUNT_SPEED || 0.6,
            lastAngle: Math.random() * Math.PI * 2
        };
        window.enemies.push(grunt);
        return grunt;
    }

    function createHulk(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createHulk: Missing dependencies."); return null;
        }
        const hulkSprite = new window.PIXI.Graphics();
        hulkSprite.beginFill(0x00FF00); hulkSprite.drawRect(-8, -10, 16, 20); hulkSprite.endFill();
        hulkSprite.x = x; hulkSprite.y = y;
        window.enemiesContainer.addChild(hulkSprite);
        const hulk = {
            sprite: hulkSprite, type: 'hulk', indestructible: true, points: 0,
            dx: (Math.random() - 0.5) * (window.GameConfig.HULK_SPEED || 0.3) * 2,
            dy: (Math.random() - 0.5) * (window.GameConfig.HULK_SPEED || 0.3) * 2,
            wanderTimer: Math.random() * 120 + 60, isCharging: false, chargeTarget: null
        };
        window.enemies.push(hulk);
        return hulk;
    }

    function createSpheroid(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createSpheroid: Missing dependencies."); return null;
        }
        const spheroidSprite = new window.PIXI.Graphics();
        spheroidSprite.beginFill(0xFF0000); spheroidSprite.drawCircle(0, 0, 6); spheroidSprite.endFill();
        spheroidSprite.x = x; spheroidSprite.y = y;
        window.enemiesContainer.addChild(spheroidSprite);
        const spheroid = {
            sprite: spheroidSprite, type: 'spheroid', health: 2,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.SPHEROID : 1000,
            dx: (Math.random() - 0.5) * (window.GameConfig.SPHEROID_SPEED || 0.7) * 2,
            dy: (Math.random() - 0.5) * (window.GameConfig.SPHEROID_SPEED || 0.7) * 2,
            pulseTimer: 0, pulseRate: 0.05,
            spawnEnforcerTimer: window.GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300,
            enforcersSpawned: 0, maxEnforcersToSpawn: 1
        };
        window.enemies.push(spheroid);
        return spheroid;
    }

    function createEnforcer(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createEnforcer: Missing dependencies."); return null;
        }
        const enforcerSprite = new window.PIXI.Graphics();
        enforcerSprite.beginFill(0x0000FF);
        enforcerSprite.moveTo(0, -6); enforcerSprite.lineTo(4, 0);
        enforcerSprite.lineTo(0, 6); enforcerSprite.lineTo(-4, 0);
        enforcerSprite.closePath(); enforcerSprite.endFill();
        enforcerSprite.x = x; enforcerSprite.y = y;
        window.enemiesContainer.addChild(enforcerSprite);
        const enforcer = {
            sprite: enforcerSprite, type: 'enforcer', health: 2,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.ENFORCER : 150,
            shootTimer: (window.GameConfig.ENFORCER_SHOOT_DELAY || 120) / 2 + Math.random() * (window.GameConfig.ENFORCER_SHOOT_DELAY || 120) / 2
        };
        window.enemies.push(enforcer);
        return enforcer;
    }

    function createBrain(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createBrain: Missing dependencies."); return null;
        }
        const brainFrames = [
            (g) => { /* Frame 1 */ g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-4, -5).lineTo(-2, -7).moveTo(4, -5).lineTo(2, -7); },
            (g) => { /* Frame 2 */ g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-3, -6).lineTo(-3, -8).moveTo(3, -6).lineTo(3, -8); }
        ];
        const brainSprite = createAnimatedSprite(brainFrames, 0.2);
        if (!brainSprite) return null; // createAnimatedSprite failed
        brainSprite.x = x; brainSprite.y = y;
        window.enemiesContainer.addChild(brainSprite);
        const brain = {
            sprite: brainSprite, type: 'brain', health: 3,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.BRAIN : 500,
            shootTimer: (window.GameConfig.BRAIN_SHOOT_DELAY || 150) / 2 + Math.random() * (window.GameConfig.BRAIN_SHOOT_DELAY || 150) / 2,
            reprogramTarget: null,
            reprogramTimer: window.GameConfig.BRAIN_REPROGRAM_DURATION || 120,
            reprogramProgress: 0
        };
        window.enemies.push(brain);
        return brain;
    }

    function createTank(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createTank: Missing dependencies."); return null;
        }
        const tankSprite = new window.PIXI.Graphics();
        tankSprite.beginFill(0x888888).drawRect(-10, -7, 20, 14).endFill()
                  .beginFill(0x666666).drawRect(-3, -10, 6, 6).drawRect(-1, -15, 2, 5).endFill();
        tankSprite.x = x; tankSprite.y = y;
        window.enemiesContainer.addChild(tankSprite);
        const tank = {
            sprite: tankSprite, type: 'tank', health: 4,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.TANK : 300,
            shootTimer: (window.GameConfig.TANK_SHOOT_DELAY || 180) / 2 + Math.random() * (window.GameConfig.TANK_SHOOT_DELAY || 180) / 2,
            target: null
        };
        window.enemies.push(tank);
        return tank;
    }

    // This is the distinct createProg that adds to the 'enemies' array.
    function createProg(x, y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createProg: Missing dependencies."); return null;
        }
        const progSprite = new window.PIXI.Graphics();
        progSprite.lineStyle(1, 0x4B0082);
        progSprite.beginFill(0x8A2BE2);
        progSprite.drawRect(-6, -6, 12, 12);
        progSprite.endFill();
        progSprite.x = x; progSprite.y = y;
        window.enemiesContainer.addChild(progSprite);
        const prog = {
            type: 'prog_enemy', // Differentiate from human-converted progs if necessary
            health: 1,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.PROG : 100,
            sprite: progSprite,
            dx: 0, dy: 0,
            speed: window.GameConfig.PROG_SPEED || 1.3,
            lastAngle: Math.random() * Math.PI * 2,
            turnTimer: 0,
            turnDelay: 60 + Math.random() * 60,
        };
        window.enemies.push(prog);
        return prog;
    }

    function createQuark(x,y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createQuark: Missing dependencies."); return null;
        }
        const quarkSprite = new window.PIXI.Graphics();
        quarkSprite.beginFill(0xFFFFFF); quarkSprite.drawRect(-4, -4, 8, 8); quarkSprite.endFill();
        quarkSprite.x = x; quarkSprite.y = y;
        window.enemiesContainer.addChild(quarkSprite);
        const quark = {
            sprite: quarkSprite, type: 'quark', health: 2,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.QUARK : 1000,
            dx: (Math.random() - 0.5) * (window.GameConfig.QUARK_SPEED || 1.2) * 2,
            dy: (Math.random() - 0.5) * (window.GameConfig.QUARK_SPEED || 1.2) * 2,
            spawnSubQuarkTimer: window.GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180,
            subQuarksSpawned: 0, maxSubQuarksToSpawn: window.GameConfig.MAX_SUB_QUARKS_PER_QUARK || 3
        };
        window.enemies.push(quark);
        return quark;
    }

    function createSubQuark(x,y) {
        if (!window.PIXI || !window.enemiesContainer || !window.enemies || !window.GameConfig) {
            console.warn("Enemies.createSubQuark: Missing dependencies."); return null;
        }
        const subQuarkSprite = new window.PIXI.Graphics();
        subQuarkSprite.beginFill(0xEEEEEE); subQuarkSprite.drawRect(-2, -2, 4, 4); subQuarkSprite.endFill();
        subQuarkSprite.x = x; subQuarkSprite.y = y;
        window.enemiesContainer.addChild(subQuarkSprite);
        const subQuark = {
            sprite: subQuarkSprite, type: 'sub_quark', health: 1,
            points: (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.SUB_QUARK : 25, // Original was 25
            dx: (Math.random() - 0.5) * (window.GameConfig.SUB_QUARK_SPEED || 1.5) * 2,
            dy: (Math.random() - 0.5) * (window.GameConfig.SUB_QUARK_SPEED || 1.5) * 2,
            lifeTimer: 180
        };
        window.enemies.push(subQuark);
        return subQuark;
    }

    function updateEnemies(delta) {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.enemies || !window.GameConfig || !window.PIXI || !window.Projectiles || !window.Humans || !window.humansAndProgs) {
            // console.warn("Enemies.updateEnemies: Missing dependencies.");
            return;
        }

        const currentPlayer = window.gameState === 'DEMO_PLAY' ? window.demoPlayer : window.player;
        if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) {
            // If no player, enemies might wander or have default behavior, but targeting is off.
            // Most enemies require a player target.
        }

        for (let i = window.enemies.length - 1; i >= 0; i--) {
            const enemy = window.enemies[i];
            if (!enemy || !enemy.sprite || enemy.sprite._destroyed) {
                window.enemies.splice(i, 1);
                continue;
            }

            // Common: Update animation for animated sprites
            if (enemy.sprite.frames) { // Check if it's an animated sprite container
                 updateSpriteAnimation(enemy.sprite, delta);
            }

            // Type-specific logic
            if (enemy.type === 'grunt') {
                if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) continue;
                const targetAngle = Math.atan2(currentPlayer.sprite.y - enemy.sprite.y, currentPlayer.sprite.x - enemy.sprite.x);
                let angleDiff = targetAngle - enemy.lastAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                enemy.lastAngle += (window.GameConfig.GRUNT_TURN_RATE || 0.08) * angleDiff; // Use angleDiff to turn correctly

                const idealDx = Math.cos(enemy.lastAngle) * enemy.speed;
                const idealDy = Math.sin(enemy.lastAngle) * enemy.speed;

                enemy.dx += (idealDx - enemy.dx) * (window.GameConfig.GRUNT_ACCELERATION || 0.03);
                enemy.dy += (idealDy - enemy.dy) * (window.GameConfig.GRUNT_ACCELERATION || 0.03);

                const distToPlayer = Math.hypot(currentPlayer.sprite.x - enemy.sprite.x, currentPlayer.sprite.y - enemy.sprite.y);
                const speedMultiplier = Math.max(0.5, Math.min(1, 1 - (distToPlayer / 200))); // Range 0.5 to 1
                const currentMaxSpeed = (window.GameConfig.GRUNT_SPEED || 0.6) + ((window.GameConfig.GRUNT_MAX_SPEED || 1.0) - (window.GameConfig.GRUNT_SPEED || 0.6)) * speedMultiplier;

                const currentSpeed = Math.hypot(enemy.dx, enemy.dy);
                if (currentSpeed > currentMaxSpeed) {
                    enemy.dx = (enemy.dx / currentSpeed) * currentMaxSpeed;
                    enemy.dy = (enemy.dy / currentSpeed) * currentMaxSpeed;
                }

                enemy.sprite.x += enemy.dx * delta;
                enemy.sprite.y += enemy.dy * delta;

                // Boundary checks simplified
                if (enemy.sprite.x < 6 || enemy.sprite.x > window.GameConfig.GAME_WIDTH - 6) { enemy.sprite.x = Math.max(6, Math.min(window.GameConfig.GAME_WIDTH - 6, enemy.sprite.x)); enemy.dx *= -0.5; enemy.lastAngle += Math.PI + (Math.random()-0.5)*0.2; }
                if (enemy.sprite.y < 6 || enemy.sprite.y > window.GameConfig.GAME_HEIGHT - 6) { enemy.sprite.y = Math.max(6, Math.min(window.GameConfig.GAME_HEIGHT - 6, enemy.sprite.y)); enemy.dy *= -0.5; enemy.lastAngle += Math.PI + (Math.random()-0.5)*0.2; }

            } else if (enemy.type === 'hulk') {
                enemy.wanderTimer -= delta;
                if (enemy.isCharging && enemy.chargeTarget && enemy.chargeTarget.sprite && !enemy.chargeTarget.sprite._destroyed) {
                    const angle = Math.atan2(enemy.chargeTarget.sprite.y - enemy.sprite.y, enemy.chargeTarget.sprite.x - enemy.sprite.x);
                    enemy.sprite.x += Math.cos(angle) * (window.GameConfig.HULK_CHARGE_SPEED || 1.2) * delta;
                    enemy.sprite.y += Math.sin(angle) * (window.GameConfig.HULK_CHARGE_SPEED || 1.2) * delta;
                    // Basic collision check for charge end (actual collision handled in checkCollisions)
                    const distToTarget = Math.hypot(enemy.sprite.x - enemy.chargeTarget.sprite.x, enemy.sprite.y - enemy.chargeTarget.sprite.y);
                    if (distToTarget < 10 || enemy.wanderTimer <= 0) { // End charge if close or timer up
                        enemy.isCharging = false; enemy.chargeTarget = null;
                        enemy.wanderTimer = Math.random() * 120 + 60; // Reset wander
                    }
                } else {
                    enemy.isCharging = false;
                    if (enemy.wanderTimer <= 0) {
                        const targetableHumans = window.humansAndProgs.filter(h => h.type === 'human' && !h.isRescued && h.sprite && !h.sprite._destroyed);
                        if (targetableHumans.length > 0 && Math.random() < 0.3) {
                            enemy.isCharging = true;
                            enemy.chargeTarget = targetableHumans[Math.floor(Math.random() * targetableHumans.length)];
                            enemy.wanderTimer = Math.random() * 60 + 30; // Shorter timer for charge duration
                        } else {
                            enemy.dx = (Math.random() - 0.5) * (window.GameConfig.HULK_SPEED || 0.3) * 2;
                            enemy.dy = (Math.random() - 0.5) * (window.GameConfig.HULK_SPEED || 0.3) * 2;
                            enemy.wanderTimer = Math.random() * 120 + 60;
                        }
                    }
                    enemy.sprite.x += enemy.dx * delta; enemy.sprite.y += enemy.dy * delta;
                    if (enemy.sprite.x < 8 || enemy.sprite.x > window.GameConfig.GAME_WIDTH - 8) {enemy.dx *= -1; enemy.sprite.x = Math.max(8, Math.min(window.GameConfig.GAME_WIDTH - 8, enemy.sprite.x));}
                    if (enemy.sprite.y < 10 || enemy.sprite.y > window.GameConfig.GAME_HEIGHT - 10) {enemy.dy *= -1; enemy.sprite.y = Math.max(10, Math.min(window.GameConfig.GAME_HEIGHT - 10, enemy.sprite.y));}
                }
            } else if (enemy.type === 'spheroid') {
                enemy.sprite.x += enemy.dx * delta; enemy.sprite.y += enemy.dy * delta;
                if (enemy.sprite.x < 6 || enemy.sprite.x > window.GameConfig.GAME_WIDTH - 6) {enemy.dx *= -1; enemy.sprite.x = Math.max(6, Math.min(window.GameConfig.GAME_WIDTH - 6, enemy.sprite.x));}
                if (enemy.sprite.y < 6 || enemy.sprite.y > window.GameConfig.GAME_HEIGHT - 6) {enemy.dy *= -1; enemy.sprite.y = Math.max(6, Math.min(window.GameConfig.GAME_HEIGHT - 6, enemy.sprite.y));}
                enemy.pulseTimer += enemy.pulseRate * delta;
                enemy.sprite.alpha = 0.75 + Math.sin(enemy.pulseTimer) * 0.25;
                if (enemy.enforcersSpawned < enemy.maxEnforcersToSpawn) {
                    enemy.spawnEnforcerTimer -= delta;
                    if (enemy.spawnEnforcerTimer <= 0) {
                        if (window.Enemies && window.Enemies.createEnforcer) window.Enemies.createEnforcer(enemy.sprite.x, enemy.sprite.y);
                        enemy.enforcersSpawned++;
                        enemy.spawnEnforcerTimer = window.GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300;
                    }
                }
            } else if (enemy.type === 'enforcer') {
                if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) continue;
                const angle = Math.atan2(currentPlayer.sprite.y - enemy.sprite.y, currentPlayer.sprite.x - enemy.sprite.x);
                enemy.sprite.x += Math.cos(angle) * (window.GameConfig.ENFORCER_SPEED || 0.8) * delta;
                enemy.sprite.y += Math.sin(angle) * (window.GameConfig.ENFORCER_SPEED || 0.8) * delta;
                enemy.shootTimer -= delta;
                if (enemy.shootTimer <= 0 && currentPlayer.isAlive) {
                    if (window.Projectiles && window.Projectiles.createEnforcerProjectile) {
                        window.Projectiles.createEnforcerProjectile(enemy.sprite.x, enemy.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
                    }
                    enemy.shootTimer = window.GameConfig.ENFORCER_SHOOT_DELAY || 120;
                }
            } else if (enemy.type === 'brain') {
                let targetX = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.x : enemy.sprite.x;
                let targetY = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.y : enemy.sprite.y;
                let closestHumanDist = Infinity;

                const targetableHumans = window.humansAndProgs.filter(h => h.type === 'human' && !h.isRescued && h.sprite && !h.sprite._destroyed);
                enemy.reprogramTarget = null; // Reset target each frame

                if (targetableHumans.length > 0) {
                    targetableHumans.forEach(human => {
                        const dist = Math.hypot(human.sprite.x - enemy.sprite.x, human.sprite.y - enemy.sprite.y);
                        if (dist < closestHumanDist) {
                            closestHumanDist = dist;
                            targetX = human.sprite.x; targetY = human.sprite.y;
                            enemy.reprogramTarget = human; // Found a human to target
                        }
                    });

                    if (enemy.reprogramTarget && closestHumanDist < (window.GameConfig.BRAIN_REPROGRAM_RANGE || 20)) {
                        enemy.reprogramTimer -= delta;
                        enemy.reprogramProgress += delta;

                        // Visual feedback on human
                        const progressRatio = Math.min(1, enemy.reprogramProgress / (window.GameConfig.BRAIN_REPROGRAM_DURATION || 120));
                        enemy.reprogramTarget.sprite.tint = PIXI.utils.rgb2hex([1, 1 - progressRatio, 0]); // Yellow to Red tint

                        if (enemy.reprogramTimer <= 0) {
                            if (window.Humans && window.Humans.convertToProg) window.Humans.convertToProg(enemy.reprogramTarget);
                            enemy.reprogramTarget = null; // Clear target
                            enemy.reprogramTimer = window.GameConfig.BRAIN_REPROGRAM_DURATION || 120;
                            enemy.reprogramProgress = 0;
                        }
                    } else { // No valid human target in range or no humans left
                        enemy.reprogramTimer = window.GameConfig.BRAIN_REPROGRAM_DURATION || 120; // Reset timer if target lost/out of range
                        enemy.reprogramProgress = 0;
                        if (enemy.reprogramTarget) enemy.reprogramTarget.sprite.tint = 0xFFFFFF; // Reset tint if target lost
                        enemy.reprogramTarget = null;
                        // Fallback to targeting player if no human is being reprogrammed
                        targetX = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.x : enemy.sprite.x;
                        targetY = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.y : enemy.sprite.y;
                    }
                } else { // No humans available, target player
                     targetX = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.x : enemy.sprite.x;
                     targetY = (currentPlayer && currentPlayer.sprite && !currentPlayer.sprite._destroyed) ? currentPlayer.sprite.y : enemy.sprite.y;
                }

                const angleToTarget = Math.atan2(targetY - enemy.sprite.y, targetX - enemy.sprite.x);
                enemy.sprite.x += Math.cos(angleToTarget) * (window.GameConfig.BRAIN_SPEED || 0.6) * delta;
                enemy.sprite.y += Math.sin(angleToTarget) * (window.GameConfig.BRAIN_SPEED || 0.6) * delta;

                enemy.shootTimer -= delta;
                if (enemy.shootTimer <= 0 && currentPlayer && currentPlayer.isAlive && currentPlayer.sprite && !currentPlayer.sprite._destroyed) {
                     if (window.Projectiles && window.Projectiles.createBrainProjectile) {
                        window.Projectiles.createBrainProjectile(enemy.sprite.x, enemy.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
                    }
                    enemy.shootTimer = window.GameConfig.BRAIN_SHOOT_DELAY || 150;
                }
            } else if (enemy.type === 'tank') {
                if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) continue;
                const angle = Math.atan2(currentPlayer.sprite.y - enemy.sprite.y, currentPlayer.sprite.x - enemy.sprite.x);
                enemy.sprite.x += Math.cos(angle) * (window.GameConfig.TANK_SPEED || 0.4) * delta;
                enemy.sprite.y += Math.sin(angle) * (window.GameConfig.TANK_SPEED || 0.4) * delta;
                enemy.shootTimer -= delta;
                if (enemy.shootTimer <= 0 && currentPlayer.isAlive) {
                     if (window.Projectiles && window.Projectiles.createTankShell) {
                        window.Projectiles.createTankShell(enemy.sprite.x, enemy.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
                    }
                    enemy.shootTimer = window.GameConfig.TANK_SHOOT_DELAY || 180;
                }
            } else if (enemy.type === 'prog_enemy') { // From the distinct createProg
                 if (!currentPlayer || !currentPlayer.sprite || currentPlayer.sprite._destroyed) continue;
                // Simple chase player, can be made more complex like human-converted progs if needed
                const angle = Math.atan2(currentPlayer.sprite.y - enemy.sprite.y, currentPlayer.sprite.x - enemy.sprite.x);
                enemy.sprite.x += Math.cos(angle) * enemy.speed * delta;
                enemy.sprite.y += Math.sin(angle) * enemy.speed * delta;
                // Boundary check
                enemy.sprite.x = Math.max(6, Math.min(window.GameConfig.GAME_WIDTH - 6, enemy.sprite.x));
                enemy.sprite.y = Math.max(6, Math.min(window.GameConfig.GAME_HEIGHT - 6, enemy.sprite.y));
            } else if (enemy.type === 'quark') {
                enemy.sprite.x += enemy.dx * delta; enemy.sprite.y += enemy.dy * delta;
                if (enemy.sprite.x < 4 || enemy.sprite.x > window.GameConfig.GAME_WIDTH - 4) {enemy.dx *= -1; enemy.sprite.x = Math.max(4, Math.min(window.GameConfig.GAME_WIDTH - 4, enemy.sprite.x));}
                if (enemy.sprite.y < 4 || enemy.sprite.y > window.GameConfig.GAME_HEIGHT - 4) {enemy.dy *= -1; enemy.sprite.y = Math.max(4, Math.min(window.GameConfig.GAME_HEIGHT - 4, enemy.sprite.y));}
                if (enemy.subQuarksSpawned < enemy.maxSubQuarksToSpawn) {
                    enemy.spawnSubQuarkTimer -= delta;
                    if (enemy.spawnSubQuarkTimer <= 0) {
                        if (window.Enemies && window.Enemies.createSubQuark) window.Enemies.createSubQuark(enemy.sprite.x, enemy.sprite.y);
                        enemy.subQuarksSpawned++;
                        enemy.spawnSubQuarkTimer = window.GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180;
                    }
                }
            } else if (enemy.type === 'sub_quark') {
                enemy.sprite.x += enemy.dx * delta; enemy.sprite.y += enemy.dy * delta;
                enemy.lifeTimer -= delta;
                if (enemy.lifeTimer <=0 || enemy.sprite.x < -2 || enemy.sprite.x > window.GameConfig.GAME_WIDTH + 2 || enemy.sprite.y < -2 || enemy.sprite.y > window.GameConfig.GAME_HEIGHT + 2) {
                    if(enemy.sprite && !enemy.sprite._destroyed) enemy.sprite.destroy();
                    window.enemies.splice(i,1);
                }
            }
        }
    }

    window.Enemies = {
        createGrunt, createHulk, createSpheroid, createEnforcer, createBrain, createTank, createQuark, createSubQuark,
        createProg, // The distinct one for 'enemies' array
        updateEnemies,
        createAnimatedSprite, // Helper, might be useful if other enemies become animated
        updateSpriteAnimation // Helper
    };

})();
