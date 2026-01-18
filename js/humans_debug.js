(function() {
    // Human types as specified in requirements
    const HUMAN_TYPES = {
        MAN: { color: 0xF0F0F0, name: 'Man' },      // Light gray instead of pure white
        WOMAN: { color: 0xFF69B4, name: 'Woman' },  // Pink dress
        CHILD: { color: 0x40E0D0, name: 'Child' }   // Teal outfit
    };

    function createFallbackTexture() {
        // Create a more visible fallback texture - a colored rectangle
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xFF0000); // Bright red for maximum visibility
        graphics.drawRect(0, 0, 16, 16); // Larger size
        graphics.endFill();
        
        const texture = window.app.renderer.generateTexture(graphics);
        console.log('[Humans.createFallbackTexture] Created fallback texture:', {
            width: texture.width,
            height: texture.height
        });
        
        return texture;
    }

    function createHuman(x, y, humanType = null) {
        console.log("[Humans.createHuman] === STARTING HUMAN CREATION ===");
        console.log("[Humans.createHuman] Called with x:", x, "y:", y, "type:", humanType);

        // Basic dependency checks
        if (!window.PIXI) {
            console.warn("[Humans.createHuman] FAILED: window.PIXI is missing.");
            return null;
        }
        if (!window.humansContainer) {
            console.warn("[Humans.createHuman] FAILED: window.humansContainer is missing.");
            return null;
        }
        if (!window.humansAndProgs) {
            console.warn("[Humans.createHuman] FAILED: window.humansAndProgs array is missing.");
            return null;
        }
        if (!window.GameConfig || !window.GameConfig.HUMAN_SPEED) {
            console.warn("[Humans.createHuman] FAILED: window.GameConfig or HUMAN_SPEED is missing.");
            return null;
        }

        try {
            console.log('[Humans.createHuman] Creating human using stage sprite');
            
            // Assign human type and color first
            if (!humanType) {
                const types = Object.keys(HUMAN_TYPES);
                humanType = types[Math.floor(Math.random() * types.length)];
            }
            const typeInfo = HUMAN_TYPES[humanType] || HUMAN_TYPES.MAN;
            console.log('[Humans.createHuman] Human type selected:', typeInfo.name, 'color:', typeInfo.color.toString(16));
            
            // Create Graphics object to generate texture from
            const graphics = new PIXI.Graphics();
            graphics.beginFill(typeInfo.color);
            graphics.drawRect(0, 0, 16, 16);
            graphics.endFill();
            console.log('[Humans.createHuman] Graphics object created');
            
            // Generate texture from graphics
            const texture = window.app.renderer.generateTexture(graphics);
            console.log('[Humans.createHuman] Texture generated:', {
                width: texture.width,
                height: texture.height,
                valid: texture.valid
            });
            
            // Create sprite from the generated texture
            const humanSprite = new PIXI.Sprite(texture);
            humanSprite.x = x;
            humanSprite.y = y;
            humanSprite.visible = true;
            humanSprite.alpha = 1;
            
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
                destroyed: humanSprite._destroyed || false
            });

            // Add to stage
            console.log('[Humans.createHuman] About to add to stage. Current stage children:', window.app.stage.children.length);
            window.app.stage.addChild(humanSprite);
            console.log('[Humans.createHuman] Added to stage. New stage children:', window.app.stage.children.length);
            
            // Verify sprite is actually on stage
            const spriteOnStage = window.app.stage.children.includes(humanSprite);
            console.log('[Humans.createHuman] Sprite verification:', {
                onStage: spriteOnStage,
                hasParent: !!humanSprite.parent,
                parentType: humanSprite.parent ? humanSprite.parent.constructor.name : 'none',
                destroyed: humanSprite._destroyed || false
            });

            // Create human object with proper movement timers
            const human = {
                sprite: humanSprite,
                type: 'human',
                humanType: humanType,
                isEvil: false,
                isRescued: false,
                isStopped: false,
                speed: window.GameConfig.HUMAN_SPEED,
                targetX: x,
                targetY: y,
                wanderTimer: Math.random() * 2000 + 1000,
                stopTimer: Math.random() * 1500 + 500,
                reprogramTimer: 0,
                flashTimer: 0,
                createdAt: Date.now() // Add timestamp for debugging
            };

            // Set initial wander target
            human.targetX = x + (Math.random() - 0.5) * 50;
            human.targetY = y + (Math.random() - 0.5) * 50;

            // Add to array
            console.log('[Humans.createHuman] About to add to humansAndProgs array. Current length:', window.humansAndProgs.length);
            window.humansAndProgs.push(human);
            console.log('[Humans.createHuman] Added to array. New length:', window.humansAndProgs.length);

            console.log('[Humans.createHuman] === HUMAN CREATION COMPLETE ===');
            console.log('[Humans.createHuman] Final human object:', {
                hasSprite: !!human.sprite,
                spriteX: human.sprite.x,
                spriteY: human.sprite.y,
                spriteVisible: human.sprite.visible,
                spriteOnStage: window.app.stage.children.includes(human.sprite),
                totalHumans: window.humansAndProgs.length
            });
            
            return human;
            
        } catch (error) {
            console.error("[Humans.createHuman] ERROR during creation:", error);
            console.error("[Humans.createHuman] Stack trace:", error.stack);
            return null;
        }
    }

    function updateHumansAndProgs(delta) {
        if (!window.humansAndProgs || !window.GameConfig || !window.humansContainer) {
            return;
        }

        console.log('[Humans.updateHumansAndProgs] === UPDATE CYCLE START ===');
        console.log('[Humans.updateHumansAndProgs] Initial humans count:', window.humansAndProgs.length);
        
        // Log each human's state before processing
        window.humansAndProgs.forEach((entity, i) => {
            if (entity && entity.sprite) {
                console.log(`[Humans.updateHumansAndProgs] Human ${i} state:`, {
                    type: entity.type,
                    isRescued: entity.isRescued,
                    spriteExists: !!entity.sprite,
                    spriteDestroyed: entity.sprite._destroyed || false,
                    spriteVisible: entity.sprite.visible,
                    spriteOnStage: window.app.stage.children.includes(entity.sprite),
                    spriteX: entity.sprite.x,
                    spriteY: entity.sprite.y,
                    ageMs: entity.createdAt ? Date.now() - entity.createdAt : 'unknown'
                });
            } else {
                console.log(`[Humans.updateHumansAndProgs] Human ${i} is null or missing sprite`);
            }
        });

        // Clean up destroyed sprites and handle rescued humans
        const initialHumansCount = window.humansAndProgs.length;
        window.humansAndProgs = window.humansAndProgs.filter((entity, i) => {
            if (!entity || !entity.sprite || entity.sprite._destroyed) {
                console.log(`[Humans.updateHumansAndProgs] Removing destroyed entity at index ${i}`);
                return false;
            }
            
            // Handle rescued humans
            if (entity.isRescued) {
                console.log(`[Humans.updateHumansAndProgs] Processing rescued human at index ${i}`);
                
                // Visual feedback - brief flash before removal
                if (entity.sprite.clear) {
                    entity.sprite.clear();
                    entity.sprite.beginFill(0x00FF00); // Green flash
                    entity.sprite.drawRect(0, 0, 16, 16);
                    entity.sprite.endFill();
                    console.log('[Humans.updateHumansAndProgs] Applied green flash to rescued human');
                }
                
                // Remove sprite after brief delay
                setTimeout(() => {
                    if (entity.sprite && entity.sprite.parent) {
                        console.log('[Humans.updateHumansAndProgs] Removing rescued human sprite from parent');
                        entity.sprite.parent.removeChild(entity.sprite);
                    } else {
                        console.log('[Humans.updateHumansAndProgs] Rescued human sprite has no parent to remove from');
                    }
                }, 100);
                
                return false; // Remove from array
            }
            
            return true;
        });
        
        if (window.humansAndProgs.length !== initialHumansCount) {
            console.log(`[Humans.updateHumansAndProgs] Filtered out ${initialHumansCount - window.humansAndProgs.length} entities`);
        }

        // Process remaining humans
        console.log('[Humans.updateHumansAndProgs] Processing', window.humansAndProgs.length, 'remaining humans');
        
        console.log('[Humans.updateHumansAndProgs] === UPDATE CYCLE END ===');
        console.log('[Humans.updateHumansAndProgs] Final humans count:', window.humansAndProgs.length);
    }

    function convertToProg(humanEntity) {
        if (!humanEntity || humanEntity.type === 'prog' || !humanEntity.sprite || humanEntity.sprite._destroyed) return;
        
        console.log('[Humans.convertToProg] Converting human to prog');
        
        // Update entity properties
        humanEntity.type = 'prog';
        humanEntity.health = 1;
        humanEntity.points = (window.GameConfig && window.GameConfig.POINTS) ? window.GameConfig.POINTS.PROG : 100;
        humanEntity.flashTimer = 0;
        humanEntity.isEvil = false; // Start as non-evil, will become evil after timer
        humanEntity.reprogramTimer = 2000; // 2 second delay before becoming evil
        
        // Update sprite appearance for Graphics object
        if (humanEntity.sprite.clear) {
            humanEntity.sprite.clear();
            humanEntity.sprite.beginFill(0xFF00FF); // Magenta for newly converted prog
            humanEntity.sprite.drawRect(0, 0, 16, 16);
            humanEntity.sprite.endFill();
        }
        
        // Play conversion sound
        if (window.SoundManager && window.SoundManager.play) {
            window.SoundManager.play('humanToProg');
        }
        
        console.log('[Humans.convertToProg] Human converted to prog, will become evil in 2 seconds');
    }

    // Export the module
    const HumansModule = {
        createHuman,
        convertToProg,
        updateHumansAndProgs,
        HUMAN_TYPES
    };
    
    window.Humans = HumansModule;
    console.log('[Humans] DEBUG MODULE initialized with extensive logging');
})();
