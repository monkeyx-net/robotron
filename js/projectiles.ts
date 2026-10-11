import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { playerProjectilesContainer, enemyProjectilesContainer, playerProjectiles, enemyProjectiles, player } from './main';
import { gameState } from './gameState';
import { SoundManager } from './soundManager';
import { Projectile } from './projectile';
import { ColorCycles } from './core/ColorCycles';
import { WavePacing } from './core/WavePacing';
import { prng } from './core/Prng';
import { ArcadeAtlas } from './core/ArcadeAtlas';
import { moveBlockedAtWalls } from './gameObject';

export function createPlayerProjectile(x: number, y: number, dx: number, dy: number): Projectile {
    if (!GameConfig || !PIXI || !playerProjectilesContainer || !playerProjectiles || !SoundManager) {
        console.warn("Projectiles.createPlayerProjectile: Missing dependencies.");
        // Return a dummy projectile or throw an error
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'player_projectile', 0, 0);
    }
    if (playerProjectiles.length >= GameConfig.MAX_PLAYER_PROJECTILES) {
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'player_projectile', 0, 0);
    }

    const projectileSprite = new PIXI.Graphics();
    projectileSprite.beginFill(0xFFFF00);
    projectileSprite.drawRect(-1, -2, 2, 4);
    projectileSprite.endFill();
    projectileSprite.x = x;
    projectileSprite.y = y;
    playerProjectilesContainer.addChild(projectileSprite);
    
    const newProjectile = new Projectile(projectileSprite, 'player_projectile', dx * GameConfig.PROJECTILE_SPEED, dy * GameConfig.PROJECTILE_SPEED);
    playerProjectiles.push(newProjectile);
    SoundManager.play('shoot');
    return newProjectile;
}

// Enforcer spark (ROM $5404 spawn, $54A8 process; robotron-re REVERSE.md
// Phase 21 "Enforcers and sparks"). Aimed at the player + a random -16..15
// (bytes across, lines down; no x jitter near the left wall), with velocity
// (aim - position) x 4/256 per frame, so it would arrive in 64 frames. Every
// 4 frames it adds a fixed random impulse (-16..15 / 256) to that velocity,
// so it curves, and steps its 4-frame spin. It fizzles after (rand & 15) + 20
// passes, and slides along walls (the ROM mover, $DD09).
const SPARK_PASS_FRAMES = 4;

interface Spark { ix: number; iy: number; life: number; passTimer: number; frame: number; }

export function createEnforcerProjectile(x: number, y: number, targetX: number, targetY: number): Projectile {
    if (!GameConfig || !PIXI || !enemyProjectilesContainer || !enemyProjectiles || !SoundManager) {
        console.warn("Projectiles.createEnforcerProjectile: Missing dependencies.");
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'enforcer_shot', 0, 0);
    }
    const frames = ArcadeAtlas.frames('spark');
    let projectileSprite: PIXI.Container;
    if (frames.length === 4) {
        const spr = new PIXI.AnimatedSprite(frames);
        spr.anchor.set(0.5);
        spr.gotoAndStop(0);
        projectileSprite = spr;
    } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x00FFFF);
        g.moveTo(0, -3); g.lineTo(2, 0); g.lineTo(0, 3); g.lineTo(-2, 0);
        g.closePath(); g.endFill();
        projectileSprite = g;
    }
    projectileSprite.x = x; projectileSprite.y = y;
    enemyProjectilesContainer.addChild(projectileSprite);

    // $5431: jitter, none on x when the player is near the left wall ($5E < $17)
    const jx = targetX < 2 * 0x17 - 6 ? 0 : (prng.step() & 0x1F) - 16;
    const jy = (prng.step() & 0x1F) - 16;
    const vx = (targetX + 2 * jx - x) * 4 / 256;
    const vy = (targetY + jy - y) * 4 / 256;
    const newProjectile = new Projectile(projectileSprite as PIXI.Graphics, 'enforcer_shot', vx, vy);
    const spark: Spark = {
        ix: 2 * ((prng.step() & 0x1F) - 16) / 256,
        iy: ((prng.step() & 0x1F) - 16) / 256,
        life: (prng.step() & 0x0F) + 0x14,
        passTimer: SPARK_PASS_FRAMES,
        frame: 0,
    };
    (newProjectile as any).spark = spark;
    enemyProjectiles.push(newProjectile);
    SoundManager.play('enforcerFire');
    return newProjectile;
}

/** One frame of a spark; false when it has fizzled out. */
function updateSpark(p: Projectile, sp: Spark, delta: number): boolean {
    sp.passTimer -= delta;
    while (sp.passTimer <= 0) {
        sp.passTimer += SPARK_PASS_FRAMES;
        p.dx += sp.ix; p.dy += sp.iy;
        sp.frame = (sp.frame + 1) % 4;
        if (p.sprite instanceof PIXI.AnimatedSprite) p.sprite.gotoAndStop(sp.frame);
        if (--sp.life <= 0) return false;
    }
    moveBlockedAtWalls(p.sprite, p.sprite, p.dx * delta, p.dy * delta);
    return true;
}

// Brain cruise missile (ROM $6006 spawn, $20B0 process, $20C7 move, $207B aim;
// robotron-re REVERSE.md Phase 21 "Cruise missiles"). The head is a 2 px x 2
// line block in cycling palette entry A, and it leaves its last 8 positions as
// a trail in entry D. Every 2 frames it makes two 1-byte / 1-line moves, so it
// steps 2 px across and/or 1 line down or up per frame, reversing at the
// playfield edges (it bounces). Every prng_le(7) passes it re-aims at the
// player plus a random -6..9 bytes/lines: half the time on x (and then half
// the time on y too), otherwise on y alone, so it moves in 8 directions.
// It lives until it is shot or hits the player.
const MISSILE_PASS_FRAMES = 2;
const MISSILE_TRAIL = 8;
// $20C7 bounds on the head's top-left, as port pixels: x bytes 7..$8E, y $18..$EA
const MISSILE_X0 = 2 * 0x07 - 6, MISSILE_X1 = 2 * 0x8E - 6, MISSILE_Y0 = 0x18 - 7, MISSILE_Y1 = 0xEA - 7;

interface Missile {
    stepX: number;
    stepY: number;
    aimPasses: number;
    passTimer: number;
    trail: [number, number][];
    head: PIXI.Graphics;
    tail: PIXI.Graphics;
}

/** $207B: aim at the player (target in port pixels). */
function aimMissile(m: Missile, x: number, y: number, tx: number, ty: number): void {
    m.stepX = 0; m.stepY = 0;
    let doY = true;
    if (prng.step() & 0x80) {
        const jx = (prng.step() & 0x0F) - 6;
        m.stepX = tx + 2 * jx >= x ? 2 : -2;
        doY = !(prng.step() & 0x80);
    }
    if (doY) {
        const jy = (prng.step() & 0x0F) - 6;
        m.stepY = ty + jy >= y ? 1 : -1;
    }
    m.aimPasses = WavePacing.prngLe(7);
}

export function createBrainProjectile(x: number, y: number, targetX: number, targetY: number): Projectile {
    if (!GameConfig || !PIXI || !enemyProjectilesContainer || !enemyProjectiles || !SoundManager) {
        console.warn("Projectiles.createBrainProjectile: Missing dependencies.");
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'brain_shot', 0, 0);
    }
    // The sprite is the head's position; the trail is drawn relative to it.
    const container = new PIXI.Container();
    const tail = new PIXI.Graphics();
    const head = new PIXI.Graphics().rect(0, 0, 2, 2).fill(0xFFFFFF);
    container.addChild(tail, head);
    // every removal path calls sprite.destroy(); take the head and trail with it
    const destroyContainer = container.destroy.bind(container);
    container.destroy = () => destroyContainer({ children: true });
    container.x = Math.max(MISSILE_X0, Math.min(MISSILE_X1, Math.round(x)));
    container.y = Math.max(MISSILE_Y0, Math.min(MISSILE_Y1, Math.round(y)));
    enemyProjectilesContainer.addChild(container);

    const newProjectile = new Projectile(container as unknown as PIXI.Graphics, 'brain_shot', 0, 0);
    const m: Missile = { stepX: 0, stepY: 0, aimPasses: 0, passTimer: MISSILE_PASS_FRAMES, trail: [], head, tail };
    aimMissile(m, container.x, container.y, targetX, targetY);
    (newProjectile as any).missile = m;
    tintMissile(m);
    enemyProjectiles.push(newProjectile);
    SoundManager.play('brainFire');
    return newProjectile;
}

function tintMissile(m: Missile): void {
    m.head.tint = ColorCycles.color(0xA) ?? 0xFFFFFF;
    m.tail.tint = ColorCycles.color(0xD) ?? 0xFFFFFF;
}

/** $20C7: one move, reversing an axis that would leave the playfield. */
function moveMissile(sprite: PIXI.Container, m: Missile): void {
    m.trail.push([sprite.x, sprite.y]);
    if (m.trail.length > MISSILE_TRAIL) m.trail.shift();
    let nx = sprite.x + m.stepX;
    if (nx < MISSILE_X0 || nx > MISSILE_X1) { m.stepX = -m.stepX; nx = sprite.x + m.stepX; }
    let ny = sprite.y + m.stepY;
    if (ny < MISSILE_Y0 || ny > MISSILE_Y1) { m.stepY = -m.stepY; ny = sprite.y + m.stepY; }
    sprite.x = nx; sprite.y = ny;
}

function updateMissile(p: Projectile, m: Missile, delta: number, tx: number | null, ty: number | null): void {
    const sprite = p.sprite as unknown as PIXI.Container;
    m.passTimer -= delta;
    while (m.passTimer <= 0) {
        m.passTimer += MISSILE_PASS_FRAMES;
        if (--m.aimPasses <= 0) {
            if (tx !== null && ty !== null) aimMissile(m, sprite.x, sprite.y, tx, ty);
            else m.aimPasses = WavePacing.prngLe(7);
        }
        moveMissile(sprite, m);
        moveMissile(sprite, m);
    }
    m.tail.clear();
    for (const [x, y] of m.trail) m.tail.rect(x - sprite.x, y - sprite.y, 2, 2);
    if (m.trail.length) m.tail.fill(0xFFFFFF);
    tintMissile(m);
}

/**
 * Tank shell aimed at (targetX, targetY). With `framesToTarget` the shell
 * reaches the aim point in that many frames whatever the range, as in the
 * ROM (velocity = offset x $BE65 / 8192 per frame, $8E98); without it,
 * a fixed TANK_SHELL_SPEED.
 */
export function createTankShell(x: number, y: number, targetX: number, targetY: number, framesToTarget?: number): Projectile {
    if (!GameConfig || !PIXI || !enemyProjectilesContainer || !enemyProjectiles || !SoundManager) {
        console.warn("Projectiles.createTankShell: Missing dependencies.");
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'tank_shell', 0, 0);
    }
    const shellSprite = new PIXI.Graphics();
    shellSprite.beginFill(0x888888);
    shellSprite.drawCircle(0,0,4);
    shellSprite.endFill();
    shellSprite.x = x; shellSprite.y = y;
    let vx: number, vy: number;
    if (framesToTarget) {
        vx = (targetX - x) / framesToTarget;
        vy = (targetY - y) / framesToTarget;
        if (!vx && !vy) vy = 1;   // aim point on top of the tank: don't hang in place
    } else {
        const angle = Math.atan2(targetY - y, targetX - x);
        vx = Math.cos(angle) * GameConfig.TANK_SHELL_SPEED;
        vy = Math.sin(angle) * GameConfig.TANK_SHELL_SPEED;
    }
    enemyProjectilesContainer.addChild(shellSprite);

    const newProjectile = new Projectile(shellSprite, 'tank_shell', vx, vy, GameConfig.TANK_SHELL_BOUNCES);
    enemyProjectiles.push(newProjectile);
    SoundManager.play('tankFire');
    return newProjectile;
}

export function updatePlayerProjectiles(delta: number): void {
    if (typeof gameState === 'undefined' || (gameState.currentGameState !== 'PLAYING' && gameState.currentGameState !== 'DEMO_PLAY')) {
        return;
    }
    if (!playerProjectiles || !GameConfig) {
        return;
    }
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const p = playerProjectiles[i];
        if (!p || p._destroyed) {
            playerProjectiles.splice(i, 1);
            continue;
        }
        p.update(delta);
        const pf = GameConfig.PLAYFIELD;
        if (p.sprite.x < pf.LEFT || p.sprite.x > pf.RIGHT || p.sprite.y < pf.TOP || p.sprite.y > pf.BOTTOM) {
            p.destroy();
            playerProjectiles.splice(i, 1);
        }
    }
}

export function updateEnemyProjectiles(delta: number): void {
    if (typeof gameState === 'undefined' || (gameState.currentGameState !== 'PLAYING' && gameState.currentGameState !== 'DEMO_PLAY')) {
        return;
    }
    if (!enemyProjectiles || !GameConfig || !SoundManager) {
        return;
    }
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        if (!p || p._destroyed) {
            enemyProjectiles.splice(i, 1);
            continue;
        }
        const sp = (p as any).spark as Spark | undefined;
        if (sp) {
            if (!updateSpark(p, sp, delta)) { p.destroy(); enemyProjectiles.splice(i, 1); }
            continue;
        }
        if (p.type === 'brain_shot') {
            const m = (p as any).missile as Missile | undefined;
            if (m) {
                const pl = player && player.sprite && !(player.sprite as any).destroyed ? player.sprite : null;
                updateMissile(p, m, delta, pl ? pl.x : null, pl ? pl.y : null);
            }
            continue;
        }

        p.update(delta);

        const pf = GameConfig.PLAYFIELD;
        if (p.type === 'tank_shell') {
            let bounced = false;
            if (p.sprite.x <= pf.LEFT || p.sprite.x >= pf.RIGHT) {
                if (p.bouncesLeft && p.bouncesLeft > 0) {
                    p.dx *= -1; p.bouncesLeft--; bounced = true;
                    p.sprite.x = Math.max(pf.LEFT + 1, Math.min(pf.RIGHT - 1, p.sprite.x));
                } else {
                    p.destroy();
                    enemyProjectiles.splice(i, 1); continue;
                }
            }
            if (p.sprite.y <= pf.TOP || p.sprite.y >= pf.BOTTOM) {
                 if (p.bouncesLeft && p.bouncesLeft > 0) {
                    p.dy *= -1; p.bouncesLeft--; bounced = true;
                    p.sprite.y = Math.max(pf.TOP + 1, Math.min(pf.BOTTOM - 1, p.sprite.y));
                } else {
                    p.destroy();
                    enemyProjectiles.splice(i, 1); continue;
                }
            }
            if (bounced) SoundManager.play('shellBounce');
        } else {
            if (p.sprite.x < pf.LEFT || p.sprite.x > pf.RIGHT || p.sprite.y < pf.TOP || p.sprite.y > pf.BOTTOM) {
                p.destroy();
                enemyProjectiles.splice(i, 1);
            }
        }
    }
}

export const Projectiles = {
    createPlayerProjectile,
    createEnforcerProjectile,
    createBrainProjectile,
    createTankShell,
    updatePlayerProjectiles,
    updateEnemyProjectiles
};
