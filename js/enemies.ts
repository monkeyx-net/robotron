import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { enemiesContainer, enemies, player, demoPlayer, gruntTexture, humansAndProgs } from './main';
import { gameState } from './gameState';
import { Projectiles } from './projectiles';
import { Humans } from './humans';
import { Grunt, Hulk, Spheroid, Enforcer, Brain, Tank, ProgEnemy, Quark, SubQuark } from './enemiesClasses';
import { Human, Prog } from './humanClasses';


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
    const gruntSprite = new PIXI.Sprite(gruntTexture);
    gruntSprite.anchor.set(0.5);
    
    const grunt = new Grunt(gruntSprite, x, y, GameConfig.GRUNT_SPEED || 0.6, GameConfig.POINTS.GRUNT);
    enemiesContainer.addChild(grunt.sprite);
    enemies.push(grunt);
    return grunt;
}

export function createHulk(x: number, y: number): Hulk | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createHulk: Missing dependencies."); return null;
    }
    const hulkSprite = new PIXI.Graphics();
    hulkSprite.beginFill(0x00FF00); hulkSprite.drawRect(-8, -10, 16, 20); hulkSprite.endFill();
    
    const hulk = new Hulk(hulkSprite, x, y, GameConfig.HULK_SPEED || 0.3, GameConfig.POINTS.HULK);
    enemiesContainer.addChild(hulk.sprite);
    enemies.push(hulk);
    return hulk;
}

export function createSpheroid(x: number, y: number): Spheroid | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createSpheroid: Missing dependencies."); return null;
    }
    const spheroidSprite = new PIXI.Graphics();
    spheroidSprite.beginFill(0xFF0000); spheroidSprite.drawCircle(0, 0, 6); spheroidSprite.endFill();
    
    const spheroid = new Spheroid(spheroidSprite, x, y, GameConfig.SPHEROID_SPEED || 0.7, GameConfig.POINTS.SPHEROID, GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300, 1);
    enemiesContainer.addChild(spheroid.sprite);
    enemies.push(spheroid);
    return spheroid;
}

export function createEnforcer(x: number, y: number): Enforcer | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createEnforcer: Missing dependencies."); return null;
    }
    const enforcerSprite = new PIXI.Graphics();
    enforcerSprite.beginFill(0x0000FF);
    enforcerSprite.moveTo(0, -6); enforcerSprite.lineTo(4, 0);
    enforcerSprite.lineTo(0, 6); enforcerSprite.lineTo(-4, 0);
    enforcerSprite.closePath(); enforcerSprite.endFill();
    
    const enforcer = new Enforcer(enforcerSprite, x, y, GameConfig.ENFORCER_SPEED || 0.8, GameConfig.POINTS.ENFORCER, GameConfig.ENFORCER_SHOOT_DELAY || 120);
    enemiesContainer.addChild(enforcer.sprite);
    enemies.push(enforcer);
    return enforcer;
}

export function createBrain(x: number, y: number): Brain | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createBrain: Missing dependencies."); return null;
    }
    const brainFrames = [
        (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-4, -5).lineTo(-2, -7).moveTo(4, -5).lineTo(2, -7); },
        (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-3, -6).lineTo(-3, -8).moveTo(3, -6).lineTo(3, -8); }
    ];
    const brainSprite = createAnimatedSprite(brainFrames, 0.2);
    if (!brainSprite) return null; // createAnimatedSprite failed
    
    const brain = new Brain(brainSprite as PIXI.Container, x, y, GameConfig.BRAIN_SPEED || 0.6, GameConfig.POINTS.BRAIN, GameConfig.BRAIN_SHOOT_DELAY || 150, GameConfig.BRAIN_REPROGRAM_DURATION || 120);
    enemiesContainer.addChild(brain.sprite);
    enemies.push(brain);
    return brain;
}

export function createTank(x: number, y: number): Tank | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createTank: Missing dependencies."); return null;
    }
    const tankSprite = new PIXI.Graphics();
    tankSprite.beginFill(0x888888).drawRect(-10, -7, 20, 14).endFill()
              .beginFill(0x666666).drawRect(-3, -10, 6, 6).drawRect(-1, -15, 2, 5).endFill();
    
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
    const progSprite = new PIXI.Graphics();
    progSprite.lineStyle(1, 0x4B0082);
    progSprite.beginFill(0x8A2BE2);
    progSprite.drawRect(-6, -6, 12, 12);
    progSprite.endFill();
    
    const prog = new ProgEnemy(progSprite, x, y, GameConfig.PROG_SPEED || 1.3, GameConfig.POINTS.PROG);
    enemiesContainer.addChild(prog.sprite);
    enemies.push(prog);
    return prog;
}

export function createQuark(x: number, y: number): Quark | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createQuark: Missing dependencies."); return null;
    }
    const quarkSprite = new PIXI.Graphics();
    quarkSprite.beginFill(0xFFFFFF); quarkSprite.drawRect(-4, -4, 8, 8); quarkSprite.endFill();
    
    const quark = new Quark(quarkSprite, x, y, GameConfig.QUARK_SPEED || 1.2, GameConfig.POINTS.QUARK, GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180, GameConfig.MAX_SUB_QUARKS_PER_QUARK || 3);
    enemiesContainer.addChild(quark.sprite);
    enemies.push(quark);
    return quark;
}

export function createSubQuark(x: number, y: number): SubQuark | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createSubQuark: Missing dependencies."); return null;
    }
    const subQuarkSprite = new PIXI.Graphics();
    subQuarkSprite.beginFill(0xEEEEEE); subQuarkSprite.drawRect(-2, -2, 4, 4); subQuarkSprite.endFill();
    
    const subQuark = new SubQuark(subQuarkSprite, x, y, GameConfig.SUB_QUARK_SPEED || 1.5, GameConfig.POINTS.SUB_QUARK, 180);
    enemiesContainer.addChild(subQuark.sprite);
    enemies.push(subQuark);
    return subQuark;
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
            const targetAngle = Math.atan2(currentPlayer.sprite.y - grunt.sprite.y, currentPlayer.sprite.x - grunt.sprite.x);
            let angleDiff = targetAngle - grunt.lastAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            grunt.lastAngle += (GameConfig.GRUNT_TURN_RATE || 0.08) * angleDiff;

            const idealDx = Math.cos(grunt.lastAngle) * grunt.speed;
            const idealDy = Math.sin(grunt.lastAngle) * grunt.speed;

            grunt.dx += (idealDx - grunt.dx) * (GameConfig.GRUNT_ACCELERATION || 0.03);
            grunt.dy += (idealDy - grunt.dy) * (GameConfig.GRUNT_ACCELERATION || 0.03);

            const distToPlayer = Math.hypot(currentPlayer.sprite.x - grunt.sprite.x, currentPlayer.sprite.y - grunt.sprite.y);
            const speedMultiplier = Math.max(0.5, Math.min(1, 1 - (distToPlayer / 200)));
            const currentMaxSpeed = (GameConfig.GRUNT_SPEED || 0.6) + ((GameConfig.GRUNT_MAX_SPEED || 1.0) - (GameConfig.GRUNT_SPEED || 0.6)) * speedMultiplier;

            const currentSpeed = Math.hypot(grunt.dx, grunt.dy);
            if (currentSpeed > currentMaxSpeed) {
                grunt.dx = (grunt.dx / currentSpeed) * currentMaxSpeed;
                grunt.dy = (grunt.dy / currentSpeed) * currentMaxSpeed;
            }

            grunt.update(delta);

            // Boundary checks simplified
            if (grunt.sprite.x < 6 || grunt.sprite.x > GameConfig.GAME_WIDTH - 6) { grunt.sprite.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, grunt.sprite.x)); grunt.dx *= -0.5; grunt.lastAngle += Math.PI + (Math.random()-0.5)*0.2; }
            if (grunt.sprite.y < 6 || grunt.sprite.y > GameConfig.GAME_HEIGHT - 6) { grunt.sprite.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, grunt.sprite.y)); grunt.dy *= -0.5; grunt.lastAngle += Math.PI + (Math.random()-0.5)*0.2; }

        } else if (enemy.type === 'hulk') {
            const hulk = enemy as Hulk;
            hulk.wanderTimer -= delta;
            if (hulk.isCharging && hulk.chargeTarget && hulk.chargeTarget.sprite && !(hulk.chargeTarget.sprite as any)._destroyed) {
                try {
                    // Safely access sprite properties with additional error handling
                    let targetX, targetY, hulkX, hulkY;
                    
                    try {
                        targetX = hulk.chargeTarget.sprite.x;
                        targetY = hulk.chargeTarget.sprite.y;
                    } catch (error) {
                        // Target sprite properties are inaccessible, stop charging
                        hulk.isCharging = false; hulk.chargeTarget = null;
                        hulk.wanderTimer = Math.random() * 120 + 60;
                        return;
                    }
                    
                    try {
                        hulkX = hulk.sprite.x;
                        hulkY = hulk.sprite.y;
                    } catch (error) {
                        // Hulk sprite properties are inaccessible, stop charging
                        hulk.isCharging = false; hulk.chargeTarget = null;
                        hulk.wanderTimer = Math.random() * 120 + 60;
                        return;
                    }
                    
                    // Check if position properties are valid numbers
                    if (typeof targetX === 'number' && typeof targetY === 'number' &&
                        typeof hulkX === 'number' && typeof hulkY === 'number' &&
                        !isNaN(targetX) && !isNaN(targetY) && !isNaN(hulkX) && !isNaN(hulkY)) {
                        
                        const angle = Math.atan2(targetY - hulkY, targetX - hulkX);
                        hulk.sprite.x += Math.cos(angle) * (GameConfig.HULK_CHARGE_SPEED || 1.2) * delta;
                        hulk.sprite.y += Math.sin(angle) * (GameConfig.HULK_CHARGE_SPEED || 1.2) * delta;
                        const distToTarget = Math.hypot(hulkX - targetX, hulkY - targetY);
                        if (distToTarget < 10 || hulk.wanderTimer <= 0) {
                            hulk.isCharging = false; hulk.chargeTarget = null;
                            hulk.wanderTimer = Math.random() * 120 + 60;
                        }
                    } else {
                        // Invalid sprite properties, stop charging
                        hulk.isCharging = false; hulk.chargeTarget = null;
                        hulk.wanderTimer = Math.random() * 120 + 60;
                    }
                } catch (error) {
                    // Error accessing sprite properties, stop charging
                    console.warn('Hulk charge target error:', error);
                    hulk.isCharging = false; hulk.chargeTarget = null;
                    hulk.wanderTimer = Math.random() * 120 + 60;
                }
            } else {
                hulk.isCharging = false;
                if (hulk.wanderTimer <= 0) {
                    const targetableHumans = humansAndProgs.filter((h: Human | Prog) => h instanceof Human && !h.isRescued && h.sprite && !h._destroyed);
                    if (targetableHumans.length > 0 && Math.random() < 0.3) {
                        hulk.isCharging = true;
                        hulk.chargeTarget = targetableHumans[Math.floor(Math.random() * targetableHumans.length)];
                        hulk.wanderTimer = Math.random() * 60 + 30;
                    } else {
                        hulk.dx = (Math.random() - 0.5) * (GameConfig.HULK_SPEED || 0.3) * 2;
                        hulk.dy = (Math.random() - 0.5) * (GameConfig.HULK_SPEED || 0.3) * 2;
                        hulk.wanderTimer = Math.random() * 120 + 60;
                    }
                }
                hulk.update(delta);
                if (hulk.sprite.x < 8 || hulk.sprite.x > GameConfig.GAME_WIDTH - 8) {hulk.dx *= -1; hulk.sprite.x = Math.max(8, Math.min(GameConfig.GAME_WIDTH - 8, hulk.sprite.x));}
                if (hulk.sprite.y < 10 || hulk.sprite.y > GameConfig.GAME_HEIGHT - 10) {hulk.dy *= -1; hulk.sprite.y = Math.max(10, Math.min(GameConfig.GAME_HEIGHT - 10, hulk.sprite.y));}
            }
        } else if (enemy.type === 'spheroid') {
            const spheroid = enemy as Spheroid;
            spheroid.update(delta);
            if (spheroid.sprite.x < 6 || spheroid.sprite.x > GameConfig.GAME_WIDTH - 6) {spheroid.dx *= -1; spheroid.sprite.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, spheroid.sprite.x));}
            if (spheroid.sprite.y < 6 || spheroid.sprite.y > GameConfig.GAME_HEIGHT - 6) {spheroid.dy *= -1; spheroid.sprite.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, spheroid.sprite.y));}
            spheroid.pulseTimer += spheroid.pulseRate * delta;
            spheroid.sprite.alpha = 0.75 + Math.sin(spheroid.pulseTimer) * 0.25;
            if (spheroid.enforcersSpawned < spheroid.maxEnforcersToSpawn) {
                spheroid.spawnEnforcerTimer -= delta;
                if (spheroid.spawnEnforcerTimer <= 0) {
                    if (createEnforcer) createEnforcer(spheroid.sprite.x, spheroid.sprite.y);
                    spheroid.enforcersSpawned++;
                    spheroid.spawnEnforcerTimer = GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY || 300;
                }
            }
        } else if (enemy.type === 'enforcer') {
            const enforcer = enemy as Enforcer;
            if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            const angle = Math.atan2(currentPlayer.sprite.y - enforcer.sprite.y, currentPlayer.sprite.x - enforcer.sprite.x);
            enforcer.sprite.x += Math.cos(angle) * (GameConfig.ENFORCER_SPEED || 0.8) * delta;
            enforcer.sprite.y += Math.sin(angle) * (GameConfig.ENFORCER_SPEED || 0.8) * delta;
            enforcer.shootTimer -= delta;
            if (enforcer.shootTimer <= 0 && currentPlayer.isAlive) {
                if (Projectiles.createEnforcerProjectile) {
                    Projectiles.createEnforcerProjectile(enforcer.sprite.x, enforcer.sprite.y, currentPlayer.sprite.x, currentPlayer.sprite.y);
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
                        const dist = Math.hypot(human.sprite.x - brain.sprite.x, human.sprite.y - brain.sprite.y);
                        if (dist < closestHumanDist) {
                            closestHumanDist = dist;
                            targetX = human.sprite.x; targetY = human.sprite.y;
                            brain.reprogramTarget = human;
                        }
                    }
                });

                if (brain.reprogramTarget && closestHumanDist < (GameConfig.BRAIN_REPROGRAM_RANGE || 20)) {
                    brain.reprogramTimer -= delta;
                    brain.reprogramProgress += delta;

                    // Convert RGB to hex manually (PIXI.utils.rgb2hex deprecated in v8)
                    const r = Math.floor(255 * 1);
                    const g = Math.floor(255 * (1 - (brain.reprogramProgress / (GameConfig.BRAIN_REPROGRAM_DURATION || 120))));
                    const b = Math.floor(255 * 0);
                    brain.reprogramTarget.sprite.tint = (r << 16) | (g << 8) | b;

                    if (brain.reprogramTimer <= 0) {
                        if (Humans.convertToProg) Humans.convertToProg(brain.reprogramTarget);
                        brain.reprogramTarget = null;
                        brain.reprogramTimer = GameConfig.BRAIN_REPROGRAM_DURATION || 120;
                        brain.reprogramProgress = 0;
                    }
                } else {
                    brain.reprogramTimer = GameConfig.BRAIN_REPROGRAM_DURATION || 120;
                    brain.reprogramProgress = 0;
                    if (brain.reprogramTarget) brain.reprogramTarget.sprite.tint = 0xFFFFFF;
                    brain.reprogramTarget = null;
                    targetX = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.x : brain.sprite.x;
                    targetY = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.y : brain.sprite.y;
                }
            } else {
                 targetX = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.x : brain.sprite.x;
                 targetY = (currentPlayer && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed) ? currentPlayer.sprite.y : brain.sprite.y;
            }

            const angleToTarget = Math.atan2(targetY - brain.sprite.y, targetX - brain.sprite.x);
            brain.sprite.x += Math.cos(angleToTarget) * (GameConfig.BRAIN_SPEED || 0.6) * delta;
            brain.sprite.y += Math.sin(angleToTarget) * (GameConfig.BRAIN_SPEED || 0.6) * delta;

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
            tank.sprite.x += Math.cos(angle) * (GameConfig.TANK_SPEED || 0.4) * delta;
            tank.sprite.y += Math.sin(angle) * (GameConfig.TANK_SPEED || 0.4) * delta;
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
            prog.sprite.x += Math.cos(angle) * prog.speed * delta;
            prog.sprite.y += Math.sin(angle) * prog.speed * delta;
            prog.sprite.x = Math.max(6, Math.min(GameConfig.GAME_WIDTH - 6, prog.sprite.x));
            prog.sprite.y = Math.max(6, Math.min(GameConfig.GAME_HEIGHT - 6, prog.sprite.y));
        } else if (enemy.type === 'quark') {
            const quark = enemy as Quark;
            quark.update(delta);
            if (quark.sprite.x < 4 || quark.sprite.x > GameConfig.GAME_WIDTH - 4) {quark.dx *= -1; quark.sprite.x = Math.max(4, Math.min(GameConfig.GAME_WIDTH - 4, quark.sprite.x));}
            if (quark.sprite.y < 4 || quark.sprite.y > GameConfig.GAME_HEIGHT - 4) {quark.dy *= -1; quark.sprite.y = Math.max(4, Math.min(GameConfig.GAME_HEIGHT - 4, quark.sprite.y));}
            if (quark.subQuarksSpawned < quark.maxSubQuarksToSpawn) {
                quark.spawnSubQuarkTimer -= delta;
                if (quark.spawnSubQuarkTimer <= 0) {
                    if (createSubQuark) createSubQuark(quark.sprite.x, quark.sprite.y);
                    quark.subQuarksSpawned++;
                    quark.spawnSubQuarkTimer = GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY || 180;
                }
            }
        } else if (enemy.type === 'sub_quark') {
            const subQuark = enemy as SubQuark;
            subQuark.update(delta);
            subQuark.lifeTimer -= delta;
            if (subQuark.lifeTimer <=0 || subQuark.sprite.x < -2 || subQuark.sprite.x > GameConfig.GAME_WIDTH + 2 || subQuark.sprite.y < -2 || subQuark.sprite.y > GameConfig.GAME_HEIGHT + 2) {
                subQuark.destroy();
                enemies.splice(i,1);
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
    createSubQuark,
    createProg,
    updateEnemies,
    createAnimatedSprite,
    updateSpriteAnimation
};
