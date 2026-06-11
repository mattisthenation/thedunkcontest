// game-players.js - Player management with sprite integration

class GamePlayers {
    constructor(scene) {
        this.scene = scene;
        this.players = new Map();
        this.localPlayerId = null;
        this.spriteGenerator = new SpritePlayerGenerator();
        this.playerLabels = new Map();
    }

    createPlayer(playerData) {
        // Generate sprite configuration based on server data
        const spriteConfig = {
            teamColors: {
                primary: playerData.outfit.primaryColor,
                secondary: playerData.outfit.secondaryColor
            },
            jerseyNumber: playerData.spriteConfig.jerseyNumber,
            hairStyle: playerData.spriteConfig.hairStyle,
            bodyType: playerData.spriteConfig.bodyType
        };

        // Generate player sprite
        const spriteData = this.spriteGenerator.generatePlayer(spriteConfig);
        const spritePlayer = new SpritePlayer(this.scene, spriteData);

        // Set initial position
        const worldPos = this.gameToWorldCoords(playerData.x, playerData.y);
        spritePlayer.moveTo(worldPos.x, worldPos.y, worldPos.z);

        // Store player info
        const player = {
            id: playerData.id,
            name: playerData.name,
            sprite: spritePlayer,
            data: playerData,
            targetPosition: { ...worldPos },
            interpolationFactor: 0
        };

        this.players.set(playerData.id, player);

        // Create name label
        this.createNameLabel(player);

        return player;
    }

    createNameLabel(player) {
        // Create a div for the player name that will be positioned above the sprite
        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name-label';
        nameDiv.style.cssText = `
            position: absolute;
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            text-shadow: 2px 2px 2px black;
            pointer-events: none;
            white-space: nowrap;
        `;
        nameDiv.textContent = player.name;
        document.body.appendChild(nameDiv);
        
        this.playerLabels.set(player.id, nameDiv);
    }

    updatePlayer(playerId, playerData) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Update target position for interpolation
        const worldPos = this.gameToWorldCoords(playerData.x, playerData.y);
        player.targetPosition = worldPos;
        player.interpolationFactor = 0;

        // Update player data
        player.data = { ...player.data, ...playerData };

        // Update animation based on movement
        const isMoving = Math.abs(player.data.x - playerData.x) > 1 || 
                        Math.abs(player.data.y - playerData.y) > 1;
        
        if (player.data.isJumping) {
            player.sprite.setAnimation('jump');
        } else if (isMoving) {
            player.sprite.setAnimation('run');
        } else {
            player.sprite.setAnimation('idle');
        }
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Remove sprite
        player.sprite.dispose();

        // Remove name label
        const label = this.playerLabels.get(playerId);
        if (label) {
            label.remove();
            this.playerLabels.delete(playerId);
        }

        this.players.delete(playerId);
    }

    setLocalPlayer(playerId) {
        this.localPlayerId = playerId;
    }

    getLocalPlayer() {
        return this.players.get(this.localPlayerId);
    }

    update(deltaTime, camera, renderer) {
        // Update all players
        this.players.forEach(player => {
            // Smooth interpolation
            player.interpolationFactor = Math.min(1, player.interpolationFactor + deltaTime * 5);
            
            const currentPos = player.sprite.position;
            const targetPos = player.targetPosition;
            
            // Interpolate position
            const newX = currentPos.x + (targetPos.x - currentPos.x) * player.interpolationFactor;
            const newZ = currentPos.z + (targetPos.z - currentPos.z) * player.interpolationFactor;
            const newY = player.data.isJumping ? 
                Math.sin(player.interpolationFactor * Math.PI) * 2 : 0;
            
            player.sprite.moveTo(newX, newY, newZ);

            // Update sprite animation
            player.sprite.update(deltaTime);

            // Update facing direction based on movement
            if (Math.abs(targetPos.x - currentPos.x) > 0.1) {
                player.sprite.facingDirection = targetPos.x > currentPos.x ? 1 : -1;
            }

            // Update name label position
            this.updateNameLabel(player, camera, renderer);
        });
    }

    updateNameLabel(player, camera, renderer) {
        const label = this.playerLabels.get(player.id);
        if (!label) return;

        // Get sprite position in screen coordinates
        const spritePos = player.sprite.sprite.position.clone();
        spritePos.y += 2.5; // Above the sprite

        // Project to screen coordinates
        const screenPos = spritePos.project(camera);
        
        // Convert to pixel coordinates
        const x = (screenPos.x * 0.5 + 0.5) * renderer.domElement.width;
        const y = (-screenPos.y * 0.5 + 0.5) * renderer.domElement.height;

        // Update label position
        label.style.left = `${x}px`;
        label.style.top = `${y - 20}px`;
        label.style.transform = 'translateX(-50%)';

        // Hide label if player is behind camera
        label.style.display = screenPos.z > 1 ? 'none' : 'block';
    }

    gameToWorldCoords(gameX, gameY) {
        // Convert from original game coords (800x600) to world coords
        const worldX = (gameX - 400) / 40;
        const worldZ = -(gameY - 300) / 20; // Negative because of camera orientation
        return { x: worldX, y: 0, z: worldZ };
    }

    worldToGameCoords(worldX, worldZ) {
        // Convert from world coords to original game coords
        const gameX = worldX * 40 + 400;
        const gameY = -worldZ * 20 + 300;
        return { x: gameX, y: gameY };
    }

    getAllPlayers() {
        return Array.from(this.players.values());
    }

    getPlayerCount() {
        return this.players.size;
    }
}