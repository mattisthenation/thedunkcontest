// three-voxel-generator.js - Procedural player generation system

class VoxelPlayerGenerator {
    constructor() {
        this.generatedPlayers = [];
        this.nameDatabase = this.initializeNames();
    }

    initializeNames() {
        // Classic 90s-style basketball names
        const firstNames = [
            'Magic', 'Air', 'Thunder', 'Flash', 'Rocket', 'Slam', 'Turbo', 
            'Blaze', 'Storm', 'Lightning', 'Phoenix', 'Viper', 'Hawk', 'Eagle',
            'Wolf', 'Bear', 'Tiger', 'Dragon', 'Ace', 'King', 'Duke', 'Prince',
            'Ice', 'Fire', 'Steel', 'Iron', 'Gold', 'Silver', 'Diamond', 'Crystal'
        ];
        
        const lastNames = [
            'Johnson', 'Jordan', 'James', 'Davis', 'Brown', 'Wilson', 'Miller',
            'Thunder', 'Lightning', 'Storm', 'Fury', 'Power', 'Force', 'Energy',
            'Slam', 'Dunk', 'Jam', 'Break', 'Crash', 'Smash', 'Boom', 'Bang',
            'Speed', 'Quick', 'Fast', 'Swift', 'Rush', 'Dash', 'Flash', 'Bolt'
        ];
        
        return { firstNames, lastNames };
    }

    generatePlayer(scene, teamColors = null) {
        const dna = {
            height: this.generateHeight(),
            build: this.generateBuild(),
            skinTone: this.generateSkinTone(),
            teamColors: teamColors || this.generateTeamColors(),
            jerseyNumber: this.generateJerseyNumber(),
            hairStyle: Math.floor(Math.random() * 6),
            hasHeadband: Math.random() > 0.7,
            hasWristbands: Math.random() > 0.5,
            shoeStyle: Math.floor(Math.random() * 4),
            name: this.generateName(),
            stats: this.generateStats()
        };
        
        const player = new VoxelPlayer(scene, dna);
        this.generatedPlayers.push(player);
        
        return player;
    }

    generateHeight() {
        // NBA Jam style - most players are tall
        const heights = [
            { value: 0.9, weight: 0.1 },   // Short
            { value: 1.0, weight: 0.3 },   // Average
            { value: 1.1, weight: 0.4 },   // Tall
            { value: 1.2, weight: 0.2 }    // Very tall
        ];
        
        return this.weightedRandom(heights);
    }

    generateBuild() {
        const builds = [
            { value: 'slim', weight: 0.3 },
            { value: 'athletic', weight: 0.5 },
            { value: 'bulky', weight: 0.2 }
        ];
        
        return this.weightedRandom(builds);
    }

    generateSkinTone() {
        const skinTones = [
            0xFFDBAC, // Light
            0xF1C27D, // Light-medium
            0xE0AC69, // Medium
            0xC68642, // Medium-dark
            0x8D5524, // Dark
            0x6B4423  // Deep
        ];
        
        // Weighted distribution for diversity
        const weights = [0.15, 0.15, 0.2, 0.2, 0.15, 0.15];
        const index = this.weightedRandomIndex(weights);
        
        return skinTones[index];
    }

    generateTeamColors() {
        const teams = [
            { primary: 0xFF0000, secondary: 0xFFFFFF, name: 'Fire' },      // Red/White
            { primary: 0x0000FF, secondary: 0xFFD700, name: 'Lightning' }, // Blue/Gold
            { primary: 0x008000, secondary: 0xFFFFFF, name: 'Forest' },    // Green/White
            { primary: 0x800080, secondary: 0xFFD700, name: 'Royals' },    // Purple/Gold
            { primary: 0xFF4500, secondary: 0x000080, name: 'Suns' },      // Orange/Navy
            { primary: 0x000000, secondary: 0xC0C0C0, name: 'Shadow' },    // Black/Silver
            { primary: 0x00FFFF, secondary: 0xFF1493, name: 'Neon' },      // Cyan/Pink
            { primary: 0xFFFF00, secondary: 0x000000, name: 'Voltage' }    // Yellow/Black
        ];
        
        return teams[Math.floor(Math.random() * teams.length)];
    }

    generateJerseyNumber() {
        // Popular basketball numbers with weights
        const popularNumbers = [23, 3, 1, 7, 11, 13, 21, 24, 32, 33, 34];
        
        if (Math.random() < 0.3) {
            // 30% chance of popular number
            return popularNumbers[Math.floor(Math.random() * popularNumbers.length)];
        } else {
            // Random number 0-99
            return Math.floor(Math.random() * 100);
        }
    }

    generateName() {
        const first = this.nameDatabase.firstNames[
            Math.floor(Math.random() * this.nameDatabase.firstNames.length)
        ];
        const last = this.nameDatabase.lastNames[
            Math.floor(Math.random() * this.nameDatabase.lastNames.length)
        ];
        
        return `${first} ${last}`;
    }

    generateStats() {
        // NBA Jam style stats
        return {
            speed: Math.floor(Math.random() * 10) + 1,
            dunking: Math.floor(Math.random() * 10) + 1,
            shooting: Math.floor(Math.random() * 10) + 1,
            defense: Math.floor(Math.random() * 10) + 1,
            // Special abilities
            onFireChance: Math.random() * 0.3,
            clutchFactor: Math.random()
        };
    }

    generateTeam(scene, teamColors, playerCount = 2) {
        const team = [];
        
        for (let i = 0; i < playerCount; i++) {
            const player = this.generatePlayer(scene, teamColors);
            team.push(player);
        }
        
        return team;
    }

    generateRandomMatchup(scene) {
        // Generate two teams with different colors
        const team1Colors = this.generateTeamColors();
        let team2Colors = this.generateTeamColors();
        
        // Ensure teams have different colors
        while (team1Colors.primary === team2Colors.primary) {
            team2Colors = this.generateTeamColors();
        }
        
        const team1 = this.generateTeam(scene, team1Colors);
        const team2 = this.generateTeam(scene, team2Colors);
        
        return {
            team1: {
                players: team1,
                colors: team1Colors
            },
            team2: {
                players: team2,
                colors: team2Colors
            }
        };
    }

    // Utility functions
    weightedRandom(items) {
        const weights = items.map(item => item.weight);
        const index = this.weightedRandomIndex(weights);
        return items[index].value;
    }

    weightedRandomIndex(weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return i;
            }
        }
        
        return weights.length - 1;
    }

    // Get a unique player seed to avoid duplicates
    getUniquePlayerSeed() {
        return Date.now() + Math.random();
    }

    // Clear all generated players from scene
    clearAllPlayers() {
        this.generatedPlayers.forEach(player => {
            if (player.group.parent) {
                player.group.parent.remove(player.group);
            }
        });
        this.generatedPlayers = [];
    }

    // Get player by index
    getPlayer(index) {
        return this.generatedPlayers[index] || null;
    }

    // Update all players
    updateAll(deltaTime) {
        this.generatedPlayers.forEach(player => {
            player.update(deltaTime);
        });
    }
}