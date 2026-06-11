// three-voxel-utils.js - Voxel utility class for generating box-based geometry

class VoxelUtils {
    constructor() {
        this.voxelSize = 0.05; // 5cm per voxel for good proportions
        this.geometryCache = new Map();
        this.colorCache = new Map();
    }

    // Create a single voxel at a specific position with color
    createVoxel(x, y, z, color = 0xffffff) {
        const geometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
        const material = this.getVoxelMaterial(color);
        const voxel = new THREE.Mesh(geometry, material);
        
        voxel.position.set(
            x * this.voxelSize,
            y * this.voxelSize,
            z * this.voxelSize
        );
        
        return voxel;
    }

    // Get or create a material with pixelated appearance
    getVoxelMaterial(color) {
        const colorKey = color.toString(16);
        
        if (!this.colorCache.has(colorKey)) {
            const material = new THREE.MeshPhongMaterial({
                color: color,
                flatShading: true, // Important for blocky look
                shininess: 30,
                specular: 0x222222
            });
            this.colorCache.set(colorKey, material);
        }
        
        return this.colorCache.get(colorKey);
    }

    // Create a group of voxels from a 3D array pattern
    createVoxelGroup(pattern, colors) {
        const group = new THREE.Group();
        
        for (let x = 0; x < pattern.length; x++) {
            for (let y = 0; y < pattern[x].length; y++) {
                for (let z = 0; z < pattern[x][y].length; z++) {
                    if (pattern[x][y][z] === 1) {
                        const color = colors[x] && colors[x][y] && colors[x][y][z] 
                            ? colors[x][y][z] 
                            : 0xffffff;
                        const voxel = this.createVoxel(x, y, z, color);
                        group.add(voxel);
                    }
                }
            }
        }
        
        return group;
    }

    // Merge multiple voxel meshes into a single geometry for performance
    mergeVoxels(voxelGroup) {
        const geometries = [];
        const materials = [];
        const materialMap = new Map();
        
        voxelGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const material = child.material;
                const color = material.color.getHex();
                
                if (!materialMap.has(color)) {
                    materialMap.set(color, materials.length);
                    materials.push(material);
                }
                
                const geometry = child.geometry.clone();
                geometry.applyMatrix4(child.matrixWorld);
                
                // Add material index to geometry
                const materialIndex = materialMap.get(color);
                const count = geometry.attributes.position.count;
                const indices = new Array(count / 3).fill(materialIndex);
                geometry.addGroup(0, count, materialIndex);
                
                geometries.push(geometry);
            }
        });
        
        const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        return new THREE.Mesh(mergedGeometry, materials);
    }

    // Create a rectangular box of voxels (useful for body parts)
    createVoxelBox(width, height, depth, color) {
        const group = new THREE.Group();
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    const voxel = this.createVoxel(x, y, z, color);
                    group.add(voxel);
                }
            }
        }
        
        // Center the group
        group.position.set(
            -width * this.voxelSize / 2,
            -height * this.voxelSize / 2,
            -depth * this.voxelSize / 2
        );
        
        return group;
    }

    // Create a sphere-like arrangement of voxels (useful for heads)
    createVoxelSphere(radius, color) {
        const group = new THREE.Group();
        const center = radius;
        
        for (let x = 0; x <= radius * 2; x++) {
            for (let y = 0; y <= radius * 2; y++) {
                for (let z = 0; z <= radius * 2; z++) {
                    const dx = x - center;
                    const dy = y - center;
                    const dz = z - center;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance <= radius && distance >= radius - 1) {
                        const voxel = this.createVoxel(x, y, z, color);
                        group.add(voxel);
                    }
                }
            }
        }
        
        // Center the sphere
        group.position.set(
            -center * this.voxelSize,
            -center * this.voxelSize,
            -center * this.voxelSize
        );
        
        return group;
    }

    // Add pixelated texture to a voxel material
    createPixelatedTexture(canvas, width = 32, height = 32) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        return texture;
    }

    // Generate a color palette for team colors
    generateTeamColors() {
        const teams = [
            { primary: 0xFF0000, secondary: 0xFFFFFF }, // Red/White
            { primary: 0x0000FF, secondary: 0xFFD700 }, // Blue/Gold
            { primary: 0x008000, secondary: 0xFFFFFF }, // Green/White
            { primary: 0x800080, secondary: 0xFFD700 }, // Purple/Gold
            { primary: 0xFF4500, secondary: 0x000080 }, // Orange/Navy
            { primary: 0x000000, secondary: 0xC0C0C0 }, // Black/Silver
            { primary: 0x8B4513, secondary: 0xFFD700 }, // Brown/Gold
            { primary: 0x008080, secondary: 0xFF1493 }  // Teal/Pink
        ];
        
        return teams[Math.floor(Math.random() * teams.length)];
    }

    // Generate skin tone variations
    generateSkinTone() {
        const skinTones = [
            0xFFDBAC, // Light
            0xF1C27D, // Light-medium
            0xE0AC69, // Medium
            0xC68642, // Medium-dark
            0x8D5524, // Dark
            0x6B4423  // Deep
        ];
        
        return skinTones[Math.floor(Math.random() * skinTones.length)];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoxelUtils;
}