/**
 * StateSystemTest - Simple test to verify the state system is working
 */

import { gameStateManager } from './GameStateManager';
import { initializeGameStates } from './StateInitialization';

/**
 * Test the state system functionality
 */
export function testStateSystem(): boolean {
    console.log('🧪 Testing State System...');
    
    try {
        // Initialize the state system
        const initialized = initializeGameStates();
        if (!initialized) {
            console.error('❌ State system initialization failed');
            return false;
        }
        
        // Test state registration
        const debugInfo = gameStateManager.getDebugInfo();
        console.log('📊 State system debug info:', debugInfo);
        
        const expectedStates = [
            'TITLE_SCREEN',
            'HIGH_SCORE_DISPLAY_SCREEN', 
            'DEMO_PLAY',
            'PLAYING',
            'GAME_OVER',
            'PAUSED'
        ];
        
        const registeredStates = debugInfo.registeredStates;
        const missingStates = expectedStates.filter(state => !registeredStates.includes(state));
        
        if (missingStates.length > 0) {
            console.error('❌ Missing states:', missingStates);
            return false;
        }
        
        console.log('✅ All expected states are registered');
        
        // Test initial state transition
        const transitionSuccess = gameStateManager.transitionTo('TITLE_SCREEN');
        if (!transitionSuccess) {
            console.error('❌ Failed to transition to TITLE_SCREEN');
            return false;
        }
        
        const currentState = gameStateManager.getCurrentStateName();
        if (currentState !== 'TITLE_SCREEN') {
            console.error('❌ Current state is not TITLE_SCREEN:', currentState);
            return false;
        }
        
        console.log('✅ Successfully transitioned to TITLE_SCREEN');
        
        // Test state manager methods
        console.log('📋 Testing state manager methods...');
        
        // Test update (should not throw)
        gameStateManager.update(16.67); // ~60fps
        console.log('✅ Update method works');
        
        // Test render (should not throw)
        gameStateManager.render();
        console.log('✅ Render method works');
        
        // Test input handling (should not throw)
        gameStateManager.handleInput({
            type: 'test',
            data: { test: true }
        });
        console.log('✅ Input handling works');
        
        console.log('🎉 State System Test Passed!');
        return true;
        
    } catch (error) {
        console.error('❌ State System Test Failed:', error);
        return false;
    }
}

// Make test available globally for console testing
if (typeof window !== 'undefined') {
    (window as any).testStateSystem = testStateSystem;
    console.log('🧪 State system test available: window.testStateSystem()');
}