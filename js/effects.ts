import * as PIXI from 'pixi.js';
import { effectsContainer } from './main';

interface Particle extends PIXI.Graphics {
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    rotationSpeed: number;
    fill: (color: number | { color: number; alpha?: number }) => void;
}

function createExplosion(x: number, y: number, color: number = 0xFFFFFF) {
    if (!PIXI || !effectsContainer) {
        console.warn("Effects.createExplosion: Missing PIXI or effectsContainer.");
        return;
    }

    const numParticles = 16;
    const numRings = 2;

    for (let ring = 0; ring < numRings; ring++) {
        const ringSpeed = ring === 0 ? 3 : 2;
        const ringLife = ring === 0 ? 15 : 25;

        for (let i = 0; i < numParticles; i++) {
            const particle = new PIXI.Graphics() as Particle;
            const size = ring === 0 ? Math.random() * 2 + 2 : Math.random() * 1.5 + 1;

            if (ring === 0) {
                particle.moveTo(0, -size);
                particle.lineTo(size, 0);
                particle.lineTo(0, size);
                particle.lineTo(-size, 0);
                particle.closePath();
                particle.beginFill(color);
                particle.endFill();
            } else {
                particle.beginFill(color);
                particle.drawCircle(0, 0, size);
                particle.endFill();
            }

            particle.x = x; particle.y = y;
            const angle = (i / numParticles) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const speed = ringSpeed + Math.random();
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;

            particle.life = ringLife + Math.random() * 10;
            particle.maxLife = particle.life;
            particle.rotation = Math.random() * Math.PI * 2;
            particle.rotationSpeed = (Math.random() - 0.5) * 0.2;

            effectsContainer.addChild(particle);
        }
    }
}

function updateEffects(delta: number) {
    if (!effectsContainer) {
        // console.warn("Effects.updateEffects: Missing effectsContainer.");
        return;
    }
    for (let i = effectsContainer.children.length - 1; i >= 0; i--) {
        const particle = effectsContainer.children[i] as Particle;
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
                effectsContainer.removeChildAt(i);
                particle.destroy();
            }
        }
    }
}

export const Effects = {
    createExplosion,
    updateEffects
};
