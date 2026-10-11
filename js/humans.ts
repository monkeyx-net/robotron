import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { app, humansContainer, effectsContainer, player, humanTexture, obstacles } from './main';
import { humansAndProgs } from './main';
import { SoundManager } from './soundManager';
import { Human, Prog } from './humanClasses';
import { ArcadeAtlas } from './core/ArcadeAtlas';
import { isEntityGone, clampToPlayfield, spriteHalfExtents } from './gameObject';

// Simple collision detection function for humans vs obstacles
function checkObstacleCollision(x: number, y: number, radius: number = 12): boolean {
    if (!obstacles || obstacles.length === 0) return false;

    for (const obstacle of obstacles) {
        if (!obstacle || obstacle._destroyed || !obstacle.sprite) continue;

        // Simple rectangular collision detection
        const obstacleLeft = obstacle.sprite.x - obstacle.sprite.width / 2;
        const obstacleRight = obstacle.sprite.x + obstacle.sprite.width / 2;
        const obstacleTop = obstacle.sprite.y - obstacle.sprite.height / 2;
        const obstacleBottom = obstacle.sprite.y + obstacle.sprite.height / 2;

        // Check if human (with radius) would collide with obstacle
        if (x + radius > obstacleLeft &&
            x - radius < obstacleRight &&
            y + radius > obstacleTop &&
            y - radius < obstacleBottom) {
            return true;
        }
    }
    return false;
}

// Human types as specified in requirements
const HUMAN_TYPES = {
    MAN: { color: 0xF0F0F0, name: 'Man' },      // Light gray instead of pure white
    WOMAN: { color: 0xFF69B4, name: 'Woman' },  // Pink dress
    CHILD: { color: 0x40E0D0, name: 'Child' }   // Teal outfit
};


function createTestSprite() {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x00FF00);
    graphics.drawRect(0, 0, 20, 20);
    graphics.endFill();
    graphics.x = 100;
    graphics.y = 100;

    humansContainer.addChild(graphics);
    console.log('[Humans.createTestSprite] Added test sprite to container');
    return null;
}

function createRescueEffect(x: number, y: number) {
    const effect = new PIXI.Graphics();
    effect.beginFill(0x00FF00, 0.8);
    effect.drawCircle(0, 0, 5);
    effect.endFill();
    effect.x = x;
    effect.y = y;
    effect.scale.set(1);

    if (effectsContainer) {
        effectsContainer.addChild(effect);

        let scale = 1;
        let alpha = 0.8;
        const animate = () => {
            scale += 0.3;
            alpha -= 0.05;
            effect.scale.set(scale);
            effect.alpha = alpha;

            if (alpha <= 0) {
                if (effect.parent) {
                    effect.parent.removeChild(effect);
                }
            } else {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }
}

export function createHuman(x: number, y: number, humanType: string | null = null): Human | null {
    console.log("[Humans.createHuman] === STARTING HUMAN CREATION ===");
    console.log("[Humans.createHuman] Called with x:", x, "y:", y, "type:", humanType);

    if (!PIXI || !humansContainer || !humansAndProgs || !GameConfig || !GameConfig.HUMAN_SPEED) {
        console.warn("[Humans.createHuman] FAILED: Missing dependencies.");
        return null;
    }

    try {
        console.log('[Humans.createHuman] Creating human using stage sprite');

        if (!humanType) {
            const types = Object.keys(HUMAN_TYPES);
            humanType = types[Math.floor(Math.random() * types.length)];
        }
        const typeInfo = (HUMAN_TYPES as any)[humanType] || HUMAN_TYPES.MAN;
        console.log('[Humans.createHuman] Human type selected:', typeInfo.name, 'color:', typeInfo.color.toString(16));

        // ROM-extracted per-type walk animations: MAN = daddy, WOMAN = mommy,
        // CHILD = mikey (each 12 frames = 3-frame walk x 4 directions).
        const family = humanType === 'MAN' ? 'daddy' : humanType === 'CHILD' ? 'mikey' : 'mommy';
        const atlasWalk = ArcadeAtlas.frames(family);
        let humanSprite: PIXI.Sprite;
        if (atlasWalk.length) {
            const anim = new PIXI.AnimatedSprite(atlasWalk.slice(0, 3));
            anim.animationSpeed = 0.08;
            anim.play();
            humanSprite = anim;
        } else if (humanTexture) {
            humanSprite = new PIXI.Sprite(humanTexture);
        } else {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(typeInfo.color);
            graphics.drawRect(0, 0, 16, 16);
            graphics.endFill();
            const texture = app.renderer.generateTexture(graphics);
            graphics.destroy();
            humanSprite = new PIXI.Sprite(texture);
        }
        humanSprite.anchor.set(0.5); // Center the sprite
        humanSprite.x = x;
        humanSprite.y = y;
        humanSprite.visible = true;
        humanSprite.alpha = 1;
        humanSprite.scale.set(1); // Normal size

        console.log('[Humans.createHuman] Sprite created:', {
            x: humanSprite.x,
            y: humanSprite.y,
            type: typeInfo.name,
            color: typeInfo.color.toString(16),
            width: humanSprite.width,
            height: humanSprite.height,
            visible: humanSprite.visible,
            alpha: humanSprite.alpha,
            hasParent: !!humanSprite.parent,
            destroyed: (humanSprite as any)._destroyed || false
        });

        humansContainer.addChild(humanSprite);
        console.log('[Humans.createHuman] Added to humansContainer. Container children:', humansContainer.children.length);

        const spriteInContainer = humansContainer.children.includes(humanSprite);
        console.log('[Humans.createHuman] Sprite verification:', {
            inContainer: spriteInContainer,
            hasParent: !!humanSprite.parent,
            parentType: humanSprite.parent ? humanSprite.parent.constructor.name : 'none',
            destroyed: (humanSprite as any)._destroyed || false
        });

        const human = new Human(humanSprite, x, y, humanType, GameConfig.HUMAN_SPEED);

        // Set initial random target so humans start moving in different directions
        const initialAngle = Math.random() * Math.PI * 2;
        const initialDistance = 20 + Math.random() * 40;
        human.targetX = x + Math.cos(initialAngle) * initialDistance;
        human.targetY = y + Math.sin(initialAngle) * initialDistance;

        // Ensure initial targets are within the arena (yellow border inset)
        const pf = GameConfig.PLAYFIELD;
        const inset = 4;
        human.targetX = Math.max(pf.LEFT + inset, Math.min(pf.RIGHT - inset, human.targetX));
        human.targetY = Math.max(pf.TOP + inset, Math.min(pf.BOTTOM - inset, human.targetY));

        // Ensure human starts with a short timer so it begins moving quickly
        human.wanderTimer = Math.random() * 30 + 10; // 10-40 frames (very short initial delay)

        console.log('[Humans.createHuman] Human movement setup:', {
            initialPos: { x: x, y: y },
            target: { x: human.targetX.toFixed(1), y: human.targetY.toFixed(1) },
            wanderTimer: human.wanderTimer.toFixed(1),
            speed: human.speed
        });

        console.log('[Humans.createHuman] About to add to humansAndProgs array. Current length:', humansAndProgs.length);
        humansAndProgs.push(human);
        console.log('[Humans.createHuman] Added to array. New length:', humansAndProgs.length);

        console.log('[Humans.createHuman] === HUMAN CREATION COMPLETE ===');
        console.log('[Humans.createHuman] Final human object:', {
            hasSprite: !!human.sprite,
            spriteX: human.sprite.x,
            spriteY: human.sprite.y,
            spriteVisible: human.sprite.visible,
            spriteOnStage: app.stage.children.includes(human.sprite),
            totalHumans: humansAndProgs.length
        });

        return human;

    } catch (error: unknown) {
        console.error("[Humans.createHuman] ERROR during creation:", error);
        if (error instanceof Error) {
            console.error("[Humans.createHuman] Stack trace:", error.stack);
        }
        return null;
    }
}

export function convertToProg(humanEntity: Human) {
    if (!humanEntity || humanEntity.type === 'prog' || humanEntity._destroyed) return;

    console.log('[Humans.convertToProg] Converting human to prog');

    const progSprite = new PIXI.Graphics();
    progSprite.lineStyle(1, 0x4B0082);
    progSprite.beginFill(0xFF00FF);
    progSprite.drawRect(-8, -8, 16, 16);
    progSprite.endFill();

    progSprite.x = humanEntity.sprite.x;
    progSprite.y = humanEntity.sprite.y;

    humanEntity.destroy(); // Destroy the old human sprite

    const prog = new Prog(progSprite, progSprite.x, progSprite.y, (GameConfig && GameConfig.POINTS) ? GameConfig.POINTS.PROG : 100);
    humansContainer.addChild(prog.sprite);

    // Find and replace the human in the array with the new prog object
    const index = humansAndProgs.indexOf(humanEntity);
    if (index !== -1) {
        humansAndProgs[index] = prog;
    }

    prog.reprogramTimer = 2000;

    if (SoundManager && SoundManager.play) {
        SoundManager.play('humanToProg');
    }

    console.log('[Humans.convertToProg] Human converted to prog, will become evil in 2 seconds');
}

export function updateHumansAndProgs(delta: number) {
    if (!humansAndProgs || !GameConfig || !humansContainer) {
        return;
    }

    const initialHumansCount = humansAndProgs.length;
    const filteredHumansAndProgs = humansAndProgs.filter(entity => !isEntityGone(entity));
    humansAndProgs.length = 0; // Clear the original array
    humansAndProgs.push(...filteredHumansAndProgs); // Add filtered elements back

    if (humansAndProgs.length !== initialHumansCount) {
        console.log(`[Humans.updateHumansAndProgs] Filtered out ${initialHumansCount - humansAndProgs.length} destroyed entities`);
    }

    humansAndProgs.forEach(entity => {
        if (isEntityGone(entity)) return;

        if (entity instanceof Human) {
            // Check if human has been rescued
            if (entity.isRescued) {
                console.log('[Humans.updateHumansAndProgs] Removing rescued human');
                entity.destroy();
                const index = humansAndProgs.indexOf(entity);
                if (index !== -1) {
                    humansAndProgs.splice(index, 1);
                }
                return;
            }

            entity.wanderTimer -= delta;

            // Set new target when wander timer expires
            if (entity.wanderTimer <= 0) {
                // Always pick a new random direction - no pausing
                const angle = Math.random() * Math.PI * 2;
                const distance = 30 + Math.random() * 50; // Moderate wander distances
                let newTargetX = entity.sprite.x + Math.cos(angle) * distance;
                let newTargetY = entity.sprite.y + Math.sin(angle) * distance;

                // Keep targets within the arena (yellow border inset)
                const pf = GameConfig.PLAYFIELD;
                const inset = 4;
                newTargetX = Math.max(pf.LEFT + inset, Math.min(pf.RIGHT - inset, newTargetX));
                newTargetY = Math.max(pf.TOP + inset, Math.min(pf.BOTTOM - inset, newTargetY));

                entity.targetX = newTargetX;
                entity.targetY = newTargetY;
                entity.wanderTimer = Math.random() * 180 + 120; // Shorter intervals (2-5 seconds)
            }

            // Move toward target at slow pace
            const dx = entity.targetX - entity.sprite.x;
            const dy = entity.targetY - entity.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 1) {
                // Slow movement speed as per requirements
                const moveSpeed = entity.speed * delta;
                const moveX = (dx / distance) * moveSpeed;
                const moveY = (dy / distance) * moveSpeed;

                // Calculate new position
                let newX = entity.sprite.x + moveX;
                let newY = entity.sprite.y + moveY;

                // Check for obstacle collision before moving
                if (checkObstacleCollision(newX, newY, 12)) {
                    // Hit an obstacle - pick a new target after a pause
                    entity.wanderTimer = Math.random() * 60 + 30; // Short pause before new direction
                    return; // Don't move this frame
                }

                // Simple boundary collision against the arena border
                // (sprite edge, not center — the sprite must not overlap it)
                const pf = GameConfig.PLAYFIELD;
                const { hw, hh } = spriteHalfExtents(entity.sprite);
                if (newX < pf.LEFT + hw || newX > pf.RIGHT - hw) {
                    newX = Math.max(pf.LEFT + hw, Math.min(pf.RIGHT - hw, newX));
                    entity.wanderTimer = 0; // Pick new direction
                }
                if (newY < pf.TOP + hh || newY > pf.BOTTOM - hh) {
                    newY = Math.max(pf.TOP + hh, Math.min(pf.BOTTOM - hh, newY));
                    entity.wanderTimer = 0; // Pick new direction
                }

                entity.sprite.x = newX;
                entity.sprite.y = newY;
            } else {
                // Reached target, pick a new one immediately to keep moving
                entity.wanderTimer = 0;
            }

            // Debug logging (remove after testing)
            if (Math.random() < 0.01) { // Only log occasionally to avoid spam
                console.log('[Humans] Human moving:', {
                    currentPos: { x: entity.sprite.x.toFixed(1), y: entity.sprite.y.toFixed(1) },
                    target: { x: entity.targetX.toFixed(1), y: entity.targetY.toFixed(1) },
                    distance: distance.toFixed(1),
                    speed: entity.speed,
                    delta: delta.toFixed(3),
                    wanderTimer: entity.wanderTimer.toFixed(1)
                });
            }
        } else if (entity instanceof Prog) {
            if (entity.reprogramTimer > 0) {
                entity.reprogramTimer -= delta;
                if (entity.reprogramTimer <= 0) {
                    entity.isEvil = true;
                    if (entity.sprite instanceof PIXI.Graphics) {
                        entity.sprite.clear();
                        entity.sprite.beginFill(0xFF0000);
                        entity.sprite.drawRect(-8, -8, 16, 16);
                        entity.sprite.endFill();
                    }

                    if (SoundManager && SoundManager.play) {
                        SoundManager.play('progActivate');
                    }
                }
            }

            if (entity.isEvil && player && player.sprite && !(player.sprite as any)._destroyed) {
                const angle = Math.atan2(
                    player.sprite.y - entity.sprite.y,
                    player.sprite.x - entity.sprite.x
                );
                const progSpeed = (GameConfig.PROG_SPEED || 1.3) * delta;
                entity.sprite.x += Math.cos(angle) * progSpeed;
                entity.sprite.y += Math.sin(angle) * progSpeed;
            }

            entity.flashTimer += 0.15 * delta;
            const flashIntensity = 0.4 + Math.sin(entity.flashTimer) * 0.4;
            entity.sprite.alpha = Math.max(0.2, flashIntensity);
        }

        clampToPlayfield(entity.sprite, entity.sprite);
    });

    const finalContainerChildren = humansContainer.children.length;
    if (finalContainerChildren !== initialHumansCount) {
        console.log(`[Humans.updateHumansAndProgs] Container children changed from ${initialHumansCount} to ${finalContainerChildren}`);
    }
}

export const Humans = {
    createHuman,
    convertToProg,
    updateHumansAndProgs,
    createRescueEffect,
    createTestSprite,
    HUMAN_TYPES
};
