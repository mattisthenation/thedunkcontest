// game-scene.js - Three.js scene setup with court and hoops

class GameScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.courtBounds = {
            width: 20,
            height: 30,
            hoopHeight: 3,
            hoopPositions: [
                { x: 0, y: 3, z: -13 },
                { x: 0, y: 3, z: 13 }
            ]
        };
    }

    init(container = document.body) {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2C5F8F); // Dark blue sky
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 2, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        // Setup lights
        this.setupLights();
        
        // Create court
        this.create3DCourt();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        return {
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer
        };
    }

    setupLights() {
        // Bright ambient for good sprite visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Directional light for court shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    create3DCourt() {
        // Main court floor
        const courtGeometry = new THREE.PlaneGeometry(this.courtBounds.width, this.courtBounds.height);
        const courtMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xD2691E, // Wood color
            shininess: 80
        });
        const court = new THREE.Mesh(courtGeometry, courtMaterial);
        court.rotation.x = -Math.PI / 2;
        court.receiveShadow = true;
        this.scene.add(court);
        
        // Court lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        
        // Center line
        const centerLineGeometry = new THREE.PlaneGeometry(0.2, this.courtBounds.width);
        const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.rotation.z = Math.PI / 2;
        centerLine.position.y = 0.01;
        this.scene.add(centerLine);
        
        // Three-point lines
        const arcRadius = 6.75;
        const arcGeometry = new THREE.RingGeometry(arcRadius - 0.1, arcRadius + 0.1, 32, 1, 0, Math.PI);
        
        const leftArc = new THREE.Mesh(arcGeometry, lineMaterial);
        leftArc.rotation.x = -Math.PI / 2;
        leftArc.position.set(0, 0.01, -10);
        this.scene.add(leftArc);
        
        const rightArc = new THREE.Mesh(arcGeometry, lineMaterial);
        rightArc.rotation.x = -Math.PI / 2;
        rightArc.rotation.z = Math.PI;
        rightArc.position.set(0, 0.01, 10);
        this.scene.add(rightArc);
        
        // Free throw lines
        const freeThrowGeometry = new THREE.PlaneGeometry(6, 0.2);
        const leftFreeThrow = new THREE.Mesh(freeThrowGeometry, lineMaterial);
        leftFreeThrow.rotation.x = -Math.PI / 2;
        leftFreeThrow.position.set(0, 0.01, -9);
        this.scene.add(leftFreeThrow);
        
        const rightFreeThrow = leftFreeThrow.clone();
        rightFreeThrow.position.set(0, 0.01, 9);
        this.scene.add(rightFreeThrow);
        
        // Add hoops
        this.courtBounds.hoopPositions.forEach(pos => {
            this.createHoop(pos.x, pos.y, pos.z);
        });
    }

    createHoop(x, y, z) {
        // Backboard
        const backboardGeometry = new THREE.BoxGeometry(6, 4, 0.2);
        const backboardMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
        backboard.position.set(x, y + 1.5, z);
        backboard.castShadow = true;
        backboard.receiveShadow = true;
        this.scene.add(backboard);
        
        // Backboard frame
        const frameMaterial = new THREE.MeshPhongMaterial({ color: 0xFF4500 });
        const frameThickness = 0.1;
        
        // Top frame
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(6.2, frameThickness, 0.3),
            frameMaterial
        );
        topFrame.position.set(x, y + 3.5, z);
        this.scene.add(topFrame);
        
        // Bottom frame
        const bottomFrame = topFrame.clone();
        bottomFrame.position.set(x, y - 0.5, z);
        this.scene.add(bottomFrame);
        
        // Side frames
        const sideFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, 4, 0.3),
            frameMaterial
        );
        sideFrame.position.set(x - 3, y + 1.5, z);
        this.scene.add(sideFrame);
        
        const sideFrame2 = sideFrame.clone();
        sideFrame2.position.set(x + 3, y + 1.5, z);
        this.scene.add(sideFrame2);
        
        // Rim
        const rimGeometry = new THREE.TorusGeometry(0.75, 0.05, 8, 16);
        const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xFF4500 });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(x, y, z > 0 ? z - 1.2 : z + 1.2);
        rim.castShadow = true;
        this.scene.add(rim);
        
        // Store rim position for game logic
        rim.userData = { 
            isHoop: true, 
            position: rim.position.clone(),
            side: z > 0 ? 'far' : 'near'
        };
        
        // Net
        const netGeometry = new THREE.CylinderGeometry(0.75, 0.5, 0.8, 8, 1, true);
        const netMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const net = new THREE.Mesh(netGeometry, netMaterial);
        net.position.set(x, y - 0.4, z > 0 ? z - 1.2 : z + 1.2);
        this.scene.add(net);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // Helper method to get world coordinates from court coordinates
    courtToWorld(courtX, courtY) {
        // Original game uses 800x600 court
        // Our 3D court is 20x30 units
        const worldX = (courtX - 400) / 40; // Center at 0, scale down
        const worldZ = (courtY - 300) / 20; // Center at 0, scale down
        return { x: worldX, y: 0, z: -worldZ }; // Negative Z because of camera orientation
    }

    // Get hoop positions in world coordinates
    getHoopPositions() {
        return this.courtBounds.hoopPositions;
    }
}