/**
 * RenderIntegration Validation - Test integration with existing sprites
 * 
 * This validation ensures that existing game sprites are properly integrated
 * with the new optimized RenderSystem for batching and culling.
 */

import { RenderSystem } from './RenderSystem';
import { RenderIntegration, GameObjectType } from './RenderIntegration';

/**
 * Validate render integration with existing game objects
 */
export function validateRenderIntegration(): boolean {
    console.log('🔍 Validating RenderSystem integration...');
    
    try {
        const renderSystem = RenderSystem.getInstance();
        const debugInfo = renderSystem.getDebugInfo();
        const metrics = renderSystem.getMetrics();
        const config = renderSystem.getConfiguration();
        
        console.log('📊 RenderSystem Status:');
        console.log(`  • Registered Objects: ${debugInfo.renderables}`);
        console.log(`  • Active Batches: ${debugInfo.batches}`);
        console.log(`  • Layer Containers: ${debugInfo.layers}`);
        console.log(`  • Visible Objects: ${metrics.visibleObjects}`);
        console.log(`  • Culled Objects: ${metrics.culledObjects}`);
        console.log(`  • Draw Calls: ${metrics.drawCalls}`);
        console.log(`  • Batched Sprites: ${metrics.batchedSprites}`);
        
        console.log('⚙️ Configuration:');
        console.log(`  • Batching: ${config.enableBatching ? 'Enabled' : 'Disabled'}`);
        console.log(`  • Culling: ${config.enableCulling ? 'Enabled' : 'Disabled'}`);
        console.log(`  • Layering: ${config.enableLayering ? 'Enabled' : 'Disabled'}`);
        console.log(`  • Batch Size: ${config.batchSize}`);
        console.log(`  • Cull Padding: ${config.cullPadding}px`);
        
        // Check if optimizations are working
        const optimizationsWorking = 
            config.enableBatching && 
            config.enableCulling && 
            config.enableLayering &&
            debugInfo.layers > 0;
        
        if (optimizationsWorking) {
            console.log('✅ RenderSystem optimizations are active and working');
            
            // Check performance benefits
            if (metrics.drawCalls < metrics.totalObjects && metrics.totalObjects > 0) {
                const reduction = ((metrics.totalObjects - metrics.drawCalls) / metrics.totalObjects * 100).toFixed(1);
                console.log(`🚀 Draw call optimization: ${reduction}% reduction (${metrics.drawCalls} vs ${metrics.totalObjects})`);
            }
            
            if (metrics.culledObjects > 0) {
                const cullingRate = (metrics.culledObjects / (metrics.visibleObjects + metrics.culledObjects) * 100).toFixed(1);
                console.log(`🎯 Viewport culling: ${cullingRate}% objects culled (${metrics.culledObjects} culled)`);
            }
            
            return true;
        } else {
            console.warn('⚠️ Some RenderSystem optimizations may not be working correctly');
            return false;
        }
        
    } catch (error) {
        console.error('❌ RenderSystem validation failed:', error);
        return false;
    }
}

/**
 * Test sprite registration and cleanup
 */
export function testSpriteLifecycle(): boolean {
    console.log('🔄 Testing sprite lifecycle management...');
    
    try {
        const renderSystem = RenderSystem.getInstance();
        const initialCount = renderSystem.getDebugInfo().renderables;
        
        // Create test sprites (simulating game objects)
        const testSprites: any[] = [];
        for (let i = 0; i < 5; i++) {
            testSprites.push({
                sprite: { x: i * 50, y: 100, visible: true },
                id: `test_sprite_${i}`
            });
        }
        
        // Register sprites
        RenderIntegration.registerGameObjectArray(
            testSprites, 
            GameObjectType.ENEMY,
            (obj, _index) => obj.id,
            (obj) => obj.sprite
        );
        
        const afterRegistration = renderSystem.getDebugInfo().renderables;
        
        if (afterRegistration !== initialCount + 5) {
            console.error(`❌ Registration failed: expected ${initialCount + 5}, got ${afterRegistration}`);
            return false;
        }
        
        // Unregister sprites
        RenderIntegration.unregisterGameObjectArray(
            testSprites,
            GameObjectType.ENEMY,
            (obj, _index) => obj.id
        );
        
        const afterCleanup = renderSystem.getDebugInfo().renderables;
        
        if (afterCleanup !== initialCount) {
            console.error(`❌ Cleanup failed: expected ${initialCount}, got ${afterCleanup}`);
            return false;
        }
        
        console.log('✅ Sprite lifecycle management working correctly');
        return true;
        
    } catch (error) {
        console.error('❌ Sprite lifecycle test failed:', error);
        return false;
    }
}

/**
 * Monitor performance for a short period
 */
export async function monitorPerformance(duration: number = 5000): Promise<void> {
    console.log(`📈 Monitoring performance for ${duration / 1000} seconds...`);
    
    const renderSystem = RenderSystem.getInstance();
    const samples: any[] = [];
    
    const sampleInterval = setInterval(() => {
        const metrics = renderSystem.getMetrics();
        samples.push({
            timestamp: Date.now(),
            ...metrics
        });
    }, 100); // Sample every 100ms
    
    // Wait for monitoring duration
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(sampleInterval);
    
    if (samples.length > 0) {
        const avgDrawCalls = samples.reduce((sum, s) => sum + s.drawCalls, 0) / samples.length;
        const avgVisible = samples.reduce((sum, s) => sum + s.visibleObjects, 0) / samples.length;
        const avgCulled = samples.reduce((sum, s) => sum + s.culledObjects, 0) / samples.length;
        const avgRenderTime = samples.reduce((sum, s) => sum + s.renderTime, 0) / samples.length;
        
        console.log('📊 Performance Summary:');
        console.log(`  • Average Draw Calls: ${avgDrawCalls.toFixed(1)}`);
        console.log(`  • Average Visible Objects: ${avgVisible.toFixed(1)}`);
        console.log(`  • Average Culled Objects: ${avgCulled.toFixed(1)}`);
        console.log(`  • Average Render Time: ${avgRenderTime.toFixed(2)}ms`);
        
        const totalObjects = avgVisible + avgCulled;
        if (totalObjects > 0) {
            const cullingEfficiency = (avgCulled / totalObjects * 100).toFixed(1);
            console.log(`  • Culling Efficiency: ${cullingEfficiency}%`);
        }
        
        if (avgDrawCalls < avgVisible && avgVisible > 0) {
            const batchingEfficiency = ((avgVisible - avgDrawCalls) / avgVisible * 100).toFixed(1);
            console.log(`  • Batching Efficiency: ${batchingEfficiency}% draw call reduction`);
        }
    }
}

// Auto-run validation when module loads
console.log('RenderIntegration validation loaded. Available functions:');
console.log('  • validateRenderIntegration() - Check current integration status');
console.log('  • testSpriteLifecycle() - Test sprite registration/cleanup');
console.log('  • monitorPerformance(duration) - Monitor performance metrics');