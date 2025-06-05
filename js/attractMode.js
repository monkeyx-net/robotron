(function() {
    let attractModeTimer = 0;
    let insertCoinFlashTimer = 0;

    function findNearestEnemyForDemo(player, enemyList) {
        if(!player || !player.sprite || !enemyList || enemyList.length === 0) return null;
        let nearest = null;
        let minDistSq = Infinity;
        enemyList.forEach(enemy => {
            if (enemy && enemy.sprite && !enemy.sprite._destroyed && !enemy.indestructible) {
                const distSq = Math.pow(player.sprite.x - enemy.sprite.x, 2) + Math.pow(player.sprite.y - enemy.sprite.y, 2);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = enemy;
                }
            }
        });
        return nearest;
    }

    function updateDemoPlayerAI(delta) {
        if (!window.demoPlayer || !window.demoPlayer.isAlive || !window.demoPlayer.sprite || window.demoPlayer.sprite._destroyed || !window.GameConfig || !window.Projectiles) {
            return;
        }

        window.demoPlayer.aiMoveTimer -= delta;
        if (window.demoPlayer.aiMoveTimer <= 0) {
            window.demoPlayer.dx = (Math.random() - 0.5) * 2;
            window.demoPlayer.dy = (Math.random() - 0.5) * 2;
            const len = Math.hypot(window.demoPlayer.dx, window.demoPlayer.dy);
            if (len > 0) { window.demoPlayer.dx /= len; window.demoPlayer.dy /= len; }
            window.demoPlayer.aiMoveTimer = (60 + Math.random() * 60);
        }

        window.demoPlayer.aiShootTimer -= delta;
        if (window.demoPlayer.aiShootTimer <= 0) {
            const nearestEnemy = findNearestEnemyForDemo(window.demoPlayer, window.enemies);
            let shootDx = (Math.random() - 0.5) * 2;
            let shootDy = (Math.random() - 0.5) * 2;

            if (nearestEnemy) {
                const angleToEnemy = Math.atan2(nearestEnemy.sprite.y - window.demoPlayer.sprite.y, nearestEnemy.sprite.x - window.demoPlayer.sprite.x);
                shootDx = Math.cos(angleToEnemy);
                shootDy = Math.sin(angleToEnemy);
            }

            const shootLen = Math.hypot(shootDx, shootDy);
            if(shootLen > 0) {
                window.Projectiles.createPlayerProjectile(window.demoPlayer.sprite.x, window.demoPlayer.sprite.y, shootDx/shootLen, shootDy/shootLen);
            }
            window.demoPlayer.aiShootTimer = (window.demoPlayer.shootDelay || 90) + Math.random() * 30;
        }

        const nearestEnemy = findNearestEnemyForDemo(window.demoPlayer, window.enemies);
        if (nearestEnemy && Math.hypot(window.demoPlayer.sprite.x - nearestEnemy.sprite.x, window.demoPlayer.sprite.y - nearestEnemy.sprite.y) < 50) {
            const angleAway = Math.atan2(window.demoPlayer.sprite.y - nearestEnemy.sprite.y, window.demoPlayer.sprite.x - nearestEnemy.sprite.x);
            window.demoPlayer.dx = Math.cos(angleAway);
            window.demoPlayer.dy = Math.sin(angleAway);
        }
    }

    function hideDemoPlayScreenLogic() {
        if (window.demoPlayContainer) window.demoPlayContainer.visible = false;
        if (window.demoPlayer && window.demoPlayer.sprite && !window.demoPlayer.sprite._destroyed) {
            window.demoPlayer.sprite.destroy();
        }
        window.demoPlayer = null;
    }

    function showTitleScreen() {
        if (!window.UI || !window.GameLogic || !window.GameConfig) { console.warn("Attract.showTitleScreen: Missing dependencies."); return; }

        const messageBox = document.getElementById('message-box');
        if(messageBox) messageBox.style.display = 'none';

        window.gameState = 'TITLE_SCREEN';
        if(window.UI.hideHighScoreDisplayScreen) window.UI.hideHighScoreDisplayScreen();
        hideDemoPlayScreenLogic();

        if(window.GameLogic.clearEntities) window.GameLogic.clearEntities();
        if(window.GameLogic.loadHighScore) window.GameLogic.loadHighScore();
        if(window.UI.setupTitleScreen) window.UI.setupTitleScreen();

        insertCoinFlashTimer = 0;
        attractModeTimer = window.GameConfig.TITLE_SCREEN_DURATION || 300;
        if (window.location.hash === '#test') attractModeTimer = 1;
        if (window.UI.resizeGame) window.UI.resizeGame();
    }

    function showHighScoreDisplayScreen() {
        if (!window.UI || !window.GameLogic || !window.GameConfig) { console.warn("Attract.showHighScoreDisplayScreen: Missing dependencies."); return; }

        const messageBox = document.getElementById('message-box');
        if(messageBox) messageBox.style.display = 'none';

        window.gameState = 'HIGH_SCORE_DISPLAY_SCREEN';
        if(window.UI.hideTitleScreen) window.UI.hideTitleScreen();
        hideDemoPlayScreenLogic();

        if(window.GameLogic.clearEntities) window.GameLogic.clearEntities();
        if(window.GameLogic.loadHighScore) window.GameLogic.loadHighScore();
        if(window.UI.setupHighScoreDisplayScreen) window.UI.setupHighScoreDisplayScreen();

        attractModeTimer = window.GameConfig.HIGH_SCORE_DURATION || 180;
        if (window.UI.resizeGame) window.UI.resizeGame();
    }

    function showDemoPlayScreen() {
        if (!window.UI || !window.GameLogic || !window.Player || !window.Enemies || !window.Humans || !window.GameConfig || !window.demoPlayContainer) {
            console.warn("Attract.showDemoPlayScreen: Missing dependencies."); return;
        }

        const messageBox = document.getElementById('message-box');
        if(messageBox) messageBox.style.display = 'none';

        window.gameState = 'DEMO_PLAY';
        if(window.UI.hideTitleScreen) window.UI.hideTitleScreen();
        if(window.UI.hideHighScoreDisplayScreen) window.UI.hideHighScoreDisplayScreen();

        if(window.GameLogic.clearEntities) window.GameLogic.clearEntities();

        window.demoPlayContainer.visible = true;

        window.demoPlayer = window.Player.createPlayer();
        if (window.demoPlayer) {
            window.demoPlayer.isDemoPlayer = true;
            window.demoPlayer.speed = (window.GameConfig.PLAYER_SPEED || 2) * 0.4;
            if(window.demoPlayer.sprite) {
                 window.demoPlayer.sprite.x = window.GameConfig.GAME_WIDTH / 4;
                 window.demoPlayer.sprite.y = window.GameConfig.GAME_HEIGHT / 2;
            }
            window.demoPlayer.aiMoveTimer = 0;
            window.demoPlayer.aiShootTimer = 0;
            window.demoPlayer.shootDelay = 90;
        } else {
            console.error("Attract.showDemoPlayScreen: Failed to create demoPlayer.");
            showTitleScreen();
            return;
        }

        if(window.Enemies.createGrunt) window.Enemies.createGrunt(window.GameConfig.GAME_WIDTH * 0.75, window.GameConfig.GAME_HEIGHT * 0.25);
        if(window.Enemies.createHulk) window.Enemies.createHulk(window.GameConfig.GAME_WIDTH * 0.7, window.GameConfig.GAME_HEIGHT * 0.6);
        if(window.Enemies.createBrain) window.Enemies.createBrain(window.GameConfig.GAME_WIDTH * 0.75, window.GameConfig.GAME_HEIGHT * 0.75);
        if(window.Humans.createHuman) window.Humans.createHuman(window.GameConfig.GAME_WIDTH * 0.6, window.GameConfig.GAME_HEIGHT * 0.3);

        window.score = 0;
        if (window.UI && window.UI.updateScoreDisplay) window.UI.updateScoreDisplay();

        attractModeTimer = window.GameConfig.DEMO_PLAY_DURATION || 450;
        if (window.UI.resizeGame) window.UI.resizeGame();
    }

    function updateAttractMode(delta) {
        if (!window.GameConfig || !window.UI ) { return; }

        if (window.gameState === 'TITLE_SCREEN') {
            insertCoinFlashTimer += delta;
            // Check if UI elements exist before trying to set visible property
            if (window.UI.insertCoinText && typeof window.UI.insertCoinText.visible !== 'undefined') {
                window.UI.insertCoinText.visible = Math.floor(insertCoinFlashTimer / (window.GameConfig.INSERT_COIN_FLASH_INTERVAL || 30)) % 2 === 0;
            }
            if (window.UI.pressStartText && typeof window.UI.pressStartText.visible !== 'undefined') {
                window.UI.pressStartText.visible = Math.floor(insertCoinFlashTimer / (window.GameConfig.INSERT_COIN_FLASH_INTERVAL || 30)) % 2 === 0;
            }

            attractModeTimer -= delta;
            if (attractModeTimer <= 0) {
                showHighScoreDisplayScreen();
            }
        } else if (window.gameState === 'HIGH_SCORE_DISPLAY_SCREEN') {
            attractModeTimer -= delta;
            if (attractModeTimer <= 0) {
                showDemoPlayScreen();
            }
        } else if (window.gameState === 'DEMO_PLAY') {
            if (window.demoPlayer && window.demoPlayer.isAlive) {
                updateDemoPlayerAI(delta);

                if (window.Player && window.Player.updatePlayer) window.Player.updatePlayer(window.demoPlayer, delta);
                if (window.Projectiles) {
                    if (window.Projectiles.updatePlayerProjectiles) window.Projectiles.updatePlayerProjectiles(delta);
                    if (window.Projectiles.updateEnemyProjectiles) window.Projectiles.updateEnemyProjectiles(delta);
                }
                if (window.Enemies && window.Enemies.updateEnemies) window.Enemies.updateEnemies(delta);
                if (window.Humans && window.Humans.updateHumansAndProgs) window.Humans.updateHumansAndProgs(delta);
                if (window.Obstacles && window.Obstacles.updateObstacles) window.Obstacles.updateObstacles(delta);
                if (window.Effects && window.Effects.updateEffects) window.Effects.updateEffects(delta);
                if (window.GameLogic && window.GameLogic.checkCollisions) window.GameLogic.checkCollisions();

                attractModeTimer -= delta;
                if (attractModeTimer <= 0) {
                    showTitleScreen();
                }
            } else {
                showTitleScreen();
            }
        }
    }

    window.Attract = {
        showTitleScreen,
        showHighScoreDisplayScreen,
        showDemoPlayScreen,
        updateAttractMode
    };

})();
