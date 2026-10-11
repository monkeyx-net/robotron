import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { enemiesContainer, enemies, player, demoPlayer, gruntTexture, humansAndProgs, enemyProjectiles } from './main';
import { gameState } from './gameState';
import { Projectiles } from './projectiles';
import { Humans } from './humans';
import { Grunt, Hulk, Spheroid, Enforcer, Brain, Tank, ProgEnemy, Quark } from './enemiesClasses';
import { Human, Prog } from './humanClasses';
import { ArcadeAtlas } from './core/ArcadeAtlas';
import { prng } from './core/Prng';
import { WavePacing } from './core/WavePacing';
import { SoundManager } from './soundManager';
import { isEntityGone, clampToPlayfield, spriteHalfExtents } from './gameObject';

// Process cadences of the ROM enemy routines (robotron-re REVERSE.md Ph21,
// measured in MAME with tools/enemy_probe.lua). The per-wave counts come
// from WavePacing.params ($BE5E-$BE67).
const SPHEROID_CYCLE_FRAMES = 10;       // pre-drop countdown: one tick per 5-pass animation cycle
const SPHEROID_DROP_CYCLE_FRAMES = 16;  // drop-mode countdown: one tick per 8-pass cycle
const SPHEROID_EXIT_SPEED = 2;          // x velocity $0100 = 1 byte (2 px) per frame
const ENFORCER_MATERIALIZE_FRAMES = 40;
const ENFORCER_PASS_FRAMES = 3;
const QUARK_CYCLE_FRAMES = 15;          // pre-drop countdown: one tick per 5-pass cycle
const QUARK_PASS_FRAMES = 3;
const QUARK_EXIT_SPEED = 2;             // y velocity $0200 = 2 lines per frame
const TANK_PASS_FRAMES = 2;             // DP $EF
// live caps checked before each spawn
const MAX_ENFORCERS = 8, MAX_SPARKS = 20, MAX_MISSILES = 8, MAX_TANKS = 20, MAX_SHELLS = 21;

function countProjectiles(type: string): number {
    let n = 0;
    for (const p of enemyProjectiles) if (p.type === type && !isEntityGone(p)) n++;
    return n;
}

/** True once a leaving spheroid/quark has crossed the playfield edge. */
function pastPlayfieldEdge(e: Spheroid | Quark): boolean {
    const pf = GameConfig.PLAYFIELD;
    const { hw, hh } = spriteHalfExtents(e.sprite);
    return e.position.x < pf.LEFT + hw || e.position.x > pf.RIGHT - hw
        || e.position.y < pf.TOP + hh || e.position.y > pf.BOTTOM - hh;
}

/** Bounce off the playfield edges using the sprite's half extents. */
function bounceInPlayfield(e: Spheroid | Quark): void {
    const pf = GameConfig.PLAYFIELD;
    const { hw, hh } = spriteHalfExtents(e.sprite);
    if (e.position.x < pf.LEFT + hw || e.position.x > pf.RIGHT - hw) {
        e.dx *= -1;
        e.position.x = Math.max(pf.LEFT + hw, Math.min(pf.RIGHT - hw, e.position.x));
        e.sprite.x = e.position.x;
    }
    if (e.position.y < pf.TOP + hh || e.position.y > pf.BOTTOM - hh) {
        e.dy *= -1;
        e.position.y = Math.max(pf.TOP + hh, Math.min(pf.BOTTOM - hh, e.position.y));
        e.sprite.y = e.position.y;
    }
}

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
/** An atlas family held on one frame; the AI picks frames with showFrame. */
function atlasStill(family: string, frame: number): PIXI.AnimatedSprite | null {
    const spr = atlasAnim(family);
    if (spr) spr.gotoAndStop(frame);
    return spr;
}

/** Show atlas frame `n` of an AnimatedSprite (no-op for drawn fallbacks, which have fewer). */
function showFrame(sprite: PIXI.Container, n: number): void {
    if (sprite instanceof PIXI.AnimatedSprite && n < sprite.totalFrames) sprite.gotoAndStop(n);
}

// Hulk direction tables ($01CC/$01D9/$01E6/$01F3): [record, dx px, dy lines].
// Up reuses the down-facing frames. Records index $0CF9; the atlas keeps
// frames in source-address order, which puts records 3-5 after 6-8.
type HulkDir = 'left' | 'right' | 'down' | 'up';
const HULK_WALK: Record<HulkDir, [number, number, number][]> = {
    left:  [[0, -3, 0], [1, -4, 0], [0, -3, 0], [2, -4, 0]],
    right: [[3, 3, 0], [4, 4, 0], [3, 3, 0], [5, 4, 0]],
    down:  [[6, 0, 2], [7, 0, 2], [6, 0, 2], [8, 0, 2]],
    up:    [[6, 0, -2], [7, 0, -2], [6, 0, -2], [8, 0, -2]],
};
const HULK_ATLAS = [0, 1, 2, 6, 7, 8, 3, 4, 5];

/**
 * $41B3: each hulk gets one target for life: the player when rand > $C0,
 * else the next human round-robin ($4237). A dead target means the player.
 */
let hulkHumanCursor = 0;
function pickHulkTarget(): Human | null {
    if (prng.step() > 0xC0) return null;
    const humans = humansAndProgs.filter((h: Human | Prog) => h instanceof Human && !h.isRescued && !isEntityGone(h)) as Human[];
    if (!humans.length) return null;
    return humans[hulkHumanCursor++ % humans.length];
}

/**
 * $4106: walk (rand & $1F) + 1 steps on the other axis from the current one,
 * toward the target plus a random -16..15 (bytes across, lines down).
 */
function hulkRehome(hulk: any, currentPlayer: any): void {
    hulk.walkSteps = (prng.step() & 0x1F) + 1;
    const t = hulk.target && !isEntityGone(hulk.target) && !hulk.target.isRescued ? hulk.target.sprite
        : currentPlayer && currentPlayer.sprite && !currentPlayer.sprite.destroyed ? currentPlayer.sprite : hulk.sprite;
    const jitter = (prng.step() & 0x1F) - 16;
    const horizontal = hulk.walkTable === 'left' || hulk.walkTable === 'right';
    hulk.walkTable = horizontal
        ? (t.y + jitter > hulk.position.y ? 'down' : 'up')
        : (t.x + 2 * jitter > hulk.position.x ? 'right' : 'left');
    hulk.walkIdx = 0;
    showFrame(hulk.sprite, HULK_ATLAS[HULK_WALK[hulk.walkTable as HulkDir][0][0]]);   // $4164
}

// Brain frames ($1CA2/$1CAA/$1CB2/$1CBA, records at $2141).
const BRAIN_WALK = { left: [0, 1, 0, 2], right: [3, 4, 3, 5], down: [6, 7, 6, 8], up: [9, 10, 9, 11] };

/** $5C58: next frame of the brain's walk; a new direction restarts the cycle. */
function brainFacing(brain: any, sx: number, sy: number): void {
    const seq = sx > 0 ? BRAIN_WALK.right : sx < 0 ? BRAIN_WALK.left : sy >= 0 ? BRAIN_WALK.down : BRAIN_WALK.up;
    if (seq !== brain.walkSeq) { brain.walkSeq = seq; brain.walkPos = 0; }
    else brain.walkPos = (brain.walkPos + 1) % seq.length;
    showFrame(brain.sprite, seq[brain.walkPos]);
}

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

    // grunts animate one frame per step (see updateEnemies), not on a clock
    if (gruntSprite instanceof PIXI.AnimatedSprite) gruntSprite.stop();
    const grunt = new Grunt(gruntSprite, x, y, GameConfig.GRUNT_SPEED || 0.6, GameConfig.POINTS.GRUNT);
    enemiesContainer.addChild(grunt.sprite);
    enemies.push(grunt);
    return grunt;
}

export function createHulk(x: number, y: number): Hulk | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createHulk: Missing dependencies."); return null;
    }
    const hulkSprite = atlasStill('hulk', HULK_ATLAS[0]) ?? (() => {
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

    // $5168: ceil(prng_le($BE5E)/2) enforcers; first drop after prng_le($BE60) 10-frame cycles
    const spheroid = new Spheroid(spheroidSprite, x, y, GameConfig.SPHEROID_SPEED || 0.7, GameConfig.POINTS.SPHEROID,
        WavePacing.childCount(), WavePacing.prngLe(WavePacing.params.spheroidDropTimer) * SPHEROID_CYCLE_FRAMES);
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
    // $536D: first shot after the 40-frame materialize plus prng_le($BE5F) 3-frame passes
    enforcer.shootTimer = ENFORCER_MATERIALIZE_FRAMES + WavePacing.prngLe(WavePacing.params.enforcerShotTimer) * ENFORCER_PASS_FRAMES;
    enemiesContainer.addChild(enforcer.sprite);
    enemies.push(enforcer);
    return enforcer;
}

export function createBrain(x: number, y: number): Brain | null {
    if (!PIXI || !enemiesContainer || !enemies || !GameConfig) {
        console.warn("Enemies.createBrain: Missing dependencies."); return null;
    }
    const brainSprite = atlasStill('brain', 6) ?? (() => {
        const brainFrames = [
            (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-4, -5).lineTo(-2, -7).moveTo(4, -5).lineTo(2, -7); },
            (g: PIXI.Graphics) => { g.beginFill(0xFF69B4).drawCircle(0, -3, 5).drawRect(-4, 0, 8, 4).endFill().lineStyle(1, 0xFF88FF).moveTo(-3, -6).lineTo(-3, -8).moveTo(3, -6).lineTo(3, -8); }
        ];
        return createAnimatedSprite(brainFrames, 0.2);
    })();
    if (!brainSprite) return null;

    // $5B46: first cruise missile after prng_le($BE62) steps
    const brain = new Brain(brainSprite as PIXI.Container, x, y, GameConfig.BRAIN_SPEED || 0.6, GameConfig.POINTS.BRAIN,
        WavePacing.prngLe(WavePacing.params.brainMissileTimer), GameConfig.BRAIN_REPROGRAM_DURATION || 120);
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

    // $8CE7: first shell $BE64 passes after materializing
    const tank = new Tank(tankSprite, x, y, GameConfig.TANK_SPEED || 0.4, GameConfig.POINTS.TANK, WavePacing.params.tankShotTimer);
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

    // $8B5E: ceil(prng_le($BE5E)/2) tanks; first drop after prng_le($BE66) 15-frame cycles
    const quark = new Quark(quarkSprite, x, y, GameConfig.QUARK_SPEED || 1.2, GameConfig.POINTS.QUARK,
        WavePacing.childCount(), WavePacing.prngLe(WavePacing.params.quarkDropTimer) * QUARK_CYCLE_FRAMES);
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
    let liveGrunts = 0, liveEnforcers = 0, liveTanks = 0;
    for (const e of enemies) {
        if (isEntityGone(e)) continue;
        if (e.type === 'grunt') liveGrunts++;
        else if (e.type === 'enforcer') liveEnforcers++;
        else if (e.type === 'tank') liveTanks++;
    }
    const wp = WavePacing.params;
    const gruntTicks = WavePacing.update(delta, liveGrunts);
    if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) {
        // If no player, enemies might wander or have default behavior, but targeting is off.
        // Most enemies require a player target.
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (isEntityGone(enemy)) {
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
            // Arcade grunt AI (flat_grunt_move $79CE, REVERSE.md Ph18/Ph21):
            // the grunt process runs every 4 frames; each grunt counts down
            // and, on expiry, steps diagonally toward the player (Y ±4 lines,
            // X ±2 bytes = 4 px) and re-arms with prng_bounded($BE5C). The
            // bound shrinks as the wave goes on (WavePacing). When aligned
            // the ROM's compares still step, so grunts shuffle in place.
            const g = grunt as any;
            if (g.stepCountdown === undefined) g.stepCountdown = WavePacing.nextGruntDelay();
            for (let t = 0; t < gruntTicks; t++) {
                if (--g.stepCountdown > 0) continue;
                g.stepCountdown = WavePacing.nextGruntDelay();
                const dy = Math.round(grunt.position.y - currentPlayer.sprite.y);
                if (dy >= 2) grunt.position.y -= 4;
                else if (dy === 0 || dy <= -2) grunt.position.y += 4;
                const dxBytes = Math.round((grunt.position.x - currentPlayer.sprite.x) / 2);
                grunt.position.x += dxBytes > 0 ? -4 : 4;
                clampToPlayfield(grunt.position, grunt.sprite);
                grunt.sprite.x = grunt.position.x;
                grunt.sprite.y = grunt.position.y;
                // the walk cycle advances with each step, not with time
                const anim = grunt.sprite as PIXI.AnimatedSprite;
                if (anim.totalFrames) anim.gotoAndStop((anim.currentFrame + 1) % anim.totalFrames);
            }
            grunt.dx = 0; grunt.dy = 0;

        } else if (enemy.type === 'hulk') {
            // Hulk walk (ROM $4030/$4106; robotron-re REVERSE.md "Hulk walk").
            // Every $BE61 frames it takes the next [frame, dx, dy] of its
            // direction table: sideways 3/4 px a step, up/down 2 lines.
            // After (rand & $1F) + 1 steps, or when the next step would leave
            // the playfield, it rehomes on the other axis toward its target.
            // Indestructible; killing humans on contact is handled in
            // gameLogic collision checks.
            const hulk = enemy as any;
            if (hulk.walkTable === undefined) {
                hulk.walkTable = null;
                hulk.walkIdx = 0;
                hulk.stepTimer = 0;
                hulk.target = pickHulkTarget();
                hulkRehome(hulk, currentPlayer);
            }
            hulk.stepTimer -= delta;
            while (hulk.stepTimer <= 0) {
                hulk.stepTimer += WavePacing.params.hulkStepFrames;   // $BE61: 8 frames on wave 2 at difficulty 5, faster later
                const table = HULK_WALK[hulk.walkTable as HulkDir];
                const [rec, dx, dy] = table[hulk.walkIdx];
                hulk.walkIdx = (hulk.walkIdx + 1) % table.length;
                showFrame(hulk.sprite, HULK_ATLAS[rec]);
                const nx = hulk.position.x + dx, ny = hulk.position.y + dy;
                const pfh = GameConfig.PLAYFIELD;
                const { hw: hhw, hh: hhh } = spriteHalfExtents(hulk.sprite);
                if (nx < pfh.LEFT + hhw || nx > pfh.RIGHT - hhw || ny < pfh.TOP + hhh || ny > pfh.BOTTOM - hhh) {
                    hulkRehome(hulk, currentPlayer);
                    continue;
                }
                hulk.position.x = nx; hulk.position.y = ny;
                hulk.sprite.x = nx; hulk.sprite.y = ny;
                if (--hulk.walkSteps <= 0) hulkRehome(hulk, currentPlayer);
            }
        } else if (enemy.type === 'spheroid') {
            // Arcade spheroid ($5168): floats for prng_le($BE60) 10-frame
            // cycles, then drops an enforcer every prng_le($BE60/4) 16-frame
            // cycles (held while 8 are alive) until its ceil(prng_le($BE5E)/2)
            // are out, then flies off a side edge and is gone, unscored.
            const spheroid = enemy as Spheroid;

            if (!spheroid.leaving) {
                if (!spheroid.dx || !spheroid.dy || Math.random() < 0.01) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    spheroid.dx = Math.cos(randomAngle) * spheroid.speed;
                    spheroid.dy = Math.sin(randomAngle) * spheroid.speed;
                }
                spheroid.dropTimer -= delta;
                if (spheroid.dropTimer <= 0) {
                    if (!spheroid.dropping) {
                        spheroid.dropping = true;
                    } else if (liveEnforcers < MAX_ENFORCERS) {
                        createEnforcer(spheroid.sprite.x, spheroid.sprite.y);
                        SoundManager.play('enforcerSpawn');
                        liveEnforcers++;
                        if (--spheroid.dropsLeft <= 0) {
                            spheroid.leaving = true;
                            spheroid.dx = prng.step() & 0x80 ? -SPHEROID_EXIT_SPEED : SPHEROID_EXIT_SPEED;
                            spheroid.dy = 0;
                        }
                    }
                    spheroid.dropTimer = WavePacing.prngLe(wp.spheroidDropTimer >> 2) * SPHEROID_DROP_CYCLE_FRAMES;
                }
            }

            spheroid.update(delta);
            if (spheroid.leaving) {
                if (pastPlayfieldEdge(spheroid)) {
                    spheroid.sprite.destroy();
                    enemies.splice(i, 1);
                    continue;
                }
            } else {
                bounceInPlayfield(spheroid);
            }

            // Shimmer: the arcade spheroid pulses through the color-cycled
            // palette entries (red -> orange -> yellow -> white). The atlas
            // bakes those pixels near-white, so tint-cycle at runtime.
            spheroid.pulseTimer += (spheroid.pulseRate || 0.1) * delta;
            const SHIMMER = [0xFF2222, 0xFF8822, 0xFFFF44, 0xFFFFFF];
            spheroid.sprite.tint = SHIMMER[Math.floor(spheroid.pulseTimer * 4) % SHIMMER.length];
            spheroid.sprite.alpha = 1;
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
            clampToPlayfield(enforcer.position, enforcer.sprite);
            enforcer.sprite.x = enforcer.position.x;
            enforcer.sprite.y = enforcer.position.y;
            // $5404: a spark every prng_le($BE5F) 3-frame passes, up to 20 live
            enforcer.shootTimer -= delta;
            if (enforcer.shootTimer <= 0) {
                enforcer.shootTimer += WavePacing.prngLe(wp.enforcerShotTimer) * ENFORCER_PASS_FRAMES;
                if (currentPlayer.isAlive && countProjectiles('enforcer_shot') < MAX_SPARKS) {
                    // spark: lead-aim with PRNG spread (enforcer_aim >>3 jitter)
                    const sx = currentPlayer.sprite.x + prng.range(-14, 14);
                    const sy = currentPlayer.sprite.y + prng.range(-14, 14);
                    Projectiles.createEnforcerProjectile(enforcer.sprite.x, enforcer.sprite.y, sx, sy);
                }
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

            // brain_move_ctrl ($5BEE): one step every $BE63 frames. X moves a
            // byte (2 px) when more than 2 bytes off target; Y moves a line
            // every step. It faces sideways whenever it moves sideways, else
            // up or down, one frame of the 0,1,0,2 cycle per step. Each step counts down to a cruise missile, re-armed
            // with prng_le($BE62); at most 8 fly at once ($6006).
            brain.stepTimer -= delta;
            while (brain.stepTimer <= 0) {
                brain.stepTimer += wp.brainStepFrames;
                const dxBytes = Math.round((targetX - brain.position.x) / 2);
                const sx = Math.abs(dxBytes) > 2 ? Math.sign(dxBytes) : 0;
                const sy = targetY >= brain.position.y ? 1 : -1;
                brain.position.x += 2 * sx;
                brain.position.y += sy;
                brainFacing(brain, sx, sy);
                if (--brain.missileSteps <= 0) {
                    brain.missileSteps = WavePacing.prngLe(wp.brainMissileTimer);
                    if (currentPlayer && currentPlayer.isAlive && currentPlayer.sprite && !(currentPlayer.sprite as any)._destroyed
                        && countProjectiles('brain_shot') < MAX_MISSILES) {
                        // $6041: from the brain's top-left + 3 bytes, 4 lines
                        const { hw: bw, hh: bh } = spriteHalfExtents(brain.sprite);
                        Projectiles.createBrainProjectile(brain.position.x - bw + 6, brain.position.y - bh + 4, currentPlayer.sprite.x, currentPlayer.sprite.y);
                    }
                }
            }
            clampToPlayfield(brain.position, brain.sprite);
            brain.sprite.x = brain.position.x;
            brain.sprite.y = brain.position.y;
        } else if (enemy.type === 'tank') {
            // Tank ($8D63/$8D99): materializes for 48 frames, then a pass every
            // 2 frames. Each pass steps 1 px in x and 1 px in y (none when
            // within 16 lines of its aim point). Every 1-32 passes it re-aims:
            // at the player 97/256 of the time, else at a random point. A
            // shell every $BE64 passes, up to 21 live ($8E46).
            const tank = enemy as Tank;
            if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            if (tank.materialize > 0) { tank.materialize -= delta; continue; }
            tank.passTimer -= delta;
            while (tank.passTimer <= 0) {
                tank.passTimer += TANK_PASS_FRAMES;
                if (--tank.retarget <= 0) {
                    const pf = GameConfig.PLAYFIELD;
                    const aimPlayer = prng.step() <= 0x60;
                    const tx = aimPlayer ? currentPlayer.sprite.x : prng.range(pf.LEFT, pf.RIGHT);
                    const ty = aimPlayer ? currentPlayer.sprite.y : prng.range(pf.TOP, pf.BOTTOM);
                    tank.stepX = tx >= tank.position.x ? 1 : -1;
                    tank.stepY = Math.abs(ty - tank.position.y) < 16 ? 0 : (ty >= tank.position.y ? 1 : -1);
                    tank.retarget = (prng.step() & 31) + 1;
                }
                tank.position.x += tank.stepX;
                tank.position.y += tank.stepY;
                if (--tank.shootTimer <= 0) {
                    tank.shootTimer = wp.tankShotTimer;
                    if (currentPlayer.isAlive && countProjectiles('tank_shell') < MAX_SHELLS) {
                        // aim point: player + PRNG jitter of -16..15 bytes / lines
                        const ax = currentPlayer.sprite.x + ((prng.step() & 31) - 16) * 2;
                        const ay = currentPlayer.sprite.y + (prng.step() & 31) - 16;
                        Projectiles.createTankShell(tank.position.x, tank.position.y, ax, ay, 8192 / wp.tankShellSpeed);
                    }
                }
            }
            const before = { x: tank.position.x, y: tank.position.y };
            clampToPlayfield(tank.position, tank.sprite);
            if (tank.position.x !== before.x || tank.position.y !== before.y) tank.retarget = 0;  // hit a wall: re-aim
            tank.sprite.x = tank.position.x;
            tank.sprite.y = tank.position.y;
        } else if (enemy.type === 'prog_enemy') {
            const prog = enemy as ProgEnemy;
             if (!currentPlayer || !currentPlayer.sprite || (currentPlayer.sprite as any)._destroyed) continue;
            const angle = Math.atan2(currentPlayer.sprite.y - prog.sprite.y, currentPlayer.sprite.x - prog.sprite.x);
            // Update logical position first
            prog.position.x += Math.cos(angle) * prog.speed * delta;
            prog.position.y += Math.sin(angle) * prog.speed * delta;
            // Apply boundary constraints to logical position
            clampToPlayfield(prog.position, prog.sprite);
            // Update sprite to match logical position
            prog.sprite.x = prog.position.x;
            prog.sprite.y = prog.position.y;
        } else if (enemy.type === 'quark') {
            // Quark ($8B36): drifts at prng_le($BE67)/32 px per frame on each
            // axis, re-rolled every 1-32 3-frame passes. After prng_le($BE66)
            // 15-frame cycles it drops a tank every prng_le($BE66/2+1) passes
            // (held at 20 live tanks) until its ceil(prng_le($BE5E)/2) are out,
            // then flies off the top or bottom and is gone, unscored.
            const quark = enemy as Quark;
            if (!quark.leaving) {
                quark.moveTimer -= delta;
                if (quark.moveTimer <= 0) {
                    quark.moveTimer = ((prng.step() & 31) + 1) * QUARK_PASS_FRAMES;
                    quark.dx = WavePacing.prngLe(wp.quarkSpeed) / 32 * (prng.step() & 0x80 ? -1 : 1);
                    quark.dy = WavePacing.prngLe(wp.quarkSpeed) / 32 * (prng.step() & 0x80 ? -1 : 1);
                }
                quark.dropTimer -= delta;
                if (quark.dropTimer <= 0) {
                    if (!quark.dropping) {
                        quark.dropping = true;
                    } else if (liveTanks < MAX_TANKS) {
                        createTank(quark.sprite.x, quark.sprite.y);
                        liveTanks++;
                        if (--quark.dropsLeft <= 0) {
                            quark.leaving = true;
                            quark.dx = 0;
                            quark.dy = prng.step() & 0x80 ? -QUARK_EXIT_SPEED : QUARK_EXIT_SPEED;
                        }
                    }
                    quark.dropTimer = WavePacing.prngLe((wp.quarkDropTimer >> 1) + 1) * QUARK_PASS_FRAMES;
                }
            }
            quark.update(delta);
            if (quark.leaving) {
                if (pastPlayfieldEdge(quark)) {
                    quark.sprite.destroy();
                    enemies.splice(i, 1);
                    continue;
                }
            } else {
                bounceInPlayfield(quark);
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
