// sprite-player-generator.js - Procedural pixel art player generator

class SpritePlayerGenerator {
    constructor() {
        this.pixelSize = 4; // Each "pixel" is 4x4 actual pixels
        this.frameWidth = 64;
        this.frameHeight = 96;
        this.colorPalette = this.initColorPalette();
    }

    initColorPalette() {
        return {
            skinTones: [
                '#FFD4A3', // Light
                '#F4C490', // Light-medium  
                '#E5B080', // Medium
                '#C68642', // Medium-dark
                '#8D5524', // Dark
                '#6B4226'  // Deep
            ],
            outlineColor: '#000000',
            shadowColor: '#00000040',
            highlightColor: '#FFFFFF40'
        };
    }

    generatePlayer(options = {}) {
        const defaults = {
            teamColors: { primary: '#FF0000', secondary: '#FFFFFF' },
            skinTone: this.colorPalette.skinTones[Math.floor(Math.random() * this.colorPalette.skinTones.length)],
            jerseyNumber: Math.floor(Math.random() * 99) + 1,
            hairStyle: Math.floor(Math.random() * 5),
            bodyType: ['slim', 'athletic', 'bulky'][Math.floor(Math.random() * 3)]
        };

        const config = { ...defaults, ...options };
        
        // Create sprite sheet canvas
        const canvas = document.createElement('canvas');
        canvas.width = this.frameWidth * 8; // 8 frames per row
        canvas.height = this.frameHeight * 6; // 6 rows of animations (added dunks)
        const ctx = canvas.getContext('2d');
        
        // Enable pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
        
        // Generate all animation frames
        this.generateIdleFrames(ctx, config, 0, 0);
        this.generateRunFrames(ctx, config, 0, 1);
        this.generateJumpFrames(ctx, config, 0, 2);
        this.generateDribbleFrames(ctx, config, 0, 3);
        this.generateShootFrames(ctx, config, 0, 4);
        this.generateDunkFrames(ctx, config, 0, 5);
        
        return {
            spriteSheet: canvas,
            config: config,
            animations: {
                idle: { row: 0, frames: 2, speed: 0.5 },
                run: { row: 1, frames: 4, speed: 0.15 },
                jump: { row: 2, frames: 3, speed: 0.1 },
                dribble: { row: 3, frames: 4, speed: 0.2 },
                shoot: { row: 4, frames: 4, speed: 0.2 },
                dunk_basic: { row: 5, frames: 5, speed: 0.15 },
                dunk_360: { row: 5, frames: 8, speed: 0.12 },
                dunk_windmill: { row: 5, frames: 6, speed: 0.13 },
                dunk_reverse: { row: 5, frames: 5, speed: 0.15 },
                dunk_helicopter: { row: 5, frames: 8, speed: 0.1 }
            }
        };
    }

    generateIdleFrames(ctx, config, startX, row) {
        for (let frame = 0; frame < 2; frame++) {
            const x = (startX + frame) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Slight breathing animation
            const breathOffset = frame === 1 ? 1 : 0;
            
            this.drawPlayer(ctx, config, {
                bodyOffset: breathOffset,
                armAngle: 0,
                legPosition: 'standing'
            });
            
            ctx.restore();
        }
    }
    
    generateDunkFrames(ctx, config, startX, row) {
        // We'll generate different dunk types in sequence on the same row
        let frameOffset = 0;
        
        // Basic dunk (5 frames)
        this.generateBasicDunk(ctx, config, startX + frameOffset, row);
        frameOffset += 5;
        
        // Since we can only fit 8 frames per row, we'll put the most important ones
        // The animation system will cycle through the appropriate frames
    }
    
    generateBasicDunk(ctx, config, startX, row) {
        // Basic one-handed slam dunk animation
        const frames = [
            { // Frame 0: Approach
                bodyOffset: 0,
                armAngle: 15,
                legPosition: 'run',
                ballPosition: { x: 8, y: -20 }
            },
            { // Frame 1: Jump
                bodyOffset: -5,
                armAngle: -45,
                legPosition: 'air',
                ballPosition: { x: 5, y: -35 }
            },
            { // Frame 2: Peak
                bodyOffset: -10,
                armAngle: -90,
                legPosition: 'air',
                ballPosition: { x: 0, y: -40 }
            },
            { // Frame 3: Slam
                bodyOffset: -8,
                armAngle: -120,
                legPosition: 'air',
                ballPosition: { x: 0, y: -25 }
            },
            { // Frame 4: Land
                bodyOffset: -2,
                armAngle: -30,
                legPosition: 'land',
                ballPosition: null // Ball released
            }
        ];
        
        frames.forEach((frame, index) => {
            const x = (startX + index) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            this.drawPlayer(ctx, config, {
                bodyOffset: frame.bodyOffset,
                armAngle: frame.armAngle,
                legPosition: frame.legPosition,
                hasBall: frame.ballPosition !== null,
                ballPosition: frame.ballPosition
            });
            
            ctx.restore();
        });
    }
    
    generateShootFrames(ctx, config, startX, row) {
        // Shooting animation - wind up and release
        for (let frame = 0; frame < 4; frame++) {
            const x = (startX + frame) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Shooting poses
            let armAngle, ballPosition, bodyOffset;
            
            switch(frame) {
                case 0: // Wind up - ball at chest
                    armAngle = -20;
                    ballPosition = { x: 0, y: -25 };
                    bodyOffset = 0;
                    break;
                case 1: // Ball above head
                    armAngle = -60;
                    ballPosition = { x: 0, y: -35 };
                    bodyOffset = -2;
                    break;
                case 2: // Release point
                    armAngle = -45;
                    ballPosition = { x: 5, y: -33 };
                    bodyOffset = -3;
                    break;
                case 3: // Follow through
                    armAngle = -30;
                    ballPosition = null; // Ball has left
                    bodyOffset = -1;
                    break;
            }
            
            this.drawPlayer(ctx, config, {
                bodyOffset: bodyOffset,
                armAngle: armAngle,
                legPosition: 'standing',
                hasBall: ballPosition !== null,
                ballPosition: ballPosition
            });
            
            ctx.restore();
        }
    }
    
    generateDribbleFrames(ctx, config, startX, row) {
        // Dribbling animation - ball bounces as player runs
        for (let frame = 0; frame < 4; frame++) {
            const x = (startX + frame) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Running motion for dribble
            const runCycle = frame % 4;
            const armSwing = Math.sin(runCycle * Math.PI / 2) * 10;
            const legOffset = runCycle < 2 ? 'left' : 'right';
            const bodyBounce = Math.abs(Math.sin(runCycle * Math.PI / 2)) * 2;
            
            // Ball bounce positions
            const ballPositions = [
                { x: 8, y: -15 },  // Ball at waist
                { x: 10, y: -8 },  // Ball going down
                { x: 12, y: -2 },  // Ball at ground
                { x: 10, y: -10 }  // Ball coming up
            ];
            
            this.drawPlayer(ctx, config, {
                bodyOffset: bodyBounce,
                armAngle: armSwing,
                legPosition: legOffset,
                hasBall: true,
                ballPosition: ballPositions[frame]
            });
            
            ctx.restore();
        }
    }

    generateRunFrames(ctx, config, startX, row) {
        for (let frame = 0; frame < 4; frame++) {
            const x = (startX + frame) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Running animation positions
            const runCycle = frame % 4;
            const armSwing = Math.sin(runCycle * Math.PI / 2) * 15;
            const legOffset = runCycle < 2 ? 'left' : 'right';
            
            this.drawPlayer(ctx, config, {
                bodyOffset: Math.abs(Math.sin(runCycle * Math.PI / 2)) * 2,
                armAngle: armSwing,
                legPosition: legOffset
            });
            
            ctx.restore();
        }
    }

    generateJumpFrames(ctx, config, startX, row) {
        for (let frame = 0; frame < 3; frame++) {
            const x = (startX + frame) * this.frameWidth;
            const y = row * this.frameHeight;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Jump animation positions
            const jumpPhase = ['crouch', 'air', 'land'][frame];
            
            this.drawPlayer(ctx, config, {
                bodyOffset: jumpPhase === 'air' ? -10 : (jumpPhase === 'crouch' ? 5 : 2),
                armAngle: jumpPhase === 'air' ? 45 : 0,
                legPosition: jumpPhase
            });
            
            ctx.restore();
        }
    }

    drawPlayer(ctx, config, pose) {
        const centerX = this.frameWidth / 2;
        const baseY = this.frameHeight - 10;
        
        // Draw shadow
        this.drawShadow(ctx, centerX, baseY + 5);
        
        // Adjust for pose
        const yOffset = pose.bodyOffset || 0;
        
        // Draw in correct order for layering
        this.drawLegs(ctx, config, centerX, baseY + yOffset, pose.legPosition);
        this.drawBody(ctx, config, centerX, baseY + yOffset - 40);
        this.drawArms(ctx, config, centerX, baseY + yOffset - 40, pose.armAngle);
        this.drawHead(ctx, config, centerX, baseY + yOffset - 65);
        this.drawJerseyDetails(ctx, config, centerX, baseY + yOffset - 40);
        
        // Draw ball if dribbling
        if (pose.hasBall) {
            this.drawBasketball(ctx, centerX, baseY + yOffset, pose.ballPosition);
        }
    }

    drawShadow(ctx, x, y) {
        ctx.fillStyle = this.colorPalette.shadowColor;
        ctx.beginPath();
        ctx.ellipse(x, y, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHead(ctx, config, x, y) {
        // Head (large for NBA Jam style)
        this.drawPixelRect(ctx, x - 12, y, 24, 20, config.skinTone);
        
        // Hair
        this.drawHair(ctx, config, x, y);
        
        // Face features (simple pixels)
        // Eyes
        this.drawPixel(ctx, x - 6, y + 8, this.colorPalette.outlineColor);
        this.drawPixel(ctx, x + 6, y + 8, this.colorPalette.outlineColor);
        
        // Mouth
        this.drawPixelRect(ctx, x - 4, y + 14, 8, 2, this.colorPalette.outlineColor);
        
        // Outline
        this.drawPixelOutline(ctx, x - 12, y, 24, 20);
    }

    drawHair(ctx, config, x, y) {
        const hairColor = '#000000';
        
        switch(config.hairStyle) {
            case 0: // Bald
                break;
            case 1: // Short
                this.drawPixelRect(ctx, x - 12, y - 4, 24, 6, hairColor);
                break;
            case 2: // Flat top
                this.drawPixelRect(ctx, x - 10, y - 6, 20, 8, hairColor);
                break;
            case 3: // Afro
                this.drawPixelRect(ctx, x - 14, y - 8, 28, 10, hairColor);
                this.drawPixel(ctx, x - 14, y + 2, hairColor);
                this.drawPixel(ctx, x + 14, y + 2, hairColor);
                break;
            case 4: // High top fade
                this.drawPixelRect(ctx, x - 8, y - 10, 16, 12, hairColor);
                break;
        }
    }

    drawBody(ctx, config, x, y) {
        // Torso - wider for athletic look
        const width = config.bodyType === 'bulky' ? 28 : (config.bodyType === 'slim' ? 20 : 24);
        
        // Jersey
        this.drawPixelRect(ctx, x - width/2, y, width, 25, config.teamColors.primary);
        
        // Shorts
        this.drawPixelRect(ctx, x - width/2 - 2, y + 25, width + 4, 15, config.teamColors.primary);
        
        // Outline
        this.drawPixelOutline(ctx, x - width/2, y, width, 40);
    }

    drawJerseyDetails(ctx, config, x, y) {
        // Jersey number (simplified)
        const numberStr = config.jerseyNumber.toString();
        ctx.fillStyle = config.teamColors.secondary;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(numberStr, x, y + 18);
    }

    drawArms(ctx, config, x, y, angle = 0) {
        // Left arm
        ctx.save();
        ctx.translate(x - 14, y + 5);
        ctx.rotate((angle * Math.PI) / 180);
        this.drawPixelRect(ctx, -3, 0, 6, 20, config.skinTone);
        this.drawPixelOutline(ctx, -3, 0, 6, 20);
        ctx.restore();
        
        // Right arm
        ctx.save();
        ctx.translate(x + 14, y + 5);
        ctx.rotate((-angle * Math.PI) / 180);
        this.drawPixelRect(ctx, -3, 0, 6, 20, config.skinTone);
        this.drawPixelOutline(ctx, -3, 0, 6, 20);
        ctx.restore();
    }

    drawLegs(ctx, config, x, y, position) {
        const legWidth = 8;
        const legHeight = 25;
        const shoeHeight = 8;
        
        // Leg positions based on animation
        let leftOffset = 0, rightOffset = 0;
        let leftAngle = 0, rightAngle = 0;
        
        switch(position) {
            case 'left':
                leftOffset = -5;
                rightOffset = 5;
                leftAngle = -15;
                rightAngle = 15;
                break;
            case 'right':
                leftOffset = 5;
                rightOffset = -5;
                leftAngle = 15;
                rightAngle = -15;
                break;
            case 'crouch':
                leftAngle = -30;
                rightAngle = -30;
                break;
            case 'air':
                leftAngle = -45;
                rightAngle = 45;
                break;
        }
        
        // Left leg
        ctx.save();
        ctx.translate(x - 8 + leftOffset, y - 25);
        ctx.rotate((leftAngle * Math.PI) / 180);
        this.drawPixelRect(ctx, -legWidth/2, 0, legWidth, legHeight, config.skinTone);
        this.drawPixelRect(ctx, -legWidth/2 - 2, legHeight, legWidth + 4, shoeHeight, '#000000');
        this.drawPixelOutline(ctx, -legWidth/2, 0, legWidth, legHeight + shoeHeight);
        ctx.restore();
        
        // Right leg
        ctx.save();
        ctx.translate(x + 8 + rightOffset, y - 25);
        ctx.rotate((rightAngle * Math.PI) / 180);
        this.drawPixelRect(ctx, -legWidth/2, 0, legWidth, legHeight, config.skinTone);
        this.drawPixelRect(ctx, -legWidth/2 - 2, legHeight, legWidth + 4, shoeHeight, '#FF0000');
        this.drawPixelOutline(ctx, -legWidth/2, 0, legWidth, legHeight + shoeHeight);
        ctx.restore();
    }

    // Pixel drawing utilities
    drawPixel(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.pixelSize, this.pixelSize);
    }

    drawPixelRect(ctx, x, y, width, height, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    drawPixelOutline(ctx, x, y, width, height) {
        ctx.strokeStyle = this.colorPalette.outlineColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    }
    
    drawBasketball(ctx, playerX, playerY, ballPos) {
        // Draw basketball relative to player position
        const ballX = playerX + ballPos.x;
        const ballY = playerY + ballPos.y;
        const ballSize = 8;
        
        // Main ball circle (orange)
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Basketball lines (simplified)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        // Outline
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
        ctx.stroke();
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(ballX, ballY - ballSize);
        ctx.lineTo(ballX, ballY + ballSize);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(ballX - ballSize, ballY);
        ctx.lineTo(ballX + ballSize, ballY);
        ctx.stroke();
        
        // Curved lines (simplified)
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballSize * 0.6, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballSize * 0.6, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();
    }
}