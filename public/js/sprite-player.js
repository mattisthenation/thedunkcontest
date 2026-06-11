// sprite-player.js - Sprite-based player for Three.js

class SpritePlayer {
    constructor(scene, playerData) {
        console.log('SpritePlayer constructor called with:', playerData);
        this.scene = scene;
        this.playerData = playerData;
        this.position = new THREE.Vector3(0, 0, 0);
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.animationTime = 0;
        
        // Create sprite material and mesh
        this.createSprite();
        
        // Player properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isJumping = false;
        this.facingDirection = 1; // 1 for right, -1 for left
        this.hasBall = false; // Track if player has ball for animation
    }

    createSprite() {
        // Create texture from sprite sheet
        const texture = new THREE.CanvasTexture(this.playerData.spriteSheet);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        
        // Calculate UV coordinates for first frame
        const frameWidth = 64;
        const frameHeight = 96;
        const sheetWidth = this.playerData.spriteSheet.width;
        const sheetHeight = this.playerData.spriteSheet.height;
        
        // Create sprite material
        this.material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: true,
            depthTest: true
        });
        
        // Create sprite mesh
        this.sprite = new THREE.Sprite(this.material);
        
        // Scale sprite to appropriate size (about 2 units tall)
        const aspectRatio = frameWidth / frameHeight;
        this.sprite.scale.set(aspectRatio * 2, 2, 1);
        
        // Add to scene
        this.scene.add(this.sprite);
        
        // Store texture info for animation
        this.textureInfo = {
            texture: texture,
            frameWidth: frameWidth,
            frameHeight: frameHeight,
            sheetWidth: sheetWidth,
            sheetHeight: sheetHeight,
            framesPerRow: sheetWidth / frameWidth
        };
        
        // Set initial frame
        this.updateTextureOffset();
    }

    setAnimation(animationName) {
        if (this.currentAnimation !== animationName) {
            this.currentAnimation = animationName;
            this.currentFrame = 0;
            this.animationTime = 0;
            this.updateTextureOffset();
        }
    }

    update(deltaTime) {
        // Update animation
        if (!this.playerData || !this.playerData.animations) {
            console.error('SpritePlayer: playerData or animations missing:', this.playerData);
            return;
        }
        
        const animData = this.playerData.animations[this.currentAnimation];
        if (animData) {
            this.animationTime += deltaTime;
            
            if (this.animationTime >= animData.speed) {
                this.animationTime = 0;
                this.currentFrame = (this.currentFrame + 1) % animData.frames;
                this.updateTextureOffset();
            }
        }
        
        // Update position
        this.sprite.position.copy(this.position);
        this.sprite.position.y += 1; // Offset so feet are at position
        
        // Flip sprite based on facing direction
        this.sprite.scale.x = Math.abs(this.sprite.scale.x) * this.facingDirection;
    }

    updateTextureOffset() {
        if (!this.playerData || !this.playerData.animations) {
            console.error('SpritePlayer: playerData or animations missing in updateTextureOffset');
            return;
        }
        
        const animData = this.playerData.animations[this.currentAnimation];
        if (!animData) return;
        
        const { frameWidth, frameHeight, sheetWidth, sheetHeight, framesPerRow } = this.textureInfo;
        
        // Calculate which frame to display
        const frameX = this.currentFrame % framesPerRow;
        const frameY = animData.row;
        
        // Calculate UV coordinates
        const uOffset = (frameX * frameWidth) / sheetWidth;
        const vOffset = 1 - ((frameY + 1) * frameHeight) / sheetHeight;
        const uRepeat = frameWidth / sheetWidth;
        const vRepeat = frameHeight / sheetHeight;
        
        // Update texture offset and repeat
        this.material.map.offset.set(uOffset, vOffset);
        this.material.map.repeat.set(uRepeat, vRepeat);
        this.material.map.needsUpdate = true;
    }

    // Movement methods
    moveTo(x, y, z) {
        this.position.set(x, y, z);
    }

    setVelocity(vx, vy, vz) {
        this.velocity.set(vx, vy, vz);
        
        // Update facing direction based on movement
        if (vx > 0.1) {
            this.facingDirection = 1;
        } else if (vx < -0.1) {
            this.facingDirection = -1;
        }
        
        // Update animation based on movement and ball possession
        if (Math.abs(vx) > 0.1 || Math.abs(vz) > 0.1) {
            // Moving - check if has ball for dribble animation
            this.setAnimation(this.hasBall ? 'dribble' : 'run');
        } else if (this.isJumping) {
            this.setAnimation('jump');
        } else {
            this.setAnimation('idle');
        }
    }

    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.velocity.y = 10;
            this.setAnimation('jump');
        }
    }

    land() {
        this.isJumping = false;
        this.velocity.y = 0;
        if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
            this.setAnimation(this.hasBall ? 'dribble' : 'run');
        } else {
            this.setAnimation('idle');
        }
    }
    
    // Set whether player has ball (affects animation)
    setHasBall(hasBall) {
        this.hasBall = hasBall;
        // Re-evaluate animation
        if (!this.isJumping) {
            if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
                this.setAnimation(this.hasBall ? 'dribble' : 'run');
            }
        }
    }

    // Utility methods
    getBoundingBox() {
        // Simple bounding box for collision
        return {
            min: new THREE.Vector3(
                this.position.x - 0.5,
                this.position.y,
                this.position.z - 0.5
            ),
            max: new THREE.Vector3(
                this.position.x + 0.5,
                this.position.y + 2,
                this.position.z + 0.5
            )
        };
    }

    dispose() {
        if (this.sprite) {
            this.scene.remove(this.sprite);
            this.material.map.dispose();
            this.material.dispose();
        }
    }
}

// Team generator for sprite players
class SpriteTeamGenerator {
    constructor() {
        this.generator = new SpritePlayerGenerator();
        this.teams = this.initTeams();
    }

    initTeams() {
        return [
            { name: 'Fire', primary: '#FF0000', secondary: '#FFFF00' },
            { name: 'Ice', primary: '#0080FF', secondary: '#FFFFFF' },
            { name: 'Thunder', primary: '#FFD700', secondary: '#000080' },
            { name: 'Shadow', primary: '#4B0082', secondary: '#C0C0C0' },
            { name: 'Neon', primary: '#00FF00', secondary: '#FF00FF' },
            { name: 'Storm', primary: '#708090', secondary: '#00CED1' },
            { name: 'Phoenix', primary: '#FF4500', secondary: '#FFD700' },
            { name: 'Voltage', primary: '#FFFF00', secondary: '#0000FF' }
        ];
    }

    generateTeam(scene, teamIndex = null) {
        const team = teamIndex !== null ? this.teams[teamIndex] : 
                     this.teams[Math.floor(Math.random() * this.teams.length)];
        
        const players = [];
        
        // Generate 2 players per team
        for (let i = 0; i < 2; i++) {
            const playerData = this.generator.generatePlayer({
                teamColors: { primary: team.primary, secondary: team.secondary },
                jerseyNumber: Math.floor(Math.random() * 99) + 1
            });
            
            const player = new SpritePlayer(scene, playerData);
            player.teamName = team.name;
            players.push(player);
        }
        
        return {
            name: team.name,
            colors: team,
            players: players
        };
    }

    generateMatchup(scene) {
        // Pick two different teams
        const team1Index = Math.floor(Math.random() * this.teams.length);
        let team2Index = Math.floor(Math.random() * this.teams.length);
        while (team2Index === team1Index) {
            team2Index = Math.floor(Math.random() * this.teams.length);
        }
        
        return {
            team1: this.generateTeam(scene, team1Index),
            team2: this.generateTeam(scene, team2Index)
        };
    }
}