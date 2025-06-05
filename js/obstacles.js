(function() {
    function createElectrode(x, y, width, height, color = 0xFFFF00) {
        if (!window.PIXI || !window.obstaclesContainer || !window.obstacles) {
            console.warn("Obstacles.createElectrode: Missing PIXI, obstaclesContainer, or obstacles array.");
            return;
        }
        const electrodeSprite = new window.PIXI.Graphics();
        electrodeSprite.beginFill(color);
        electrodeSprite.drawRect(-width/2, -height/2, width, height);
        electrodeSprite.endFill();
        electrodeSprite.x = x;
        electrodeSprite.y = y;
        window.obstaclesContainer.addChild(electrodeSprite);
        window.obstacles.push({
            sprite: electrodeSprite,
            type: 'electrode',
            indestructible: true,
            flashTimer: 0
        });
    }

    function updateObstacles(delta) {
        if (typeof window.gameState === 'undefined' || (window.gameState !== 'PLAYING' && window.gameState !== 'DEMO_PLAY')) {
            return;
        }
        if (!window.obstacles || !window.GameConfig) {
            // console.warn("Obstacles.updateObstacles: Missing obstacles array or GameConfig.");
            return;
        }

        for (let i = window.obstacles.length - 1; i >= 0; i--) {
            const obstacle = window.obstacles[i];
            if (!obstacle || !obstacle.sprite || obstacle.sprite._destroyed) {
                window.obstacles.splice(i, 1);
                continue;
            }
            if (obstacle.type === 'electrode') {
                obstacle.flashTimer += window.GameConfig.ELECTRODE_FLASH_RATE * delta;
                const flashPhase = obstacle.flashTimer % (Math.PI * 4);
                const baseFlash = Math.sin(flashPhase);
                const rapidFlash = Math.sin(flashPhase * 3) * 0.3;

                obstacle.sprite.alpha = 0.7 + (baseFlash + rapidFlash) * 0.3;

                const colorPhase = (1 + Math.sin(flashPhase * 0.5)) * 0.5;
                if (window.PIXI && window.PIXI.utils) {
                     obstacle.sprite.tint = window.PIXI.utils.rgb2hex([1, 1, 0.6 + colorPhase * 0.4]);
                }
            }
        }
    }

    window.Obstacles = {
        createElectrode,
        updateObstacles
    };

})();
