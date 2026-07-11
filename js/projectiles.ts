import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { playerProjectilesContainer, enemyProjectilesContainer, playerProjectiles, enemyProjectiles } from './main';
import { gameState } from './gameState';
import { SoundManager } from './soundManager';
import { Projectile } from './projectile';

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

export function createEnforcerProjectile(x: number, y: number, targetX: number, targetY: number): Projectile {
    if (!GameConfig || !PIXI || !enemyProjectilesContainer || !enemyProjectiles || !SoundManager) {
        console.warn("Projectiles.createEnforcerProjectile: Missing dependencies.");
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'enforcer_shot', 0, 0);
    }
    const projectileSprite = new PIXI.Graphics();
    projectileSprite.beginFill(0x00FFFF);
    projectileSprite.moveTo(0, -3); projectileSprite.lineTo(2, 0);
    projectileSprite.lineTo(0, 3); projectileSprite.lineTo(-2, 0);
    projectileSprite.closePath();
    projectileSprite.endFill();
    projectileSprite.x = x; projectileSprite.y = y;
    const angle = Math.atan2(targetY - y, targetX - x);
    enemyProjectilesContainer.addChild(projectileSprite);
    
    const newProjectile = new Projectile(projectileSprite, 'enforcer_shot', Math.cos(angle) * GameConfig.ENFORCER_PROJECTILE_SPEED, Math.sin(angle) * GameConfig.ENFORCER_PROJECTILE_SPEED);
    enemyProjectiles.push(newProjectile);
    SoundManager.play('enforcerFire');
    return newProjectile;
}

export function createBrainProjectile(x: number, y: number, targetX: number, targetY: number): Projectile {
    if (!GameConfig || !PIXI || !enemyProjectilesContainer || !enemyProjectiles || !SoundManager) {
        console.warn("Projectiles.createBrainProjectile: Missing dependencies.");
        const dummySprite = new PIXI.Graphics();
        return new Projectile(dummySprite, 'brain_shot', 0, 0);
    }
    const projectileSprite = new PIXI.Graphics();
    projectileSprite.beginFill(0xFF88FF);
    projectileSprite.drawCircle(0,0,3);
    projectileSprite.endFill();
    projectileSprite.x = x; projectileSprite.y = y;
    const angle = Math.atan2(targetY - y, targetX - x);
    enemyProjectilesContainer.addChild(projectileSprite);
    
    const newProjectile = new Projectile(projectileSprite, 'brain_shot', Math.cos(angle) * GameConfig.BRAIN_PROJECTILE_SPEED, Math.sin(angle) * GameConfig.BRAIN_PROJECTILE_SPEED);
    enemyProjectiles.push(newProjectile);
    SoundManager.play('brainFire');
    return newProjectile;
}

export function createTankShell(x: number, y: number, targetX: number, targetY: number): Projectile {
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
    const angle = Math.atan2(targetY - y, targetX - x);
    enemyProjectilesContainer.addChild(shellSprite);
    
    const newProjectile = new Projectile(shellSprite, 'tank_shell', Math.cos(angle) * GameConfig.TANK_SHELL_SPEED, Math.sin(angle) * GameConfig.TANK_SHELL_SPEED, GameConfig.TANK_SHELL_BOUNCES);
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
        if (p.sprite.x < 0 || p.sprite.x > GameConfig.GAME_WIDTH || p.sprite.y < 0 || p.sprite.y > GameConfig.GAME_HEIGHT) {
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
        // Brain CRUISE missile: homes on the player with a sinusoidal
        // wiggle perpendicular to its heading (arcade behavior).
        if (p.type === 'brain_shot') {
            const cm = p as any;
            if (cm.wigglePhase === undefined) cm.wigglePhase = 0;
            cm.wigglePhase += 0.35 * delta;
            const spd = GameConfig.BRAIN_PROJECTILE_SPEED || 2;
            const heading = Math.atan2(p.dy, p.dx);
            const wiggle = Math.sin(cm.wigglePhase) * spd * 0.9;
            p.sprite.x += Math.cos(heading) * spd * delta + Math.cos(heading + Math.PI / 2) * wiggle * delta;
            p.sprite.y += Math.sin(heading) * spd * delta + Math.sin(heading + Math.PI / 2) * wiggle * delta;
            if (p.sprite.x < -10 || p.sprite.x > GameConfig.GAME_WIDTH + 10 || p.sprite.y < -10 || p.sprite.y > GameConfig.GAME_HEIGHT + 10) {
                p.destroy();
                enemyProjectiles.splice(i, 1);
            }
            continue;
        }

        p.update(delta);

        if (p.type === 'tank_shell') {
            let bounced = false;
            if (p.sprite.x <= 0 || p.sprite.x >= GameConfig.GAME_WIDTH) {
                if (p.bouncesLeft && p.bouncesLeft > 0) {
                    p.dx *= -1; p.bouncesLeft--; bounced = true;
                    p.sprite.x = Math.max(1, Math.min(GameConfig.GAME_WIDTH - 1, p.sprite.x));
                } else {
                    p.destroy();
                    enemyProjectiles.splice(i, 1); continue;
                }
            }
            if (p.sprite.y <= 0 || p.sprite.y >= GameConfig.GAME_HEIGHT) {
                 if (p.bouncesLeft && p.bouncesLeft > 0) {
                    p.dy *= -1; p.bouncesLeft--; bounced = true;
                    p.sprite.y = Math.max(1, Math.min(GameConfig.GAME_HEIGHT - 1, p.sprite.y));
                } else {
                    p.destroy();
                    enemyProjectiles.splice(i, 1); continue;
                }
            }
            if (bounced) SoundManager.play('shellBounce');
        } else {
            if (p.sprite.x < -10 || p.sprite.x > GameConfig.GAME_WIDTH + 10 || p.sprite.y < -10 || p.sprite.y > GameConfig.GAME_HEIGHT + 10) {
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
