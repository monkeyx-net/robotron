(function() {
    function createExplosion(x, y, color = 0xFFFFFF) {
        if (!window.PIXI || !window.effectsContainer) {
            console.warn("Effects.createExplosion: Missing PIXI or effectsContainer.");
            return;
        }

        const numParticles = 16;
        const numRings = 2;

        for (let ring = 0; ring < numRings; ring++) {
            const ringSpeed = ring === 0 ? 3 : 2;
            const ringLife = ring === 0 ? 15 : 25;

            for (let i = 0; i < numParticles; i++) {
                const particle = new window.PIXI.Graphics();
                const size = ring === 0 ? Math.random() * 2 + 2 : Math.random() * 1.5 + 1;

                particle.beginFill(color);
                if (ring === 0) {
                    particle.moveTo(0, -size);
                    particle.lineTo(size, 0);
                    particle.lineTo(0, size);
                    particle.lineTo(-size, 0);
                } else {
                    particle.drawCircle(0, 0, size);
                }
                particle.endFill();

                particle.x = x; particle.y = y;
                const angle = (i / numParticles) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
                const speed = ringSpeed + Math.random();
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;

                particle.life = ringLife + Math.random() * 10;
                particle.maxLife = particle.life;
                particle.rotation = Math.random() * Math.PI * 2;
                particle.rotationSpeed = (Math.random() - 0.5) * 0.2;

                window.effectsContainer.addChild(particle);
            }
        }
    }

    function updateEffects(delta) {
        if (!window.effectsContainer) {
            // console.warn("Effects.updateEffects: Missing effectsContainer.");
            return;
        }
        for (let i = window.effectsContainer.children.length - 1; i >= 0; i--) {
            const particle = window.effectsContainer.children[i];
            if (particle.life !== undefined) {
                particle.vx *= 0.98;
                particle.vy *= 0.98;
                particle.x += particle.vx * delta;
                particle.y += particle.vy * delta;

                const lifePercent = particle.life / particle.maxLife;
                particle.alpha = Math.min(1, lifePercent * 2);

                if (particle.rotationSpeed) {
                    particle.rotation += particle.rotationSpeed * delta;
                }

                particle.scale.set(0.8 + lifePercent * 0.2);

                particle.life -= delta;
                if (particle.life <= 0) {
                    window.effectsContainer.removeChildAt(i);
                    particle.destroy();
                }
            }
        }
    }

    window.Effects = {
        createExplosion,
        updateEffects
    };

})();
