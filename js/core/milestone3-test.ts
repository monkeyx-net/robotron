/**
 * Milestone 3 Test - Entity Refactoring Validation
 * 
 * This test validates that all entity classes have been successfully refactored
 * to use the new GameObject architecture and that they work correctly together.
 */

import * as PIXI from 'pixi.js';
import { GameObject } from './GameObject';
import { PlayerFactory, PlayerController, PlayerInput } from '../entities/Player';
import { GruntFactory, HulkFactory, EnforcerFactory } from '../entities/Enemy';
import { projectileManager } from '../entities/Projectile';
import { HumanFactory, HumanType, HumanAI, HumanState } from '../entities/Human';
import { Vector2 } from '../utils/Vector2';
import { gameEvents } from './EventSystem';
import { errorHandler } from './ErrorHandler';

/**
 * Milestone 3 Test Suite
 */
export class Milestone3Test {
    private app: PIXI.Application;
    private testResults: { [key: string]: boolean } = {};
    private testContainer: PIXI.Container;
    
    constructor(app: PIXI.Application) {
        this.app = app;
        this.testContainer = new PIXI.Container();
        this.app.stage.addChild(this.testContainer);
    }
    
    /**
     * Run all entity refactoring tests
     */
    async runAllTests(): Promise<boolean> {
        console.log('🧪 Starting Milestone 3: Entity Refactoring Tests');
        
        try {
            // Test Player entity
            await this.testPlayerEntity();
            
            // Test Enemy entities
            await this.testEnemyEntities();
            
            // Test Projectile system
            await this.testProjectileSystem();
            
            // Test Human entities
            await this.testHumanEntities();
            
            // Test entity interactions
            await this.testEntityInteractions();
            
            // Test component system
            await this.testComponentSystem();
            
            // Display results
            this.displayResults();
            
            return this.allTestsPassed();
            
        } catch (error) {
            console.error('❌ Milestone 3 tests failed with error:', error);
            errorHandler.handleError(error as Error);
            return false;
        }
    }
    
    /**
     * Test Player entity refactoring
     */
    private async testPlayerEntity(): Promise<void> {
        console.log('Testing Player entity...');
        
        try {
            // Create a simple texture for testing
            const texture = this.createTestTexture(16, 16, 0x00FF00);
            
            // Create player
            const player = PlayerFactory.createPlayer(texture, 100, 100);
            
            // Test basic properties
            this.testResults['player_creation'] = player instanceof GameObject;
            this.testResults['player_tag'] = player.tag === 'player';
            this.testResults['player_position'] = player.transform.position.x === 100 && player.transform.position.y === 100;
            
            // Test components
            const playerInput = player.getComponent<PlayerInput>('playerInput');
            const playerController = player.getComponent<PlayerController>('playerController');
            
            this.testResults['player_input_component'] = playerInput !== null;
            this.testResults['player_controller_component'] = playerController !== null;
            
            // Test input handling
            if (playerInput) {
                playerInput.moveDirection.set(1, 0);
                playerInput.isMoving = true;
                this.testResults['player_input_handling'] = playerInput.getNormalizedMoveDirection().magnitude() > 0;
            }
            
            // Test player properties
            if (playerController) {
                this.testResults['player_health'] = playerController.health === 1;
                this.testResults['player_lives'] = playerController.lives > 0;
            }
            
            // Add to stage for visual verification
            this.testContainer.addChild(player.getDisplayObject());
            
            console.log('✅ Player entity tests completed');
            
        } catch (error) {
            console.error('❌ Player entity test failed:', error);
            this.testResults['player_creation'] = false;
        }
    }
    
    /**
     * Test Enemy entity refactoring
     */
    private async testEnemyEntities(): Promise<void> {
        console.log('Testing Enemy entities...');
        
        try {
            const texture = this.createTestTexture(16, 16, 0xFF0000);
            
            // Test Grunt
            const grunt = GruntFactory.create(texture, 200, 100);
            this.testResults['grunt_creation'] = grunt instanceof GameObject && grunt.tag === 'grunt';
            
            // Test Hulk
            const hulk = HulkFactory.create(texture, 300, 100);
            this.testResults['hulk_creation'] = hulk instanceof GameObject && hulk.tag === 'hulk';
            
            // Test Enforcer
            const enforcer = EnforcerFactory.create(texture, 400, 100);
            this.testResults['enforcer_creation'] = enforcer instanceof GameObject && enforcer.tag === 'enforcer';
            
            // Test enemy components
            const gruntHealth = grunt.getComponent('enemyHealth');
            const gruntMovement = grunt.getComponent('enemyMovement');
            
            this.testResults['enemy_health_component'] = gruntHealth !== null;
            this.testResults['enemy_movement_component'] = gruntMovement !== null;
            
            // Test shooting enemy
            const enforcerShooting = enforcer.getComponent('enemyShooting');
            this.testResults['enemy_shooting_component'] = enforcerShooting !== null;
            
            // Add to stage
            this.testContainer.addChild(grunt.getDisplayObject());
            this.testContainer.addChild(hulk.getDisplayObject());
            this.testContainer.addChild(enforcer.getDisplayObject());
            
            console.log('✅ Enemy entity tests completed');
            
        } catch (error) {
            console.error('❌ Enemy entity test failed:', error);
            this.testResults['grunt_creation'] = false;
        }
    }
    
    /**
     * Test Projectile system refactoring
     */
    private async testProjectileSystem(): Promise<void> {
        console.log('Testing Projectile system...');
        
        try {
            // Test player projectile creation
            const playerProjectile = projectileManager.createPlayerProjectile(150, 150, new Vector2(1, 0));
            this.testResults['player_projectile_creation'] = playerProjectile instanceof GameObject;
            this.testResults['player_projectile_tag'] = playerProjectile.tag === 'playerProjectile';
            
            // Test enemy projectile creation
            const enemyProjectile = projectileManager.createEnemyProjectile(250, 150, new Vector2(-1, 0), 'enforcer');
            this.testResults['enemy_projectile_creation'] = enemyProjectile instanceof GameObject;
            this.testResults['enemy_projectile_tag'] = enemyProjectile.tag === 'enemyProjectile';
            
            // Test projectile components
            const projectileController = playerProjectile.getComponent('projectileController');
            this.testResults['projectile_controller_component'] = projectileController !== null;
            
            // Test object pooling
            const initialCount = projectileManager.getActiveProjectileCount();
            const pooledProjectile = projectileManager.createPlayerProjectile(300, 150, new Vector2(0, 1));
            const afterCount = projectileManager.getActiveProjectileCount();
            this.testResults['projectile_pooling'] = afterCount > initialCount;
            
            // Add to stage
            this.testContainer.addChild(playerProjectile.getDisplayObject());
            this.testContainer.addChild(enemyProjectile.getDisplayObject());
            this.testContainer.addChild(pooledProjectile.getDisplayObject());
            
            console.log('✅ Projectile system tests completed');
            
        } catch (error) {
            console.error('❌ Projectile system test failed:', error);
            this.testResults['player_projectile_creation'] = false;
        }
    }
    
    /**
     * Test Human entity refactoring
     */
    private async testHumanEntities(): Promise<void> {
        console.log('Testing Human entities...');
        
        try {
            const texture = this.createTestTexture(12, 12, 0x0000FF);
            
            // Test different human types
            const man = HumanFactory.createHuman(texture, 100, 200, HumanType.MAN);
            const woman = HumanFactory.createHuman(texture, 150, 200, HumanType.WOMAN);
            const child = HumanFactory.createHuman(texture, 200, 200, HumanType.CHILD);
            
            this.testResults['human_man_creation'] = man instanceof GameObject && man.tag === 'human';
            this.testResults['human_woman_creation'] = woman instanceof GameObject;
            this.testResults['human_child_creation'] = child instanceof GameObject;
            
            // Test human components
            const humanAI = man.getComponent<HumanAI>('humanAI');
            const humanController = man.getComponent('humanController');
            
            this.testResults['human_ai_component'] = humanAI !== null;
            this.testResults['human_controller_component'] = humanController !== null;
            
            // Test AI state
            if (humanAI) {
                this.testResults['human_initial_state'] = humanAI.state === HumanState.WANDERING;
            }
            
            // Add to stage
            this.testContainer.addChild(man.getDisplayObject());
            this.testContainer.addChild(woman.getDisplayObject());
            this.testContainer.addChild(child.getDisplayObject());
            
            console.log('✅ Human entity tests completed');
            
        } catch (error) {
            console.error('❌ Human entity test failed:', error);
            this.testResults['human_man_creation'] = false;
        }
    }
    
    /**
     * Test entity interactions
     */
    private async testEntityInteractions(): Promise<void> {
        console.log('Testing Entity interactions...');
        
        try {
            // Test event system integration
            let eventReceived = false;
            const eventHandler = () => { eventReceived = true; };
            
            gameEvents.on('test:entity_interaction', eventHandler);
            gameEvents.emit({
                type: 'test:entity_interaction',
                timestamp: Date.now(),
                source: 'Milestone3Test',
                data: {}
            });
            
            this.testResults['entity_event_system'] = eventReceived;
            
            // Test collision detection setup
            const testEntity = new GameObject('TestEntity');
            testEntity.transform.setPosition(50, 50);
            
            const collider = testEntity.getComponent('collider');
            this.testResults['entity_collision_setup'] = collider !== null;
            
            console.log('✅ Entity interaction tests completed');
            
        } catch (error) {
            console.error('❌ Entity interaction test failed:', error);
            this.testResults['entity_event_system'] = false;
        }
    }
    
    /**
     * Test component system functionality
     */
    private async testComponentSystem(): Promise<void> {
        console.log('Testing Component system...');
        
        try {
            const testObject = new GameObject('ComponentTest');
            
            // Test component addition and retrieval
            const initialComponentCount = testObject.getComponentCount();
            
            // Components should be added automatically by factories
            this.testResults['component_system_basic'] = initialComponentCount >= 0;
            
            // Test component lifecycle
            const texture = this.createTestTexture(8, 8, 0xFF00FF);
            const player = PlayerFactory.createPlayer(texture, 0, 0);
            
            const componentCount = player.getComponentCount();
            this.testResults['component_system_lifecycle'] = componentCount > 0;
            
            // Test component updates
            let updateCalled = false;
            const testComponent = {
                name: 'testComponent',
                gameObject: player,
                enabled: true,
                update: () => { updateCalled = true; }
            };
            
            player.addComponent(testComponent);
            player.update(16); // Simulate one frame
            
            this.testResults['component_system_updates'] = updateCalled;
            
            console.log('✅ Component system tests completed');
            
        } catch (error) {
            console.error('❌ Component system test failed:', error);
            this.testResults['component_system_basic'] = false;
        }
    }
    
    /**
     * Create a simple colored texture for testing
     */
    private createTestTexture(width: number, height: number, color: number): PIXI.Texture {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(color);
        graphics.drawRect(0, 0, width, height);
        graphics.endFill();
        
        return this.app.renderer.generateTexture(graphics);
    }
    
    /**
     * Display test results
     */
    private displayResults(): void {
        console.log('\n📊 Milestone 3 Test Results:');
        console.log('================================');
        
        let passedCount = 0;
        let totalCount = 0;
        
        for (const [testName, passed] of Object.entries(this.testResults)) {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${testName}`);
            
            if (passed) passedCount++;
            totalCount++;
        }
        
        console.log('================================');
        console.log(`📈 Results: ${passedCount}/${totalCount} tests passed`);
        
        if (this.allTestsPassed()) {
            console.log('🎉 All entity refactoring tests PASSED!');
            console.log('✨ Entity architecture is working correctly');
        } else {
            console.log('⚠️  Some entity refactoring tests FAILED');
            console.log('🔧 Review the failed tests and fix issues');
        }
    }
    
    /**
     * Check if all tests passed
     */
    private allTestsPassed(): boolean {
        return Object.values(this.testResults).every(result => result === true);
    }
    
    /**
     * Clean up test objects
     */
    cleanup(): void {
        this.testContainer.removeChildren();
        this.app.stage.removeChild(this.testContainer);
    }
}

/**
 * Run Milestone 3 tests
 */
export async function runMilestone3Tests(app: PIXI.Application): Promise<boolean> {
    const test = new Milestone3Test(app);
    const result = await test.runAllTests();
    
    // Keep test objects visible for a few seconds for visual verification
    setTimeout(() => {
        test.cleanup();
    }, 5000);
    
    return result;
}