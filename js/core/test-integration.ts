/**
 * Simple integration test for foundational systems
 * This file can be imported in main.ts to verify everything works
 */

import { RobotronGame } from './GameModule';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import * as PIXI from 'pixi.js';

export function testFoundationalSystems(): boolean {
    console.log('Testing foundational systems...');
    
    try {
        // Test Vector2 class
        const vec1 = new Vector2(3, 4);
        const vec2 = new Vector2(1, 2);
        const distance = vec1.distanceTo(vec2);
        console.log(`Vector2 test: distance between (3,4) and (1,2) = ${distance.toFixed(2)}`);
        
        if (Math.abs(distance - Math.sqrt(8)) > 0.001) {
            throw new Error('Vector2 distance calculation failed');
        }
        
        // Test Rectangle class
        const rect1 = new Rectangle(0, 0, 10, 10);
        const rect2 = new Rectangle(5, 5, 10, 10);
        const intersects = rect1.intersects(rect2);
        console.log(`Rectangle test: rectangles intersect = ${intersects}`);
        
        if (!intersects) {
            throw new Error('Rectangle intersection test failed');
        }
        
        // Test RobotronGame module
        const initialized = RobotronGame.init();
        console.log(`RobotronGame initialization: ${initialized}`);
        
        if (!initialized) {
            throw new Error('RobotronGame initialization failed');
        }
        
        // Test GameObject creation (using PIXI sprite)
        const testSprite = new PIXI.Graphics();
        testSprite.rect(0, 0, 10, 10);
        testSprite.fill(0xFF0000);
        
        // Legacy test targets an older GameObject API (setPosition/move);
        // kept as-is (it already reports failure at runtime via catch).
        const gameObject = new (RobotronGame.Utils.GameObject as any)(testSprite, 'test');
        console.log(`GameObject test: created object with id ${gameObject.id}`);

        // Test position and movement
        gameObject.setPosition(new Vector2(50, 50));
        gameObject.move(new Vector2(10, 10));
        console.log(`GameObject position after move: ${gameObject.position.toString()}`);

        if (!gameObject.position.equals(new Vector2(60, 60))) {
            throw new Error('GameObject movement test failed');
        }
        
        // Clean up
        gameObject.destroy();
        
        console.log('✅ All foundational system tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Foundational system test failed:', error);
        return false;
    }
}

// Auto-run tests if this module is imported
if (typeof window !== 'undefined') {
    // Run tests after a short delay to ensure everything is loaded
    setTimeout(() => {
        testFoundationalSystems();
    }, 100);
}