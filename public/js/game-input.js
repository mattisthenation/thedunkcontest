// game-input.js - Keyboard and mouse input handling

class GameInput {
    constructor() {
        this.keys = {};
        this.mousePosition = { x: 0, y: 0 };
        this.enabled = true;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            this.keys[e.code] = true;
            
            // Prevent default for game keys
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE'].includes(e.code)) {
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse events
        document.addEventListener('mousemove', (e) => {
            this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Prevent scrolling with space
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
            }
        });
    }

    getMovementVector() {
        const vector = { x: 0, z: 0 };
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vector.z = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vector.z = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vector.x = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vector.x = 1;
        
        // Normalize diagonal movement
        const length = Math.sqrt(vector.x * vector.x + vector.z * vector.z);
        if (length > 0) {
            vector.x /= length;
            vector.z /= length;
        }
        
        return vector;
    }

    isJumping() {
        return this.keys['Space'] === true;
    }

    isGrabbingBall() {
        return this.keys['KeyE'] === true;
    }

    getMousePosition() {
        return { ...this.mousePosition };
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Clear all keys when disabled
            this.keys = {};
        }
    }

    isEnabled() {
        return this.enabled;
    }

    // Check if any movement key is pressed
    isMoving() {
        return this.keys['KeyW'] || this.keys['KeyA'] || 
               this.keys['KeyS'] || this.keys['KeyD'] ||
               this.keys['ArrowUp'] || this.keys['ArrowDown'] ||
               this.keys['ArrowLeft'] || this.keys['ArrowRight'];
    }
}