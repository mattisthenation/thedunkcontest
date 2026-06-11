// three-voxel-player.js - Main voxel player class

class VoxelPlayer {
    constructor(scene, dna = null) {
        this.scene = scene;
        this.voxelUtils = new VoxelUtils();
        this.group = new THREE.Group();
        
        // Generate DNA if not provided
        this.dna = dna || this.generateDNA();
        
        // Body parts
        this.head = null;
        this.torso = null;
        this.leftArm = null;
        this.rightArm = null;
        this.leftLeg = null;
        this.rightLeg = null;
        
        // Animation properties
        this.animationTime = 0;
        this.currentAnimation = 'idle';
        
        // Build the player
        this.buildPlayer();
    }

    generateDNA() {
        return {
            height: 0.9 + Math.random() * 0.3, // 0.9 to 1.2
            build: ['slim', 'athletic', 'bulky'][Math.floor(Math.random() * 3)],
            skinTone: this.voxelUtils.generateSkinTone(),
            teamColors: this.voxelUtils.generateTeamColors(),
            jerseyNumber: Math.floor(Math.random() * 99) + 1,
            hairStyle: Math.floor(Math.random() * 6),
            hasHeadband: Math.random() > 0.7,
            hasWristbands: Math.random() > 0.5,
            shoeStyle: Math.floor(Math.random() * 4)
        };
    }

    buildPlayer() {
        // Clear existing geometry
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }

        // Build body parts based on DNA
        this.createHead();
        this.createTorso();
        this.createArms();
        this.createLegs();
        this.createJersey();
        this.createShorts();
        this.createShoes();

        // Apply height scaling
        this.group.scale.set(this.dna.height, this.dna.height, this.dna.height);

        // Add to scene
        this.scene.add(this.group);
    }

    createHead() {
        const headGroup = new THREE.Group();
        
        // Base head shape (slightly rectangular for NBA Jam style)
        const headSize = 6;
        const head = this.voxelUtils.createVoxelBox(headSize, headSize + 1, headSize, this.dna.skinTone);
        headGroup.add(head);

        // Eyes (simple black voxels)
        const leftEye = this.voxelUtils.createVoxel(2, 4, 0, 0x000000);
        const rightEye = this.voxelUtils.createVoxel(4, 4, 0, 0x000000);
        headGroup.add(leftEye);
        headGroup.add(rightEye);

        // Hair (based on hairStyle)
        this.addHair(headGroup);

        // Headband if applicable
        if (this.dna.hasHeadband) {
            this.addHeadband(headGroup);
        }

        headGroup.position.set(0, 20 * this.voxelUtils.voxelSize, 0);
        this.head = headGroup;
        this.group.add(headGroup);
    }

    createTorso() {
        const torsoGroup = new THREE.Group();
        
        // Base torso dimensions based on build
        let width = 8;
        let depth = 6;
        const height = 10;

        if (this.dna.build === 'bulky') {
            width = 10;
            depth = 8;
        } else if (this.dna.build === 'slim') {
            width = 7;
            depth = 5;
        }

        const torso = this.voxelUtils.createVoxelBox(width, height, depth, this.dna.skinTone);
        torsoGroup.add(torso);

        torsoGroup.position.set(0, 10 * this.voxelUtils.voxelSize, 0);
        this.torso = torsoGroup;
        this.group.add(torsoGroup);
    }

    createArms() {
        // Left arm
        const leftArmGroup = new THREE.Group();
        const armLength = 10;
        const armWidth = 3;
        
        const leftArm = this.voxelUtils.createVoxelBox(armWidth, armLength, armWidth, this.dna.skinTone);
        leftArmGroup.add(leftArm);
        
        if (this.dna.hasWristbands) {
            const wristband = this.voxelUtils.createVoxelBox(armWidth + 1, 2, armWidth + 1, this.dna.teamColors.primary);
            wristband.position.set(0, -3 * this.voxelUtils.voxelSize, 0);
            leftArmGroup.add(wristband);
        }
        
        leftArmGroup.position.set(-6 * this.voxelUtils.voxelSize, 15 * this.voxelUtils.voxelSize, 0);
        this.leftArm = leftArmGroup;
        this.group.add(leftArmGroup);

        // Right arm (mirror of left)
        const rightArmGroup = leftArmGroup.clone();
        rightArmGroup.position.set(6 * this.voxelUtils.voxelSize, 15 * this.voxelUtils.voxelSize, 0);
        this.rightArm = rightArmGroup;
        this.group.add(rightArmGroup);
    }

    createLegs() {
        // Left leg
        const leftLegGroup = new THREE.Group();
        const legLength = 12;
        const legWidth = 4;
        
        const leftLeg = this.voxelUtils.createVoxelBox(legWidth, legLength, legWidth, this.dna.skinTone);
        leftLegGroup.add(leftLeg);
        
        leftLegGroup.position.set(-2 * this.voxelUtils.voxelSize, 0, 0);
        this.leftLeg = leftLegGroup;
        this.group.add(leftLegGroup);

        // Right leg
        const rightLegGroup = leftLegGroup.clone();
        rightLegGroup.position.set(2 * this.voxelUtils.voxelSize, 0, 0);
        this.rightLeg = rightLegGroup;
        this.group.add(rightLegGroup);
    }

    createJersey() {
        const jerseyGroup = new THREE.Group();
        
        // Jersey is slightly larger than torso
        let width = 9;
        let depth = 7;
        const height = 11;

        if (this.dna.build === 'bulky') {
            width = 11;
            depth = 9;
        } else if (this.dna.build === 'slim') {
            width = 8;
            depth = 6;
        }

        // Create jersey with team color
        const jersey = this.voxelUtils.createVoxelBox(width, height, depth, this.dna.teamColors.primary);
        jerseyGroup.add(jersey);

        // Add number (simplified for now - would need proper voxel font)
        this.addJerseyNumber(jerseyGroup);

        jerseyGroup.position.set(0, 10 * this.voxelUtils.voxelSize, 0);
        this.group.add(jerseyGroup);
    }

    createShorts() {
        const shortsGroup = new THREE.Group();
        
        // Baggy 90s style shorts
        const shortsTop = this.voxelUtils.createVoxelBox(10, 2, 8, this.dna.teamColors.primary);
        const shortsMiddle = this.voxelUtils.createVoxelBox(11, 3, 9, this.dna.teamColors.primary);
        const shortsBottom = this.voxelUtils.createVoxelBox(12, 3, 10, this.dna.teamColors.primary);
        
        shortsMiddle.position.set(0, -2 * this.voxelUtils.voxelSize, 0);
        shortsBottom.position.set(0, -5 * this.voxelUtils.voxelSize, 0);
        
        shortsGroup.add(shortsTop);
        shortsGroup.add(shortsMiddle);
        shortsGroup.add(shortsBottom);
        
        // Add stripe detail
        const stripe = this.voxelUtils.createVoxelBox(1, 8, 10, this.dna.teamColors.secondary);
        stripe.position.set(-5.5 * this.voxelUtils.voxelSize, -4 * this.voxelUtils.voxelSize, 0);
        shortsGroup.add(stripe);
        
        const stripe2 = stripe.clone();
        stripe2.position.set(5.5 * this.voxelUtils.voxelSize, -4 * this.voxelUtils.voxelSize, 0);
        shortsGroup.add(stripe2);
        
        shortsGroup.position.set(0, 5 * this.voxelUtils.voxelSize, 0);
        this.group.add(shortsGroup);
    }

    createShoes() {
        // Different shoe styles
        const shoeColor = [0xFFFFFF, 0x000000, this.dna.teamColors.primary, 0xFF0000][this.dna.shoeStyle];
        
        // Left shoe
        const leftShoeGroup = new THREE.Group();
        const shoeBase = this.voxelUtils.createVoxelBox(5, 2, 8, shoeColor);
        const shoeTip = this.voxelUtils.createVoxelBox(5, 2, 2, shoeColor);
        shoeTip.position.set(0, 0, -5 * this.voxelUtils.voxelSize);
        
        leftShoeGroup.add(shoeBase);
        leftShoeGroup.add(shoeTip);
        
        // Add shoe details
        const accent = this.voxelUtils.createVoxelBox(5, 1, 1, this.dna.teamColors.secondary);
        accent.position.set(0, 1.5 * this.voxelUtils.voxelSize, 2 * this.voxelUtils.voxelSize);
        leftShoeGroup.add(accent);
        
        leftShoeGroup.position.set(-2 * this.voxelUtils.voxelSize, -1 * this.voxelUtils.voxelSize, 0);
        this.group.add(leftShoeGroup);
        
        // Right shoe
        const rightShoeGroup = leftShoeGroup.clone();
        rightShoeGroup.position.set(2 * this.voxelUtils.voxelSize, -1 * this.voxelUtils.voxelSize, 0);
        this.group.add(rightShoeGroup);
    }

    addHair(headGroup) {
        const hairColor = 0x000000; // Black hair for now
        
        switch (this.dna.hairStyle) {
            case 0: // Bald
                break;
            case 1: // Short
                const shortHair = this.voxelUtils.createVoxelBox(6, 2, 6, hairColor);
                shortHair.position.set(0, 4 * this.voxelUtils.voxelSize, 0);
                headGroup.add(shortHair);
                break;
            case 2: // Flat top
                const flatTop = this.voxelUtils.createVoxelBox(5, 3, 5, hairColor);
                flatTop.position.set(0, 4 * this.voxelUtils.voxelSize, 0);
                headGroup.add(flatTop);
                break;
            case 3: // Afro
                const afro = this.voxelUtils.createVoxelSphere(4, hairColor);
                afro.position.set(0, 3 * this.voxelUtils.voxelSize, 0);
                headGroup.add(afro);
                break;
            case 4: // Mohawk
                const mohawk = this.voxelUtils.createVoxelBox(2, 4, 6, hairColor);
                mohawk.position.set(0, 4 * this.voxelUtils.voxelSize, 0);
                headGroup.add(mohawk);
                break;
            case 5: // Cornrows
                for (let i = 0; i < 5; i++) {
                    const row = this.voxelUtils.createVoxelBox(1, 1, 6, hairColor);
                    row.position.set((i - 2) * this.voxelUtils.voxelSize, 3.5 * this.voxelUtils.voxelSize, 0);
                    headGroup.add(row);
                }
                break;
        }
    }

    addHeadband(headGroup) {
        const headband = this.voxelUtils.createVoxelBox(7, 1, 7, this.dna.teamColors.primary);
        headband.position.set(0, 3 * this.voxelUtils.voxelSize, 0);
        headGroup.add(headband);
    }

    addJerseyNumber(jerseyGroup) {
        // Simplified number display - in full implementation would use voxel font
        const numberVoxels = this.voxelUtils.createVoxelBox(3, 5, 1, this.dna.teamColors.secondary);
        numberVoxels.position.set(0, 0, -3.5 * this.voxelUtils.voxelSize);
        jerseyGroup.add(numberVoxels);
    }

    // Animation methods
    update(deltaTime) {
        this.animationTime += deltaTime;
        
        switch (this.currentAnimation) {
            case 'idle':
                this.animateIdle();
                break;
            case 'run':
                this.animateRun();
                break;
            case 'jump':
                this.animateJump();
                break;
        }
    }

    animateIdle() {
        // Subtle breathing animation
        const breathScale = 1 + Math.sin(this.animationTime * 2) * 0.02;
        if (this.torso) {
            this.torso.scale.set(1, breathScale, 1);
        }
    }

    animateRun() {
        // Arm and leg swing
        const swing = Math.sin(this.animationTime * 10) * 0.5;
        
        if (this.leftArm) this.leftArm.rotation.x = swing;
        if (this.rightArm) this.rightArm.rotation.x = -swing;
        if (this.leftLeg) this.leftLeg.rotation.x = -swing * 0.7;
        if (this.rightLeg) this.rightLeg.rotation.x = swing * 0.7;
    }

    animateJump() {
        // Simple jump animation
        const jumpHeight = Math.max(0, Math.sin(this.animationTime * 5));
        this.group.position.y = jumpHeight * 2;
    }

    setAnimation(animationName) {
        this.currentAnimation = animationName;
        this.animationTime = 0;
        
        // Reset rotations
        if (this.leftArm) this.leftArm.rotation.set(0, 0, 0);
        if (this.rightArm) this.rightArm.rotation.set(0, 0, 0);
        if (this.leftLeg) this.leftLeg.rotation.set(0, 0, 0);
        if (this.rightLeg) this.rightLeg.rotation.set(0, 0, 0);
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    setRotation(y) {
        this.group.rotation.y = y;
    }
}