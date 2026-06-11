// shot-system.js - Handles shooting and dunking mechanics

class ShotSystem {
    constructor(scene, ballHandler) {
        this.scene = scene;
        this.ballHandler = ballHandler;
        
        // Shot zones (distance from hoop)
        this.zones = {
            dunk: 3,        // < 3 units: dunk zone
            closeRange: 5,  // 3-5 units: close shot
            midRange: 8,    // 5-8 units: mid range
            longRange: 12   // 8-12 units: long range
            // > 12 units: very long range
        };
        
        // Hoop positions
        this.hoops = [
            { position: new THREE.Vector3(0, 3, -13), name: 'left' },
            { position: new THREE.Vector3(0, 3, 13), name: 'right' }
        ];
        
        // Visual helpers for debugging (optional)
        this.showZones = false;
        if (this.showZones) {
            this.createZoneVisualizers();
        }
    }
    
    // Get the nearest hoop and distance to a player
    getNearestHoop(playerPosition) {
        let nearestHoop = null;
        let minDistance = Infinity;
        
        this.hoops.forEach(hoop => {
            // Calculate horizontal distance only (ignore Y)
            const dx = playerPosition.x - hoop.position.x;
            const dz = playerPosition.z - hoop.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestHoop = hoop;
            }
        });
        
        return { hoop: nearestHoop, distance: minDistance };
    }
    
    // Determine what action to take based on player position
    determineAction(player) {
        if (!player.hasBall) {
            return { action: 'none', reason: 'no ball' };
        }
        
        const { hoop, distance } = this.getNearestHoop(player.position);
        
        // Check if player is moving toward hoop (for dunk eligibility)
        // Handle both Vector3 and plain objects
        let playerPos;
        if (player.position.x !== undefined) {
            playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
        } else {
            playerPos = player.position;
        }
        
        const toHoop = new THREE.Vector3()
            .subVectors(hoop.position, playerPos)
            .normalize();
        
        const playerDirection = new THREE.Vector3(
            player.velocity.x,
            0,
            player.velocity.z
        ).normalize();
        
        const movingTowardHoop = toHoop.dot(playerDirection) > 0.5;
        const speed = Math.sqrt(
            player.velocity.x * player.velocity.x + 
            player.velocity.z * player.velocity.z
        );
        
        // Determine action based on distance and movement
        if (distance < this.zones.dunk) {
            console.log('In dunk zone! Distance:', distance);
            console.log('Moving toward hoop:', movingTowardHoop);
            console.log('Speed:', speed);
            
            // In dunk zone - make dunking easier
            // Remove the movement requirement or make it very lenient
            if (speed > 0.5 || player.position.y > 0.1) { // Much lower speed requirement
                return {
                    action: 'dunk',
                    hoop: hoop,
                    distance: distance,
                    type: this.selectDunkType(player, Math.max(speed, 2)) // Ensure min speed for dunk selection
                };
            } else {
                // Too slow - but still prefer dunk if very close
                if (distance < 1.5) {
                    return {
                        action: 'dunk',
                        hoop: hoop,
                        distance: distance,
                        type: 'basic' // Basic dunk when standing still
                    };
                }
                // Otherwise close shot
                return {
                    action: 'shoot',
                    hoop: hoop,
                    distance: distance,
                    zone: 'close',
                    accuracy: 0.9 // 90% chance
                };
            }
        } else if (distance < this.zones.closeRange) {
            return {
                action: 'shoot',
                hoop: hoop,
                distance: distance,
                zone: 'close',
                accuracy: 0.8 // 80% chance
            };
        } else if (distance < this.zones.midRange) {
            return {
                action: 'shoot',
                hoop: hoop,
                distance: distance,
                zone: 'mid',
                accuracy: 0.6 // 60% chance
            };
        } else if (distance < this.zones.longRange) {
            return {
                action: 'shoot',
                hoop: hoop,
                distance: distance,
                zone: 'long',
                accuracy: 0.4 // 40% chance
            };
        } else {
            return {
                action: 'shoot',
                hoop: hoop,
                distance: distance,
                zone: 'very_long',
                accuracy: 0.2 // 20% chance
            };
        }
    }
    
    // Select which dunk animation to use
    selectDunkType(player, speed) {
        const dunkTypes = [
            { name: 'basic', weight: 2 },
            { name: '360', weight: 3, minSpeed: 2 },
            { name: 'windmill', weight: 3, minSpeed: 2.5 },
            { name: 'reverse', weight: 2.5 },
            { name: 'helicopter', weight: 2, minSpeed: 3 }
        ];
        
        // Filter by speed requirement
        const eligible = dunkTypes.filter(dunk => 
            !dunk.minSpeed || speed >= dunk.minSpeed
        );
        
        // If no special dunks eligible, use basic
        if (eligible.length === 0) {
            return 'basic';
        }
        
        // Weighted random selection
        const totalWeight = eligible.reduce((sum, dunk) => sum + dunk.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const dunk of eligible) {
            random -= dunk.weight;
            if (random <= 0) {
                console.log('Selected dunk type:', dunk.name);
                return dunk.name;
            }
        }
        
        return eligible[0].name; // Fallback
    }
    
    // Calculate shot trajectory
    calculateShotTrajectory(startPos, hoop, zone) {
        const gravity = -9.8;
        
        // Ensure startPos is a Vector3
        let startPosVec;
        if (startPos.isVector3) {
            startPosVec = startPos;
        } else {
            startPosVec = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
        }
        
        const distance = new THREE.Vector3()
            .subVectors(hoop.position, startPosVec).length();
        
        // Calculate required velocity based on zone
        const arcHeight = {
            close: 2,
            mid: 3,
            long: 4,
            very_long: 5
        }[zone] || 3;
        
        // Physics calculation for parabolic trajectory
        const time = Math.sqrt(2 * arcHeight / Math.abs(gravity));
        const vx = (hoop.position.x - startPosVec.x) / (2 * time);
        const vz = (hoop.position.z - startPosVec.z) / (2 * time);
        const vy = Math.abs(gravity) * time;
        
        return new THREE.Vector3(vx, vy, vz);
    }
    
    // Execute a shot
    executeShot(player, actionInfo) {
        console.log('Executing shot for player:', player);
        console.log('Action info:', actionInfo);
        
        // Handle both Vector3 and plain objects
        let startPos;
        if (player.position.clone) {
            startPos = player.position.clone();
        } else {
            startPos = new THREE.Vector3(
                player.position.x,
                player.position.y,
                player.position.z
            );
        }
        startPos.y += 2.5; // Release height
        
        const trajectory = this.calculateShotTrajectory(
            startPos,
            actionInfo.hoop,
            actionInfo.zone
        );
        
        // Add some randomness for realism
        trajectory.x += (Math.random() - 0.5) * 0.5;
        trajectory.z += (Math.random() - 0.5) * 0.5;
        
        // Release ball with trajectory
        this.ballHandler.release(trajectory);
        
        // Determine if shot will go in
        const willScore = Math.random() < actionInfo.accuracy;
        
        return {
            trajectory: trajectory,
            willScore: willScore,
            hoop: actionInfo.hoop
        };
    }
    
    // Create visual zones for debugging
    createZoneVisualizers() {
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        
        this.hoops.forEach(hoop => {
            // Dunk zone
            const dunkGeometry = new THREE.CircleGeometry(this.zones.dunk, 32);
            const dunkZone = new THREE.Mesh(dunkGeometry, material);
            dunkZone.rotation.x = -Math.PI / 2;
            dunkZone.position.copy(hoop.position);
            dunkZone.position.y = 0.1;
            this.scene.add(dunkZone);
        });
    }
}