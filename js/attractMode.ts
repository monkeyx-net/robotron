import { GameConfig } from './config';
import { demoPlayContainer, demoPlayer, setDemoPlayer, enemies } from './main';
import { Enemy } from './enemiesClasses';
import { UI } from './ui';
import { loadHighScore, clearEntities, checkCollisions } from './gameLogic';
import { Player, createPlayer } from './player';
import { Projectiles } from './projectiles';
import { Enemies, createGrunt, createHulk, createBrain } from './enemies';
import { Humans, createHuman } from './humans';
import { Obstacles } from './obstacles';
import { gameState } from './gameState';

let attractModeTimer = 0;
let insertCoinFlashTimer = 0;

function findNearestEnemyForDemo(playerInstance: Player, enemyList: Enemy[]): Enemy | null {
    if(!playerInstance || !playerInstance.sprite || !enemyList || enemyList.length === 0) return null;
    let nearest: Enemy | null = null;
    let minDistSq = Infinity;
    enemyList.forEach(enemy => {
        if (enemy.sprite && !enemy._destroyed && !enemy.indestructible) {
            const distSq = Math.pow(playerInstance.sprite.x - (enemy as Enemy).sprite.x, 2) + Math.pow(playerInstance.sprite.y - (enemy as Enemy).sprite.y, 2);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = enemy;
            }
        }
    });
    return nearest;
}

function updateDemoPlayerAI(delta: number) {
    if (!demoPlayer || !demoPlayer.isAlive || !demoPlayer.sprite || demoPlayer._destroyed || !GameConfig || !Projectiles) {
        return;
    }

    (demoPlayer as any).aiMoveTimer -= delta;
    if ((demoPlayer as any).aiMoveTimer <= 0) {
        demoPlayer.dx = (Math.random() - 0.5) * 2;
        demoPlayer.dy = (Math.random() - 0.5) * 2;
        const len = Math.hypot(demoPlayer.dx, demoPlayer.dy);
        if (len > 0) { demoPlayer.dx /= len; demoPlayer.dy /= len; }
        (demoPlayer as any).aiMoveTimer = (60 + Math.random() * 60);
    }

    (demoPlayer as any).aiShootTimer -= delta;
    if ((demoPlayer as any).aiShootTimer <= 0) {
        const nearestEnemy = findNearestEnemyForDemo(demoPlayer, enemies);
        let shootDx = (Math.random() - 0.5) * 2;
        let shootDy = (Math.random() - 0.5) * 2;

        if (nearestEnemy) {
            const angleToEnemy = Math.atan2((nearestEnemy as Enemy).sprite.y - demoPlayer.sprite.y, (nearestEnemy as Enemy).sprite.x - demoPlayer.sprite.x);
            shootDx = Math.cos(angleToEnemy);
            shootDy = Math.sin(angleToEnemy);
        }

        const shootLen = Math.hypot(shootDx, shootDy);
        if(shootLen > 0) {
            Projectiles.createPlayerProjectile(demoPlayer.sprite.x, demoPlayer.sprite.y, shootDx/shootLen, shootDy/shootLen);
        }
        (demoPlayer as any).aiShootTimer = ((demoPlayer as any).shootDelay || 90) + Math.random() * 30;
    }

    const nearestEnemy = findNearestEnemyForDemo(demoPlayer, enemies);
    if (nearestEnemy && Math.hypot((demoPlayer as Player).sprite.x - (nearestEnemy as Enemy).sprite.x, (demoPlayer as Player).sprite.y - (nearestEnemy as Enemy).sprite.y) < 50) {
        const angleAway = Math.atan2(demoPlayer.sprite.y - nearestEnemy.sprite.y, demoPlayer.sprite.x - nearestEnemy.sprite.x);
        demoPlayer.dx = Math.cos(angleAway);
        demoPlayer.dy = Math.sin(angleAway);
    }
}

function hideDemoPlayScreenLogic() {
    if (demoPlayContainer) demoPlayContainer.visible = false;
    if (demoPlayer && demoPlayer.sprite && !(demoPlayer.sprite as any)._destroyed) {
        demoPlayer.destroy();
    }
    setDemoPlayer(null); // Use setter function
}

function showTitleScreen() {
    if (!UI || !GameConfig) { console.warn("Attract.showTitleScreen: Missing dependencies."); return; }

    const messageBox = document.getElementById('message-box');
    if(messageBox) messageBox.style.display = 'none';

    gameState.currentGameState = 'TITLE_SCREEN';
    if(UI.hideHighScoreDisplayScreen) UI.hideHighScoreDisplayScreen();
    hideDemoPlayScreenLogic();

    clearEntities();
    loadHighScore();
    if(UI.setupTitleScreen) UI.setupTitleScreen();

    attractModeTimer = GameConfig.TITLE_SCREEN_DURATION || 300;
    if (window.location.hash === '#test') attractModeTimer = 1;
    if (UI.resizeGame) UI.resizeGame();
}

function showHighScoreDisplayScreen() {
    if (!UI || !GameConfig) { console.warn("Attract.showTitleScreen: Missing dependencies."); return; }

    const messageBox = document.getElementById('message-box');
    if(messageBox) messageBox.style.display = 'none';

    gameState.currentGameState = 'HIGH_SCORE_DISPLAY_SCREEN';
    if(UI.hideTitleScreen) UI.hideTitleScreen();
    hideDemoPlayScreenLogic();

    clearEntities();
    loadHighScore();
    if(UI.setupHighScoreDisplayScreen) UI.setupHighScoreDisplayScreen();

    attractModeTimer = GameConfig.HIGH_SCORE_DURATION || 180;
    if (UI.resizeGame) UI.resizeGame();
}

function showDemoPlayScreen() {
    if (!UI || !Player || !Enemies || !Humans || !GameConfig || !demoPlayContainer) {
        console.warn("Attract.showDemoPlayScreen: Missing dependencies."); return;
    }

    const messageBox = document.getElementById('message-box');
    if(messageBox) messageBox.style.display = 'none';

    gameState.currentGameState = 'DEMO_PLAY';
    if(UI.hideTitleScreen) UI.hideTitleScreen();
    if(UI.hideHighScoreDisplayScreen) UI.hideHighScoreDisplayScreen();

    clearEntities();

    demoPlayContainer.visible = true;

    setDemoPlayer(createPlayer());
    if (demoPlayer) {
        (demoPlayer as any).isDemoPlayer = true;
        (demoPlayer as any).speed = (GameConfig.PLAYER_SPEED || 2) * 0.4;
        if(demoPlayer.sprite) {
             const pf = GameConfig.PLAYFIELD;
             demoPlayer.sprite.x = pf.LEFT + (pf.RIGHT - pf.LEFT) * 0.25;
             demoPlayer.sprite.y = pf.TOP + (pf.BOTTOM - pf.TOP) * 0.5;
        }
        (demoPlayer as any).aiMoveTimer = 0;
        (demoPlayer as any).aiShootTimer = 0;
        (demoPlayer as any).shootDelay = 90;
    } else {
        console.error("Attract.showDemoPlayScreen: Failed to create demoPlayer.");
        showTitleScreen();
        return;
    }

    const pf = GameConfig.PLAYFIELD;
    const px = (f: number) => pf.LEFT + (pf.RIGHT - pf.LEFT) * f;
    const py = (f: number) => pf.TOP + (pf.BOTTOM - pf.TOP) * f;
    if(createGrunt) createGrunt(px(0.75), py(0.25));
    if(createHulk) createHulk(px(0.7), py(0.6));
    if(createBrain) createBrain(px(0.75), py(0.75));
    if(createHuman) createHuman(px(0.6), py(0.3));

    gameState.score = 0;
    if (UI && UI.updateScoreDisplay) UI.updateScoreDisplay();

    attractModeTimer = GameConfig.DEMO_PLAY_DURATION || 450;
    if (UI.resizeGame) UI.resizeGame();
}

function updateAttractMode(delta: number) {
    if (!GameConfig || !UI ) { return; }

    if (gameState.currentGameState === 'TITLE_SCREEN') {
        insertCoinFlashTimer += delta;
        if (UI.insertCoinText && typeof UI.insertCoinText.visible !== 'undefined') {
            UI.insertCoinText.visible = Math.floor(insertCoinFlashTimer / (GameConfig.INSERT_COIN_FLASH_INTERVAL || 30)) % 2 === 0;
        }
        if (UI.pressStartText && typeof UI.pressStartText.visible !== 'undefined') {
            UI.pressStartText.visible = Math.floor(insertCoinFlashTimer / (GameConfig.INSERT_COIN_FLASH_INTERVAL || 30)) % 2 === 0;
        }

        attractModeTimer -= delta;
        if (attractModeTimer <= 0) {
            showHighScoreDisplayScreen();
        }
    } else if (gameState.currentGameState === 'HIGH_SCORE_DISPLAY_SCREEN') {
        attractModeTimer -= delta;
        if (attractModeTimer <= 0) {
            showDemoPlayScreen();
        }
    } else if (gameState.currentGameState === 'DEMO_PLAY') {
        if (demoPlayer && demoPlayer.isAlive) {
            updateDemoPlayerAI(delta);

            if (Player && demoPlayer instanceof Player) (demoPlayer as Player).update(delta);
            if (Projectiles) {
                if (Projectiles.updatePlayerProjectiles) Projectiles.updatePlayerProjectiles(delta);
                if (Projectiles.updateEnemyProjectiles) Projectiles.updateEnemyProjectiles(delta);
            }
            if (Enemies && Enemies.updateEnemies) Enemies.updateEnemies(delta);
            if (Humans && Humans.updateHumansAndProgs) Humans.updateHumansAndProgs(delta);
            if (Obstacles && Obstacles.updateObstacles) Obstacles.updateObstacles(delta);
            checkCollisions();

            attractModeTimer -= delta;
            if (attractModeTimer <= 0) {
                showTitleScreen();
            }
        } else {
            showTitleScreen();
        }
    }
}

export const Attract = {
    showTitleScreen,
    showHighScoreDisplayScreen,
    showDemoPlayScreen,
    updateAttractMode
};
