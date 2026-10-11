import * as PIXI from 'pixi.js';
import { GameConfig } from './config';
import { app, humansContainer, effectsContainer, player, humanTexture, obstacles } from './main';
import { humansAndProgs } from './main';
import { SoundManager } from './soundManager';
import { Human, Prog } from './humanClasses';
import { ArcadeAtlas } from './core/ArcadeAtlas';
import { isEntityGone, clampToPlayfield, spriteHalfExtents } from './gameObject';
import { ColorCycles } from './core/ColorCycles';
import { WavePacing } from './core/WavePacing';
import { prng } from './core/Prng';

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

// Progs (ROM $5E19/$5EAB; robotron-re REVERSE.md Phase 21 "Progs"): the
// captured human's walk frames as a solid silhouette in cycling palette entry
// A, trailing its last 6 positions in entry E. Every 3 frames it steps 4 px
// along one axis toward the player plus a random offset, re-homing on walls
// and now and then at random.
const PROG_PASS_FRAMES = 3;
const PROG_STEP = 4;
const PROG_TRAIL = 6;
const PROG_WALK = [0, 1, 0, 2];

/** $5E55: offsets from the player: -28..28 bytes across, -16..18 lines down. */
function progOffsets(p: Prog): void {
    p.offsetX = 2 * (32 - 4 * WavePacing.prngLe(0x0F));
    p.offsetY = 20 - 2 * WavePacing.prngLe(0x12);
}

/** $5E71/$5E8D: head along x or y (coin flip) toward the player + offset. */
function progHome(p: Prog): void {
    if (!player || isEntityGone(player)) return;
    if (prng.step() & 0x80) {
        const up = player.sprite.y + p.offsetY <= p.sprite.y;
        p.dirBase = up ? 9 : 6; p.stepX = 0; p.stepY = up ? -PROG_STEP : PROG_STEP;
    } else {
        const left = player.sprite.x + p.offsetX <= p.sprite.x;
        p.dirBase = left ? 0 : 3; p.stepX = left ? -PROG_STEP : PROG_STEP; p.stepY = 0;
    }
}

/** One 3-frame pass of $5EAB. */
function progPass(p: Prog): void {
    p.walk = (p.walk + 1) % PROG_WALK.length;
    const tex = p.frames[p.dirBase + PROG_WALK[p.walk]];
    const nx = p.sprite.x + p.stepX, ny = p.sprite.y + p.stepY;
    const pf = GameConfig.PLAYFIELD;
    const { hw, hh } = spriteHalfExtents(p.sprite);
    if (nx < pf.LEFT + hw || nx > pf.RIGHT - hw || ny < pf.TOP + hh || ny > pf.BOTTOM - hh) {
        progHome(p);   // walked into a wall
        return;
    }
    // leave an afterimage where it stood
    if (p.sprite instanceof PIXI.Sprite) {
        const ghost = new PIXI.Sprite(p.sprite.texture);
        ghost.anchor.set(0.5);
        ghost.x = p.sprite.x; ghost.y = p.sprite.y;
        humansContainer.addChildAt(ghost, Math.max(0, humansContainer.getChildIndex(p.sprite)));
        p.trail.push(ghost);
        if (p.trail.length > PROG_TRAIL) p.trail.shift()!.destroy();
        if (tex) p.sprite.texture = tex;
    }
    p.sprite.x = p.position.x = nx;
    p.sprite.y = p.position.y = ny;
    if (prng.step() > 0xF8) progOffsets(p);
    if (prng.step() > 0xE4) progHome(p);
}

export function convertToProg(humanEntity: Human) {
    if (!humanEntity || humanEntity.type === 'prog' || humanEntity._destroyed) return;

    const family = humanEntity.humanType === 'MAN' ? 'daddy' : humanEntity.humanType === 'CHILD' ? 'mikey' : 'mommy';
    const frames = ArcadeAtlas.frames(family).map(t => ArcadeAtlas.silhouette(t));
    const x = humanEntity.sprite.x, y = humanEntity.sprite.y;
    let body: PIXI.Sprite | PIXI.Graphics;
    if (frames.length === 12) {
        body = new PIXI.Sprite(frames[0]);
        (body as PIXI.Sprite).anchor.set(0.5);
    } else {
        body = new PIXI.Graphics().rect(-4, -7, 8, 14).fill(0xFFFFFF);
    }
    body.x = x;
    body.y = y;
    body.tint = ColorCycles.color(0xA) ?? 0xFFFFFF;

    humanEntity.destroy();

    const prog = new Prog(body, x, y, (GameConfig && GameConfig.POINTS) ? GameConfig.POINTS.PROG : 100);
    prog.frames = frames.length === 12 ? frames : [];
    prog.isEvil = true;   // the ROM's prog hunts the player at once
    prog.walk = PROG_WALK.length - 1;
    progOffsets(prog);
    progHome(prog);
    humansContainer.addChild(prog.sprite);

    const index = humansAndProgs.indexOf(humanEntity);
    if (index !== -1) humansAndProgs[index] = prog;

    if (SoundManager && SoundManager.play) SoundManager.play('humanToProg');
}

export function updateHumansAndProgs(delta: number) {
    if (!humansAndProgs || !GameConfig || !humansContainer) {
        return;
    }

    for (const e of humansAndProgs) if (e instanceof Prog && isEntityGone(e)) e.clearTrail();
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
            entity.passTimer -= delta;
            while (entity.passTimer <= 0) {
                entity.passTimer += PROG_PASS_FRAMES;
                progPass(entity);
            }
            // body in palette entry A, trail in E (all copies share E's colour)
            entity.sprite.tint = ColorCycles.color(0xA) ?? 0xFFFFFF;
            const trailColor = ColorCycles.color(0xE) ?? 0xFF00FF;
            for (const t of entity.trail) t.tint = trailColor;
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
