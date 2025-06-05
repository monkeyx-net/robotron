(function() {
    // Assumes window.PIXI, window.GameConfig, window.SoundManager,
    // window.playerProjectilesContainer, window.enemyProjectilesContainer,
    // window.playerProjectiles, window.enemyProjectiles, window.gameState are available.

    function createPlayerProjectile(x, y, dx, dy) {
        if (!window.GameConfig || !window.PIXI || !window.playerProjectilesContainer || !window.playerProjectiles || !window.SoundManager) {
            console.warn("Projectiles.createPlayerProjectile: Missing dependencies.");
            return;
        }
        if (window.playerProjectiles.length >= window.GameConfig.MAX_PLAYER_PROJECTILES) return;

        const projectileSprite = new window.PIXI.Graphics();
        projectileSprite.beginFill(0xFFFF00);
        projectileSprite.drawRect(-1, -2, 2, 4);
        projectileSprite.endFill();
        projectileSprite.x = x;
        projectileSprite.y = y;
        window.playerProjectilesContainer.addChild(projectileSprite);
        window.playerProjectiles.push({
            sprite: projectileSprite,
            dx: dx * window.GameConfig.PROJECTILE_SPEED,
            dy: dy * window.GameConfig.PROJECTILE_SPEED
        });
        window.SoundManager.play('shoot');
    }

    function createEnforcerProjectile(x, y, targetX, targetY) {
        if (!window.GameConfig || !window.PIXI || !window.enemyProjectilesContainer || !window.enemyProjectiles || !window.SoundManager) {
            console.warn("Projectiles.createEnforcerProjectile: Missing dependencies.");
            return;
        }
        const projectileSprite = new window.PIXI.Graphics();
        projectileSprite.beginFill(0x00FFFF);
        projectileSprite.moveTo(0, -3); projectileSprite.lineTo(2, 0);
        projectileSprite.lineTo(0, 3); projectileSprite.lineTo(-2, 0);
        projectileSprite.closePath();
        projectileSprite.endFill();
        projectileSprite.x = x; projectileSprite.y = y;
        const angle = Math.atan2(targetY - y, targetX - x);
        window.enemyProjectilesContainer.addChild(projectileSprite);
        window.enemyProjectiles.push({
            sprite: projectileSprite, type: 'enforcer_shot',
            dx: Math.cos(angle) * window.GameConfig.ENFORCER_PROJECTILE_SPEED,
            dy: Math.sin(angle) * window.GameConfig.ENFORCER_PROJECTILE_SPEED
        });
        window.SoundManager.play('enforcerFire');
    }

    function createBrainProjectile(x, y, targetX, targetY) {
        if (!window.GameConfig || !window.PIXI || !window.enemyProjectilesContainer || !window.enemyProjectiles || !window.SoundManager) {
            console.warn("Projectiles.createBrainProjectile: Missing dependencies.");
            return;
        }
        const projectileSprite = new window.PIXI.Graphics();
        projectileSprite.beginFill(0xFF88FF);
        projectileSprite.drawCircle(0,0,3);
        projectileSprite.endFill();
        projectileSprite.x = x; projectileSprite.y = y;
        const angle = Math.atan2(targetY - y, targetX - x);
        window.enemyProjectilesContainer.addChild(projectileSprite);
        window.enemyProjectiles.push({
            sprite: projectileSprite, type: 'brain_shot',
            dx: Math.cos(angle) * window.GameConfig.BRAIN_PROJECTILE_SPEED,
            dy: Math.sin(angle) * window.GameConfig.BRAIN_PROJECTILE_SPEED
        });
        window.SoundManager.play('brainFire');
    }

    function createTankShell(x, y, targetX, targetY) {
        if (!window.GameConfig || !window.PIXI || !window.enemyProjectilesContainer || !window.enemyProjectiles || !window.SoundManager) {
            console.warn("Projectiles.createTankShell: Missing dependencies.");
            return;
        }
        const shellSprite = new window.PIXI.Graphics();
        shellSprite.beginFill(0x888888);
        shellSprite.drawCircle(0,0,4);
        shellSprite.endFill();
        shellSprite.x = x; shellSprite.y = y;
        const angle = Math.atan2(targetY - y, targetX - x);
        window.enemyProjectilesContainer.addChild(shellSprite);
        window.enemyProjectiles.push({
            sprite: shellSprite, type: 'tank_shell',
            dx: Math.cos(angle) * window.GameConfig.TANK_SHELL_SPEED,
            dy: Math.sin(angle) * window.GameConfig.TANK_SHELL_SPEED,
            bouncesLeft: window.GameConfig.TANK_SHELL_BOUNCES
        });
        window.SoundManager.play('tankFire');
    }

    function updatePlayerProjectiles(delta) {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.playerProjectiles || !window.GameConfig) {
            return;
        }
        for (let i = window.playerProjectiles.length - 1; i >= 0; i--) {
            const p = window.playerProjectiles[i];
            if (!p || !p.sprite || p.sprite._destroyed) {
                window.playerProjectiles.splice(i, 1);
                continue;
            }
            p.sprite.x += p.dx * delta;
            p.sprite.y += p.dy * delta;
            if (p.sprite.x < 0 || p.sprite.x > window.GameConfig.GAME_WIDTH || p.sprite.y < 0 || p.sprite.y > window.GameConfig.GAME_HEIGHT) {
                if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                window.playerProjectiles.splice(i, 1);
            }
        }
    }

    function updateEnemyProjectiles(delta) {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.enemyProjectiles || !window.GameConfig || !window.SoundManager) {
            return;
        }
        for (let i = window.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = window.enemyProjectiles[i];
            if (!p || !p.sprite || p.sprite._destroyed) {
                window.enemyProjectiles.splice(i, 1);
                continue;
            }
            p.sprite.x += p.dx * delta;
            p.sprite.y += p.dy * delta;

            if (p.type === 'tank_shell') {
                let bounced = false;
                if (p.sprite.x <= 0 || p.sprite.x >= window.GameConfig.GAME_WIDTH) {
                    if (p.bouncesLeft > 0) {
                        p.dx *= -1; p.bouncesLeft--; bounced = true;
                        p.sprite.x = Math.max(1, Math.min(window.GameConfig.GAME_WIDTH - 1, p.sprite.x));
                    } else {
                        if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                        window.enemyProjectiles.splice(i, 1); continue;
                    }
                }
                if (p.sprite.y <= 0 || p.sprite.y >= window.GameConfig.GAME_HEIGHT) {
                     if (p.bouncesLeft > 0) {
                        p.dy *= -1; p.bouncesLeft--; bounced = true;
                        p.sprite.y = Math.max(1, Math.min(window.GameConfig.GAME_HEIGHT - 1, p.sprite.y));
                    } else {
                        if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                        window.enemyProjectiles.splice(i, 1); continue;
                    }
                }
                if (bounced) window.SoundManager.play('shellBounce');
            } else {
                if (p.sprite.x < -10 || p.sprite.x > window.GameConfig.GAME_WIDTH + 10 || p.sprite.y < -10 || p.sprite.y > window.GameConfig.GAME_HEIGHT + 10) {
                    if (p.sprite && !p.sprite._destroyed) p.sprite.destroy();
                    window.enemyProjectiles.splice(i, 1);
                }
            }
        }
    }

    window.Projectiles = {
        createPlayerProjectile,
        createEnforcerProjectile,
        createBrainProjectile,
        createTankShell,
        updatePlayerProjectiles,
        updateEnemyProjectiles
    };

})();
