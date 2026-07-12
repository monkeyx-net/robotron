import { VisualEffectsSystem } from './VisualEffects';
import { EffectPresets, EffectCombinations } from './EffectPresets';
import { Vector2 } from '../utils/Vector2';
import { Constants } from '../utils/Constants';

/**
 * Visual Effects System Test Suite
 * Run in browser console to test visual effects functionality
 */
export class VisualEffectsTest {
    private static visualEffects: VisualEffectsSystem;
    
    /**
     * Initialize test suite
     */
    public static initialize(): void {
        try {
            this.visualEffects = VisualEffectsSystem.getInstance();
            console.log('🎆 Visual Effects Test Suite initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Visual Effects Test Suite:', error);
            console.log('Make sure the visual effects system is initialized first');
        }
    }
    
    /**
     * Test basic explosion effects
     */
    public static testExplosions(): void {
        console.log('🧨 Testing explosion effects...');
        
        const centerX = Constants.GAME_DIMENSIONS.CENTER_X;
        const centerY = Constants.GAME_DIMENSIONS.CENTER_Y;
        
        // Test different explosion types
        setTimeout(() => {
            console.log('Creating enemy explosion...');
            this.visualEffects.createExplosion(new Vector2(centerX - 100, centerY), 'enemy');
        }, 0);
        
        setTimeout(() => {
            console.log('Creating player explosion...');
            this.visualEffects.createExplosion(new Vector2(centerX, centerY), 'player');
        }, 1000);
        
        setTimeout(() => {
            console.log('Creating projectile explosion...');
            this.visualEffects.createExplosion(new Vector2(centerX + 100, centerY), 'projectile');
        }, 2000);
        
        console.log('✅ Explosion test sequence started');
    }
    
    /**
     * Test screen shake effects
     */
    public static testScreenShake(): void {
        console.log('📳 Testing screen shake effects...');
        
        // Light shake
        setTimeout(() => {
            console.log('Light shake...');
            this.visualEffects.startScreenShake(EffectPresets.SCREEN_SHAKE.LIGHT);
        }, 0);
        
        // Medium shake
        setTimeout(() => {
            console.log('Medium shake...');
            this.visualEffects.startScreenShake(EffectPresets.SCREEN_SHAKE.MEDIUM);
        }, 2000);
        
        // Heavy shake
        setTimeout(() => {
            console.log('Heavy shake...');
            this.visualEffects.startScreenShake(EffectPresets.SCREEN_SHAKE.HEAVY);
        }, 4000);
        
        console.log('✅ Screen shake test sequence started');
    }
    
    /**
     * Test camera effects
     */
    public static testCameraEffects(): void {
        console.log('📷 Testing camera effects...');
        
        // Flash effect
        setTimeout(() => {
            console.log('Damage flash...');
            this.visualEffects.startCameraEffect('test_flash', EffectPresets.CAMERA_EFFECTS.DAMAGE_FLASH);
        }, 0);
        
        // Zoom effect
        setTimeout(() => {
            console.log('Impact zoom...');
            this.visualEffects.startCameraEffect('test_zoom', EffectPresets.CAMERA_EFFECTS.IMPACT_ZOOM);
        }, 2000);
        
        // Heal flash
        setTimeout(() => {
            console.log('Heal flash...');
            this.visualEffects.startCameraEffect('test_heal', EffectPresets.CAMERA_EFFECTS.HEAL_FLASH);
        }, 4000);
        
        console.log('✅ Camera effects test sequence started');
    }
    
    /**
     * Test special effects
     */
    public static testSpecialEffects(): void {
        console.log('✨ Testing special effects...');
        
        const centerX = Constants.GAME_DIMENSIONS.CENTER_X;
        const centerY = Constants.GAME_DIMENSIONS.CENTER_Y;
        
        // Human rescue effect
        setTimeout(() => {
            console.log('Human rescue effect...');
            this.visualEffects.createRescueEffect(new Vector2(centerX - 50, centerY));
        }, 0);
        
        // Spark effect
        setTimeout(() => {
            console.log('Spark effect...');
            this.visualEffects.createSparkEffect(new Vector2(centerX + 50, centerY));
        }, 1000);
        
        // Impact effect
        setTimeout(() => {
            console.log('Impact effect...');
            this.visualEffects.createImpactEffect(new Vector2(centerX, centerY + 50));
        }, 2000);
        
        console.log('✅ Special effects test sequence started');
    }
    
    /**
     * Test effect combinations
     */
    public static testEffectCombinations(): void {
        console.log('🎭 Testing effect combinations...');
        
        const centerX = Constants.GAME_DIMENSIONS.CENTER_X;
        const centerY = Constants.GAME_DIMENSIONS.CENTER_Y;
        
        // Player death combination
        setTimeout(() => {
            console.log('Player death combination...');
            const effects = EffectCombinations.playerDeath(new Vector2(centerX, centerY));
            
            // Create explosion manually since we're testing
            this.visualEffects.createExplosion(new Vector2(centerX, centerY), 'player');
            this.visualEffects.startScreenShake(effects.screenShake);
            this.visualEffects.startCameraEffect('player_death', effects.cameraEffect);
        }, 0);
        
        // Wave complete combination
        setTimeout(() => {
            console.log('Wave complete combination...');
            const effects = EffectCombinations.waveComplete(new Vector2(centerX, centerY));
            
            this.visualEffects.startCameraEffect('wave_complete', effects.cameraEffect);
        }, 3000);
        
        console.log('✅ Effect combinations test sequence started');
    }
    
    /**
     * Test performance with many particles
     */
    public static testPerformance(): void {
        console.log('⚡ Testing performance with many effects...');
        
        const centerX = Constants.GAME_DIMENSIONS.CENTER_X;
        const centerY = Constants.GAME_DIMENSIONS.CENTER_Y;
        
        // Create multiple explosions rapidly
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const x = centerX + (Math.random() - 0.5) * 200;
                const y = centerY + (Math.random() - 0.5) * 200;
                this.visualEffects.createExplosion(new Vector2(x, y), 'enemy');
            }, i * 100);
        }
        
        // Check stats after effects
        setTimeout(() => {
            const stats = this.visualEffects.getStats();
            console.log('📊 Performance stats:', stats);
        }, 2000);
        
        console.log('✅ Performance test started');
    }
    
    /**
     * Test custom effects using presets
     */
    public static testCustomEffects(): void {
        console.log('🎨 Testing custom effects...');
        
        const centerX = Constants.GAME_DIMENSIONS.CENTER_X;
        const centerY = Constants.GAME_DIMENSIONS.CENTER_Y;
        
        // Custom explosion sizes
        setTimeout(() => {
            console.log('Small explosion...');
            EffectPresets.createCustomExplosion(
                new Vector2(centerX - 100, centerY), 
                'small', 
                0xFF6600
            );
            // Would need to create emitter manually for full test
        }, 0);
        
        setTimeout(() => {
            console.log('Large explosion...');
            EffectPresets.createCustomExplosion(
                new Vector2(centerX + 100, centerY), 
                'large', 
                0x6600FF
            );
            // Would need to create emitter manually for full test
        }, 1000);
        
        // Directional effect
        setTimeout(() => {
            console.log('Directional effect...');
            const direction = new Vector2(1, 0); // Right direction
            EffectPresets.createDirectionalEffect(
                new Vector2(centerX, centerY), 
                direction, 
                1.5
            );
            // Would need to create emitter manually for full test
        }, 2000);
        
        console.log('✅ Custom effects test started');
    }
    
    /**
     * Run all tests in sequence
     */
    public static runAllTests(): void {
        console.log('🧪 Running all visual effects tests...');
        
        this.initialize();
        
        setTimeout(() => this.testExplosions(), 0);
        setTimeout(() => this.testScreenShake(), 5000);
        setTimeout(() => this.testCameraEffects(), 12000);
        setTimeout(() => this.testSpecialEffects(), 18000);
        setTimeout(() => this.testEffectCombinations(), 22000);
        setTimeout(() => this.testPerformance(), 28000);
        setTimeout(() => this.testCustomEffects(), 32000);
        
        setTimeout(() => {
            console.log('🎉 All visual effects tests completed!');
            const stats = this.visualEffects.getStats();
            console.log('📊 Final stats:', stats);
        }, 38000);
        
        console.log('✅ Test suite started - will run for ~40 seconds');
    }
    
    /**
     * Clear all effects (useful for cleanup)
     */
    public static clearAllEffects(): void {
        console.log('🧹 Clearing all effects...');
        this.visualEffects.clearAllEffects();
        console.log('✅ All effects cleared');
    }
    
    /**
     * Get current system statistics
     */
    public static getStats(): ReturnType<VisualEffectsSystem['getStats']> {
        const stats = this.visualEffects.getStats();
        console.log('📊 Current visual effects stats:', stats);
        return stats;
    }
    
    /**
     * Interactive test - create explosion at mouse position
     */
    public static enableInteractiveTest(): void {
        console.log('🖱️ Interactive test enabled - click anywhere to create explosions!');
        
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            console.error('❌ Canvas not found');
            return;
        }
        
        const clickHandler = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (Constants.GAME_DIMENSIONS.WIDTH / rect.width);
            const y = (event.clientY - rect.top) * (Constants.GAME_DIMENSIONS.HEIGHT / rect.height);
            
            console.log(`💥 Creating explosion at (${x.toFixed(0)}, ${y.toFixed(0)})`);
            this.visualEffects.createExplosion(new Vector2(x, y), 'enemy');
            this.visualEffects.startScreenShake({ intensity: 5, duration: 0.2 });
        };
        
        canvas.addEventListener('click', clickHandler);
        
        // Store handler for cleanup
        (window as any).visualEffectsClickHandler = clickHandler;
        (window as any).visualEffectsCanvas = canvas;
        
        console.log('✅ Click anywhere on the game canvas to create explosions!');
        console.log('💡 Use VisualEffectsTest.disableInteractiveTest() to stop');
    }
    
    /**
     * Disable interactive test
     */
    public static disableInteractiveTest(): void {
        const canvas = (window as any).visualEffectsCanvas;
        const handler = (window as any).visualEffectsClickHandler;
        
        if (canvas && handler) {
            canvas.removeEventListener('click', handler);
            delete (window as any).visualEffectsClickHandler;
            delete (window as any).visualEffectsCanvas;
            console.log('✅ Interactive test disabled');
        } else {
            console.log('ℹ️ Interactive test was not active');
        }
    }
}

// Make test suite available globally for browser console use
(window as any).VisualEffectsTest = VisualEffectsTest;

// Auto-initialize in development mode
if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
        console.log('🎆 Visual Effects Test Suite available!');
        console.log('Commands:');
        console.log('  VisualEffectsTest.runAllTests() - Run complete test suite');
        console.log('  VisualEffectsTest.testExplosions() - Test explosion effects');
        console.log('  VisualEffectsTest.testScreenShake() - Test screen shake');
        console.log('  VisualEffectsTest.testCameraEffects() - Test camera effects');
        console.log('  VisualEffectsTest.enableInteractiveTest() - Click to create explosions');
        console.log('  VisualEffectsTest.getStats() - Show current statistics');
        console.log('  VisualEffectsTest.clearAllEffects() - Clear all effects');
    }, 3000);
}