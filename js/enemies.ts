import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { enemiesContainer, enemies, player, demoPlayer, gruntTexture, humansAndProgs } from './main';
import { gameState } from './gameState';
import { Projectiles } from './projectiles';
import { Humans } from './humans';
import { Grunt, Hulk, Spheroid, Enforcer, Brain, Tank, ProgEnemy, Quark } from './enemiesClasses';
import { Human, Prog } from './humanClasses';
import { ArcadeAtlas } from './core/ArcadeAtlas';
import { prng } from './core/Prng';

/**
 * Animated sprite from a ROM-extracted atlas family; null when the atlas
 * lacks the family (caller falls back to its legacy placeholder graphic).
 */
function atlasAnim(family: string, speed = 0.15, maxFrames?: number): PIXI.AnimatedSprite | null {
    let frames = ArcadeAtlas.frames(family);
    if (!frames.length) return null;
    if (maxFrames) frames = frames.slice(0, maxFrames);
    const spr = new PIXI.AnimatedSprite(frames);
    spr.animationSpeed = speed;
    spr.play();
    spr.anchor.set(0.5);
    return spr;
}


// Helper function to create animated sprites (used by Brain)
function createAnimatedSprite(frames: ((g: PIXI.Graphics) => void)[], animationSpeed = 0.1) {
    if (!PIXI) { console.warn("Enemies.createAnimatedSprite: Missing PIXI."); return null; }
    const container = new PIXI.Container();
    (container as any).frames = frames;
    (container as any).currentFrame = 0;
    (container as any).animationTimer = 0;
    (container as any).animationSpeed = animationSpeed;

    const initialFrame = new PIXI.Graphics();
    frames[0](initialFrame);
    container.addChild(initialFrame);
    (container as any).currentGraphics = initialFrame;

    return container;
}

// Update animation frame (used by Brain)
function updateSpriteAnimation(spriteInstance: any, delta: number) {
    if (!spriteInstance || !spriteInstance.frames || !spriteInstance.currentGraphics) return;

    spriteInstance.animationTimer += delta;
    if (spriteInstance.animationTimer >= spriteInstance.animationSpeed) {
        spriteInstance.animationTimer = 0;
        spriteInstance.currentFrame = (spriteInstance.currentFrame + 1) % spriteInstance.frames.length;

        spriteInstance.removeChild(spriteInstance.currentGraphics);
        if (spriteInstance.currentGraphics.destroy) spriteInstance.currentGraphics.destroy();

        const newFrame = new PIXI.Graphics();
        spriteInstance.frames[spriteInstance.currentFrame](newFrame);
        spriteInstance.addChild(newFrame);
        spriteInstance.currentGraphics = newFrame;
    }
}

export function createGrunt(x: number, y: number): Grunt | null {
    if (!PIXI || !gruntTexture || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createGrunt: Missing dependencies."); return null;
    }
    const gruntSprite = atlasAnim('grunt', 0.1, 3) ?? (() => {
        const s = new PIXI.Sprite(gruntTexture);
        s.anchor.set(0.5);
        return s;
    })();

    const grunt = new Grunt(gruntSprite, x, y, GameConfig.GRUNT_SPEED || 0.6, GameConfig.POINTS.GRUNT);
    enemiesContainer.addChild(grunt.sprite);
    enemies.push(grunt);
    return grunt;
}

export function createHulk(x: number, y: number): Hulk | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createHulk: Missing dependencies."); return null;
    }
    const hulkSprite = atlasAnim('hulk', 0.08) ?? (() => {
        const g = new PIXI.Graphics();
        g.beginFill(0x00FF00); g.drawRect(-8, -10, 16, 20); g.endFill();
        return g;
    })();

    const hulk = new Hulk(hulkSprite, x, y, GameConfig.HULK_SPEED || 0.3, GameConfig.POINTS.HULK);
    enemiesContainer.addChild(hulk.sprite);
    enemies.push(hulk);
    return hulk;
}

export function createSpheroid(x: number, y: number): Spheroid | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createSpheroid: Missing dependencies."); return null;
    }
    const spheroidSprite = atlasAnim('spheroid', 0.2) ?? (() => {
        const g = new PIXI.Graphics();
        g.beginFill(0xFF0000); g.drawCircle(0, 0, 6); g.endFill();
        return g;
    })();

    const spheroid = new Spheroid(spheroidSprite, x, y, GameConfig.SPHEROID_SPEED || 0.7, GameConfig.POINTS.SPHEROID, GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300, 1);
    enemiesContainer.addChild(spheroid.sprite);
    enemies.push(spheroid);
    return spheroid;
}

export function createEnforcer(x: number, y: number): Enforcer | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createEnforcer: Missing dependencies."); return null;
    }
    const enforcerSprite = atlasAnim('enforcer', 0.1) ?? (() => {
        const g = new PIXI.Graphics();
        g.beginFill(0x0000FF);
        g.moveTo(0, -6); g.lineTo(4, 0);
        g.lineTo(0, 6); g.lineTo(-4, 0);
        g.closePath(); g.endFill();
        return g;
    })();

    const enforcer = new Enforcer(enforcerSprite, x, y, GameConfig.ENFORCER_SPEED || 0.8, GameConfig.POINTS.ENFORCER, GameConfig.ENFORCER_SHOOT_DELAY || 120);
    enemiesContainer.addChild(enforcer.sprite);
    enemies.push(enforcer);
    return enforcer;
}

export function createBrain(x: number, y: number): Brain | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createBrain: Missing dependencies."); return null;
    }
    const brainSprite = atlasAnim('brain', 0.1) ?? (() => {
        const brainFrames = [
            (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-4, -5).lineTo(-2, -7).moveTo(4, -5).lineTo(2, -7); },
            (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-3, -6).lineTo(-3, -8).moveTo(3, -6).lineTo(3, -8); }
        ];
        return createAnimatedSprite(brainFrames, 0.2);
    })();
    if (!brainSprite) return null;

    const brain = new Brain(brainSprite as PIXI.Container, x, y, GameConfig.BRAIN_SPEED || 0.6, GameConfig.POINTS.BRAIN, GameConfig.BRAIN_SHOOT_DELAY || 150, GameConfig.BRAIN_REPROGRAM_DURATION || 120);
    enemiesContainer.addChild(brain.sprite);
    enemies.push(brain);
    return brain;
}

export function createTank(x: number, y: number): Tank | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createTank: Missing dependencies."); return null;
    }
    const tankSprite = atlasAnim('tank', 0.1) ?? (() => {
        const g = new PIXI.Graphics();
        g.beginFill(0x888888).drawRect(-10, -7, 20, 14).endFill()
         .beginFill(0x666666).drawRect(-3, -10, 6, 6).drawRect(-1, -15, 2, 5).endFill();
        return g;
    })();

    const tank = new Tank(tankSprite, x, y, GameConfig.TANK_SPEED || 0.4, GameConfig.POINTS.TANK, GameConfig.TANK_SHOOT_DELAY || 180);
    enemiesContainer.addChild(tank.sprite);
    enemies.push(tank);
    return tank;
}

// This is the distinct createProg that adds to the 'enemies' array.
export function createProg(x: number, y: number): ProgEnemy | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createProg: Missing dependencies."); return null;
    }
    // Progs are reprogrammed humans — mikey frames with the arcade's
    // red mutant tint (no dedicated prog frames were captured).
    const progSprite = atlasAnim('mikey', 0.15) ?? (() => {
        const g = new PIXI.Graphics();
        g.lineStyle(1, 0x4B0082);
        g.beginFill(0x8A2BE2);
        g.drawRect(-6, -6, 12, 12);
        g.endFill();
        return g;
    })();

    progSprite.tint = 0xFF6666;
    const prog = new ProgEnemy(progSprite, x, y, GameConfig.PROG_SPEED || 1.3, GameConfig.POINTS.PROG);
    enemiesContainer.addChild(prog.sprite);
    enemies.push(prog);
    return prog;
}

export function createQuark(x: number, y: number): Quark | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createQuark: Missing dependencies."); return null;
    }
    const quarkSprite = atlasAnim('quark', 0.2) ?? (() => {
        const g = new PIXI.Graphics();
        g.beginFill(0xFFFFFF); g.drawRect(-4, -4, 8, 8); g.endFill();
        return g;
    })();

    const quark = new Quark(quarkSprite, x, y, GameConfig.QUARK_SPEED || 1.2, GameConfig.POINTS.QUARK, GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180, GameConfig.MAX_SUB_QUARKS_PER_QUARK || 3);
    enemiesContainer.addChild(quark.sprite);
    enemies.push(quark);
    return quark;
}

export function updateEnemies(delta: number): void {
    if (typeof gameState.currentGameState === 'undefined' || (gameState.currentGameState !== 'PLAYING' && gameState.currentGameState !== 'DEMO_PLAY')) {
        return;
    }
    if (!enemies || !GameConfig || !PIXI || !Projectiles || !Humans) {
        return;
    }

    const currentPlayer = gameState.currentGameState === 'DEMO_PLAY' ? demoPlayer : player;
    if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) {
        // If no player, enemies might wander or have default behavior, but targeting is off.
        // Most enemies require a player target.
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy || enemy._destroyed || !enemy.sprite || (enemy.sprite as any)._destroyed) {
            enemies.splice(i, 1);
            continue;
        }

        // Common: Update animation for animated sprites (only Brain uses this currently)
        if ((enemy.sprite as any).frames) { 
             updateSpriteAnimation(enemy.sprite, delta);
        }

        // Type-specific logic
        if (enemy.type === 'grunt') {
            const grunt = enemy as Grunt;
            if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) {
                // If no player, just move randomly
                if (!grunt.lastAngle) grunt.lastAngle = Math.random() * Math.PI * 2;
                grunt.lastAngle += (Math.random() - 0.5) * 0.1;
                const idealDx = Math.cos(grunt.lastAngle) * grunt.speed;
                const idealDy = Math.sin(grunt.lastAngle) * grunt.speed;
                grunt.dx += (idealDx - grunt.dx) * 0.03;
                grunt.dy += (idealDy - grunt.dy) * 0.03;
                grunt.update(delta);
                continue;
            }
            // Arcade grunt AI (REVERSE.md Ph12): stepped movement on a 3-frame
            // timer, one axis at a time (staircase pursuit), homing toward
            // player position + a per-grunt PRNG scatter offset; the axis is
            // probabilistically re-homed each tick (X when PRNG > $F8,
            // Y when PRNG > $E4).
            const g = grunt as any;
            if (g.homeOffX === undefined) {
                g.homeOffX = prng.range(-12, 12);
                g.homeOffY = prng.range(-12, 12);
                g.stepTimer = prng.range(0, 2);
                g.axis = (prng.step() & 0x80) ? 'x' : 'y';
            }
            g.stepTimer -= delta;
            if (g.stepTimer <= 0) {
                g.stepTimer += 3;
                const targetX = currentPlayer.sprite.x + g.homeOffX;
                const targetY = currentPlayer.sprite.y + g.homeOffY;
                // probabilistic re-homing, mirroring PRNG[$84]>$F8 / PRNG[$86]>$E4
                const r = prng.step();
                if (r > 0xF8) { g.axis = 'x'; g.homeOffX = prng.range(-12, 12); }
                else if (r > 0xE4) { g.axis = 'y'; g.homeOffY = prng.range(-12, 12); }
                const dxs = targetX - grunt.position.x;
                const dys = targetY - grunt.position.y;
                // switch axis when aligned on the current one
                if (g.axis === 'x' && Math.abs(dxs) < 2) g.axis = 'y';
                else if (g.axis === 'y' && Math.abs(dys) < 2) g.axis = 'x';
                const STEP = 2;
                if (g.axis === 'x') grunt.position.x += Math.sign(dxs) * STEP;
                else grunt.position.y += Math.sign(dys) * STEP;
                grunt.position.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, grunt.position.x));
                grunt.position.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, grunt.position.y));
                grunt.sprite.x = grunt.position.x;
                grunt.sprite.y = grunt.position.y;
            }
            grunt.dx = 0; grunt.dy = 0;

        } else if (enemy.type === 'hulk') {
            // Arcade hulk AI (REVERSE.md Ph19): slow stepped walk in straight
            // lines (4 directions), turning on a PRNG timer toward a human
            // target (or the player when none), fully random on wall hits.
            // Indestructible; killing humans on contact is handled in
            // gameLogic collision checks.
            const hulk = enemy as any;
            if (hulk.dirX === undefined) {
                hulk.dirX = prng.chance(0.5) ? (prng.chance(0.5) ? 1 : -1) : 0;
                hulk.dirY = hulk.dirX === 0 ? (prng.chance(0.5) ? 1 : -1) : 0;
                hulk.stepTimer = 0;
                hulk.turnTimer = prng.range(8, 40);
            }
            hulk.stepTimer -= delta;
            if (hulk.stepTimer <= 0) {
                hulk.stepTimer += 8;   // hulks step every ~8 frames
                hulk.turnTimer--;
                if (hulk.turnTimer <= 0) {
                    hulk.turnTimer = prng.range(8, 40);
                    // re-home: pick a target (random live human, else player)
                    let tx: number | null = null, ty: number | null = null;
                    const humansAlive = humansAndProgs.filter((h: Human | Prog) => h instanceof Human && !(h as any).isRescued && h.sprite && !h._destroyed);
                    if (humansAlive.length > 0 && prng.step() <= 0xC0) {
                        const t = humansAlive[prng.bounded(humansAlive.length)];
                        tx = t.sprite.x; ty = t.sprite.y;
                    } else if (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) {
                        tx = currentPlayer.sprite.x; ty = currentPlayer.sprite.y;
                    }
                    if (tx !== null && ty !== null) {
                        const jx = tx + prng.range(-16, 15) - hulk.position.x;
                        const jy = ty + prng.range(-16, 15) - hulk.position.y;
                        // walk along one axis at a time, like the direction tables
                        if (Math.abs(jx) > Math.abs(jy)) { hulk.dirX = Math.sign(jx); hulk.dirY = 0; }
                        else { hulk.dirX = 0; hulk.dirY = Math.sign(jy); }
                    }
                }
                const STEP = 2;
                let nx = hulk.position.x + hulk.dirX * STEP;
                let ny = hulk.position.y + hulk.dirY * STEP;
                if (nx < 10 || nx > GameConfig.GAME_WIDTH - 10 || ny < 12 || ny > GameConfig.GAME_HEIGHT - 12) {
                    // wall: pick a fresh random direction (hulk_rehome_random)
                    const d = prng.bounded(4);
                    hulk.dirX = d === 0 ? 1 : d === 1 ? -1 : 0;
                    hulk.dirY = d === 2 ? 1 : d === 3 ? -1 : 0;
                    hulk.turnTimer = prng.range(8, 40);
                    nx = Math.max(10, Math.min(GameConfig.GAME_WIDTH - 10, hulk.position.x));
                    ny = Math.max(12, Math.min(GameConfig.GAME_HEIGHT - 12, hulk.position.y));
                }
                hulk.position.x = nx; hulk.position.y = ny;
                hulk.sprite.x = nx; hulk.sprite.y = ny;
            }
        } else if (enemy.type === 'spheroid') {
            const spheroid = enemy as Spheroid;

            // Spheroid AI: Float randomly, then move toward corners after spawning enforcers
            if (spheroid.enforcersSpawned >= spheroid.maxEnforcersToSpawn) {
                // After spawning, move toward nearest corner and continue spawning
                const corners = [
                    { x: 20, y: 20 },
                    { x: GameConfig.GAME_WIDTH - 20, y: 20 },
                    { x: 20, y: GameConfig.GAME_HEIGHT - 20 },
                    { x: GameConfig.GAME_WIDTH - 20, y: GameConfig.GAME_HEIGHT - 20 }
                ];

                // Find nearest corner
                let nearestCorner = corners[0];
                let minDist = Infinity;
                corners.forEach(corner => {
                    const dist = Math.hypot(corner.x - spheroid.sprite.x, corner.y - spheroid.sprite.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestCorner = corner;
                    }
                });

                // Move toward corner
                const angle = Math.atan2(nearestCorner.y - spheroid.sprite.y, nearestCorner.x - spheroid.sprite.x);
                spheroid.dx = Math.cos(angle) * spheroid.speed * 0.5; // Slower when moving to corner
                spheroid.dy = Math.sin(angle) * spheroid.speed * 0.5;

                // Continue spawning enforcers from corner
                spheroid.spawnEnforcerTimer -= delta;
                if (spheroid.spawnEnforcerTimer <= 0) {
                    if (createEnforcer) createEnforcer(spheroid.sprite.x, spheroid.sprite.y);
                    spheroid.spawnEnforcerTimer = GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300;
                }
            } else {
                // Before spawning all enforcers, float randomly
                if (!spheroid.dx || !spheroid.dy || Math.random() < 0.01) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    spheroid.dx = Math.cos(randomAngle) * spheroid.speed;
                    spheroid.dy = Math.sin(randomAngle) * spheroid.speed;
                }

                // Spawn enforcers
                spheroid.spawnEnforcerTimer -= delta;
                if (spheroid.spawnEnforcerTimer <= 0) {
                    if (createEnforcer) createEnforcer(spheroid.sprite.x, spheroid.sprite.y);
                    spheroid.enforcersSpawned++;
                    spheroid.spawnEnforcerTimer = GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300;
                }
            }

            spheroid.update(delta);

            // Boundary checks using logical position
            if (spheroid.position.x < 6 || spheroid.position.x > GameConfig.GAME_WIDTH - 6) {
                spheroid.dx *= -1;
                spheroid.position.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, spheroid.position.x));
                spheroid.sprite.x = spheroid.position.x;
            }
            if (spheroid.position.y < 6 || spheroid.position.y > GameConfig.GAME_HEIGHT - 6) {
                spheroid.dy *= -1;
                spheroid.position.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, spheroid.position.y));
                spheroid.sprite.y = spheroid.position.y;
            }

            // Pulsing animation
            spheroid.pulseTimer += spheroid.pulseRate * delta;
            spheroid.sprite.alpha = 0.75 + Math.sin(spheroid.pulseTimer) * 0.25;
        } else if (enemy.type === 'enforcer') {
            // Arcade enforcer (REVERSE.md Ph16 enforcer_aim): velocity is
            // re-aimed on a PRNG timer toward player position + PRNG jitter,
            // giving the characteristic drifting float instead of a beeline.
            const enforcer = enemy as any;
            if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            if (enforcer.aimTimer === undefined) enforcer.aimTimer = 0;
            enforcer.aimTimer -= delta;
            if (enforcer.aimTimer <= 0) {
                enforcer.aimTimer = prng.range(20, 50);   // jitter timer (obj[14])
                const jx = currentPlayer.sprite.x + prng.range(-16, 15) - enforcer.position.x;
                const jy = currentPlayer.sprite.y + prng.range(-16, 15) - enforcer.position.y;
                const mag = Math.hypot(jx, jy) || 1;
                const spd = GameConfig.ENFORCER_SPEED || 0.8;
                enforcer.dx = (jx / mag) * spd;
                enforcer.dy = (jy / mag) * spd;
            }
            enforcer.update(delta);
            enforcer.position.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, enforcer.position.x));
            enforcer.position.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, enforcer.position.y));
            enforcer.sprite.x = enforcer.position.x;
            enforcer.sprite.y = enforcer.position.y;
            enforcer.shootTimer -= delta;
            if (enforcer.shootTimer <= 0 && currentPlayer.isAlive) {
                if (Projectiles.createEnforcerProjectile) {
                    // spark: lead-aim with PRNG spread (enforcer_aim >>3 jitter)
                    const sx = currentPlayer.sprite.x + prng.range(-14, 14);
                    const sy = currentPlayer.sprite.y + prng.range(-14, 14);
                    Projectiles.createEnforcerProjectile(enforcer.sprite.x, enforcer.sprite.y, sx, sy);
                }
                enforcer.shootTimer = GameConfig.ENFORCER_SHOOT_DELAY || 120;
            }
        } else if (enemy.type === 'brain') {
            const brain = enemy as Brain;
            let targetX = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.x : brain.sprite.x;
            let targetY = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.y : brain.sprite.y;
            let closestHumanDist = Infinity;

            const targetableHumans = humansAndProgs.filter((h: Human | Prog) => h instanceof Human && !h.isRescued && h.sprite && !h._destroyed);
            brain.reprogramTarget = null;

            if (targetableHumans.length > 0) {
                targetableHumans.forEach((human: Human | Prog) => {
                    if (human && human.sprite && !human._destroyed && human.sprite.x !== null && human.sprite.y !== null) {
                        // Manhattan distance, like brain_find_nearest_human ($5B95)
                        const dist = Math.abs(human.sprite.x - brain.sprite.x) + Math.abs(human.sprite.y - brain.sprite.y);
                        if (dist < closestHumanDist) {
                            closestHumanDist = dist;
                            targetX = human.sprite.x; targetY = human.sprite.y;
                            brain.reprogramTarget = human;
                        }
                    }
                });

                // Arcade behavior: a brain converts a human to a Prog on
                // CONTACT (no proximity timer / tint countdown).
                if (brain.reprogramTarget && closestHumanDist < 7) {
                    if (Humans.convertToProg) Humans.convertToProg(brain.reprogramTarget);
                    brain.reprogramTarget = null;
                }
            } else {
                 targetX = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.x : brain.sprite.x;
                 targetY = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.y : brain.sprite.y;
            }

            const angleToTarget = Math.atan2(targetY - brain.sprite.y, targetX - brain.sprite.x);
            // Update logical position first
            brain.position.x += Math.cos(angleToTarget) * (GameConfig.BRAIN_SPEED || 0.6) * delta;
            brain.position.y += Math.sin(angleToTarget) * (GameConfig.BRAIN_SPEED || 0.6) * delta;
            // Update sprite to match logical position
            brain.sprite.x = brain.position.x;
            brain.sprite.y = brain.position.y;

            brain.shootTimer -= delta;
            if (brain.shootTimer <= 0 && currentPlayer && currentPlayer.isAlive && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) {
                 if (Projectiles.createBrainProjectile) {
                    Projectiles.createBrainProjectile(brain.sprite.x, brain.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
                }
                brain.shootTimer = GameConfig.BRAIN_SHOOT_DELAY || 150;
            }
        } else if (enemy.type === 'tank') {
            const tank = enemy as Tank;
            if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            const angle = Math.atan2(currentPlayer.sprite.y - tank.sprite.y, currentPlayer.sprite.x - tank.sprite.x);
            // Update logical position first
            tank.position.x += Math.cos(angle) * (GameConfig.TANK_SPEED || 0.4) * delta;
            tank.position.y += Math.sin(angle) * (GameConfig.TANK_SPEED || 0.4) * delta;
            // Update sprite to match logical position
            tank.sprite.x = tank.position.x;
            tank.sprite.y = tank.position.y;
            tank.shootTimer -= delta;
            if (tank.shootTimer <= 0 && currentPlayer.isAlive) {
                 if (Projectiles.createTankShell) {
                    Projectiles.createTankShell(tank.sprite.x, tank.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
                }
                tank.shootTimer = GameConfig.TANK_SHOOT_DELAY || 180;
            }
        } else if (enemy.type === 'prog_enemy') {
            const prog = enemy as ProgEnemy;
             if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            const angle = Math.atan2(currentPlayer.sprite.y - prog.sprite.y, currentPlayer.sprite.x - prog.sprite.x);
            // Update logical position first
            prog.position.x += Math.cos(angle) * prog.speed * delta;
            prog.position.y += Math.sin(angle) * prog.speed * delta;
            // Apply boundary constraints to logical position
            prog.position.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, prog.position.x));
            prog.position.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, prog.position.y));
            // Update sprite to match logical position
            prog.sprite.x = prog.position.x;
            prog.sprite.y = prog.position.y;
        } else if (enemy.type === 'quark') {
            const quark = enemy as Quark;
            quark.update(delta);
            // Boundary checks using logical position
            if (quark.position.x < 4 || quark.position.x > GameConfig.GAME_WIDTH - 4) {
                quark.dx *= -1; 
                quark.position.x = Math.max(4, Math.min(GameConfig.GAME_WIDTH - 4, quark.position.x));
                quark.sprite.x = quark.position.x;
            }
            if (quark.position.y < 4 || quark.position.y > GameConfig.GAME_HEIGHT - 4) {
                quark.dy *= -1; 
                quark.position.y = Math.max(4, Math.min(GameConfig.GAME_HEIGHT - 4, quark.position.y));
                quark.sprite.y = quark.position.y;
            }
            // Arcade behavior: quarks manufacture TANKS (not "sub-quarks"),
            // throttled by the wave's live-tank cap.
            quark.spawnSubQuarkTimer -= delta;
            if (quark.spawnSubQuarkTimer <= 0) {
                const liveTanks = enemies.filter(e => e.type === 'tank' && !e._destroyed).length;
                const cap = (gameState as any).tankCap ?? 0;
                if (liveTanks < cap && createTank) {
                    createTank(quark.sprite.x, quark.sprite.y);
                    quark.subQuarksSpawned++;
                }
                quark.spawnSubQuarkTimer = GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180;
            }
        }
    }
}

export const Enemies = {
    createGrunt,
    createHulk,
    createSpheroid,
    createEnforcer,
    createBrain,
    createTank,
    createQuark,
    createProg,
    updateEnemies,
    createAnimatedSprite,
    updateSpriteAnimation
};
