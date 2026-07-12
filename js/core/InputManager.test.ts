/**
 * InputManager Test - Simple test to verify input system functionality
 * 
 * This test file provides basic verification that the UnifiedInputManager
 * is working correctly with different input devices.
 */

import { inputManager, InputAction } from './InputManager';

/**
 * Test the unified input manager
 */
export function testUnifiedInputManager(): void {
    console.log('=== Testing Unified Input Manager ===');
    
    // Test initialization
    console.log('Input Manager initialized:', inputManager !== undefined);
    
    // Test gamepad detection
    console.log('Gamepad connected:', inputManager.isGamepadConnected());
    console.log('Gamepad count:', inputManager.getGamepadCount());
    
    // Test mouse position
    const mousePos = inputManager.getMousePosition();
    console.log('Mouse position:', { x: mousePos.x, y: mousePos.y });
    
    // Test movement vector (should be zero when no input)
    const movement = inputManager.getMovementVector();
    console.log('Movement vector:', { x: movement.x, y: movement.y });
    
    // Test shooting vector (should be zero when no input)
    const shooting = inputManager.getShootingVector();
    console.log('Shooting vector:', { x: shooting.x, y: shooting.y });
    
    // Test action states
    console.log('Move up pressed:', inputManager.isActionPressed(InputAction.MOVE_UP));
    console.log('Shoot left pressed:', inputManager.isActionPressed(InputAction.SHOOT_LEFT));
    
    // Add event listener for testing
    inputManager.addEventListener(InputAction.START, (event) => {
        console.log('Start action triggered:', event);
    });
    
    console.log('=== Input Manager Test Complete ===');
}

/**
 * Test input responsiveness
 */
export function testInputResponsiveness(): void {
    console.log('=== Testing Input Responsiveness ===');
    
    let testCount = 0;
    const maxTests = 60; // Test for 1 second at 60fps
    
    const testLoop = () => {
        if (testCount >= maxTests) {
            console.log('Input responsiveness test complete');
            return;
        }
        
        // Check for any input activity
        const movement = inputManager.getMovementVector();
        const shooting = inputManager.getShootingVector();
        
        if (movement.magnitude() > 0 || shooting.magnitude() > 0) {
            console.log(`Frame ${testCount}: Movement(${movement.x.toFixed(2)}, ${movement.y.toFixed(2)}) Shooting(${shooting.x.toFixed(2)}, ${shooting.y.toFixed(2)})`);
        }
        
        testCount++;
        requestAnimationFrame(testLoop);
    };
    
    requestAnimationFrame(testLoop);
}

/**
 * Run all input tests
 */
export function runInputTests(): void {
    testUnifiedInputManager();
    
    // Run responsiveness test after a short delay
    setTimeout(() => {
        testInputResponsiveness();
    }, 1000);
}

// Auto-run tests if this module is loaded directly
if (typeof window !== 'undefined') {
    // Add to window for manual testing
    (window as any).testInput = {
        runTests: runInputTests,
        testManager: testUnifiedInputManager,
        testResponsiveness: testInputResponsiveness,
        inputManager: inputManager
    };
}