# MCP Server Integration Guidelines

## Overview

This project leverages Model Context Protocol (MCP) servers to enhance development capabilities with real-time documentation access and browser testing automation.

## Available MCP Servers

### Context7 MCP Server
**Purpose**: Access up-to-date, version-specific documentation and code examples

**Usage Guidelines**:
- Always use Context7 to get current documentation for PixiJS v8, TypeScript, and other dependencies
- Verify API changes and new features before implementing
- Get official code examples for complex integrations
- Check for deprecation warnings and migration guides

**Common Use Cases**:
```typescript
// Before implementing PixiJS features, check current API
// Use Context7 to get: /pixijs/pixijs documentation
// Verify: Application.init(), Texture loading, Container hierarchy

// For TypeScript features, get: /microsoft/typescript documentation
// Check: Latest type definitions, compiler options, best practices

// For Vite configuration: /vitejs/vite documentation
// Verify: Build options, plugin configurations, dev server setup
```

### Playwright MCP Server
**Purpose**: Automated browser testing, debugging, and functionality verification

**Usage Guidelines**:
- Test new game features in real browser environments
- Debug rendering issues and performance problems
- Verify cross-browser compatibility
- Automate regression testing for critical game mechanics

**Testing Scenarios**:
- **Game Initialization**: Verify PIXI app loads correctly
- **Input Handling**: Test keyboard, gamepad, and touch controls
- **Rendering Performance**: Monitor FPS and frame drops
- **Audio Playback**: Verify sound effects and music
- **Save/Load System**: Test persistence across browser sessions
- **Responsive Design**: Check scaling on different screen sizes

### AWS MCP Servers
**Purpose**: Production deployment, infrastructure management, and cloud services integration

#### AWS API MCP Server
**Usage Guidelines**:
- Manage AWS resources programmatically
- Deploy game builds to production environments
- Configure CDN and hosting infrastructure
- Monitor production performance and costs

#### AWS Documentation MCP Server
**Usage Guidelines**:
- Access current AWS service documentation
- Get deployment best practices for static web apps
- Verify CloudFront and S3 configuration options
- Research AWS Amplify hosting capabilities

#### AWS Knowledge MCP Server
**Usage Guidelines**:
- Get expert guidance on AWS architecture patterns
- Access AWS Well-Architected Framework principles
- Research cost optimization strategies
- Get security and performance recommendations

**Production Deployment Scenarios**:
- **Static Hosting**: Deploy game to S3 with CloudFront CDN
- **CI/CD Pipeline**: Automated deployment via AWS Amplify
- **Asset Optimization**: CloudFront compression and caching
- **Global Distribution**: Multi-region content delivery
- **Performance Monitoring**: CloudWatch metrics and alarms
- **Cost Management**: Resource usage tracking and optimization

## Integration Workflow

### Development Process
1. **Research Phase**: Use Context7 to get current documentation
2. **Implementation Phase**: Write code following official examples
3. **Testing Phase**: Use Playwright to verify functionality
4. **Debug Phase**: Use Playwright to identify and fix issues

### Code Quality Assurance
- **API Verification**: Always check Context7 for latest API signatures
- **Browser Testing**: Use Playwright for cross-browser validation
- **Performance Monitoring**: Automated performance testing via Playwright
- **Regression Prevention**: Playwright tests for critical game paths

## Specific Use Cases for Robotron

### PixiJS Integration
```typescript
// Before updating PixiJS code, verify with Context7:
// - Current Application.init() parameters
// - Texture.from() vs Assets.load() best practices
// - Container rendering order and performance
// - WebGL vs Canvas fallback handling
```

### Game Testing Automation
```typescript
// Use Playwright to test:
// - Player movement and shooting mechanics
// - Enemy AI behavior and collision detection
// - Human rescue scoring system
// - Wave progression and difficulty scaling
// - Save/load functionality
// - Audio system integration
```

### Performance Validation
```typescript
// Playwright performance monitoring:
// - Frame rate consistency (target 60 FPS)
// - Memory usage during gameplay
// - Asset loading times
// - Collision detection performance
// - Rendering optimization effectiveness
```

### AWS Production Deployment
```typescript
// Use AWS MCP servers for:
// - S3 bucket creation and configuration for static hosting
// - CloudFront distribution setup for global CDN
// - AWS Amplify deployment pipeline configuration
// - CloudWatch monitoring and alerting setup
// - Cost optimization and resource management
// - Security best practices for web applications
```

## Best Practices

### Documentation Research
- **Always verify** API usage with Context7 before implementation
- **Check version compatibility** for all dependencies
- **Review migration guides** when updating libraries
- **Get official examples** for complex features

### Browser Testing
- **Test early and often** with Playwright during development
- **Automate critical paths** like game initialization and core gameplay
- **Monitor performance metrics** continuously
- **Test on multiple browsers** and screen sizes

### Error Handling
- Use Context7 to research proper error handling patterns
- Test error scenarios with Playwright automation
- Verify graceful degradation in different environments
- Document known issues and workarounds

## MCP Server Configuration

Ensure your `.kiro/settings/mcp.json` includes:
```json
{
  "mcpServers": {
    "Context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "disabled": false
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "disabled": false
    },
    "aws-api": {
      "command": "uvx",
      "args": ["awslabs.aws-api-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR",
        "AWS_API_MCP_WORKING_DIR": "/tmp/aws-mcp",
        "AWS_REGION": "us-east-1"
      },
      "disabled": false
    },
    "awslabs.aws-documentation-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-documentation-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR",
        "AWS_DOCUMENTATION_PARTITION": "aws"
      },
      "disabled": false
    },
    "aws-knowledge-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://knowledge-mcp.global.api.aws"],
      "disabled": false
    },
    "awslabs.core-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.core-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false
    }
  }
}
```

## Integration with Existing Systems

### Error Handler Integration
- Use Playwright to test error recovery scenarios
- Verify error logging and user feedback systems
- Test graceful degradation when systems fail

### Performance System Integration  
- Monitor GameEngine performance metrics via Playwright
- Test collision system optimization under load
- Verify rendering system efficiency across browsers

### Save System Integration
- Automate save/load testing across browser sessions
- Test data integrity and corruption recovery
- Verify settings persistence and migration

### AWS Production Integration
- Use AWS API MCP to deploy builds to S3 automatically
- Configure CloudFront for optimal asset delivery and caching
- Set up AWS Amplify for continuous deployment from Git
- Monitor production performance with CloudWatch metrics
- Implement cost-effective scaling and resource management
- Ensure security best practices for web application hosting