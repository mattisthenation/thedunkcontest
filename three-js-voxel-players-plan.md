# Voxel-Style Procedural Player Characters Plan

## Overview
Create procedurally generated, voxel-inspired basketball players that capture the 1996 NBA Jam aesthetic with modern Three.js implementation. Players will have a blocky, pixelated appearance while maintaining smooth animations and arcade-style gameplay.

## Visual Style Reference
- **Era**: 1996 NBA Jam aesthetic
- **Style**: Voxel/blocky with pixelated textures
- **Proportions**: Exaggerated heads, athletic bodies
- **Colors**: Vibrant, high-contrast team colors
- **Details**: Low-res textures with visible pixels

## Implementation Phases

### Phase 1: Core Voxel Player Structure
#### Task 1.1: Base Voxel Geometry System
- [x] Create voxel utility class for generating box-based geometry
- [x] Implement voxel merging for optimization
- [x] Set up color/material system for voxels
- [x] Create pixelated texture loader

#### Task 1.2: Player Body Parts Definition
- [x] Define voxel dimensions for each body part:
  - Head: 6x7x6 voxels (slightly rectangular)
  - Torso: 8-10x10x6-8 voxels (varies by build)
  - Arms: 3x10x3 voxels each
  - Legs: 4x12x4 voxels each
  - Feet: 5x2x8 voxels each (integrated into shoes)
- [x] Create attachment point system
- [x] Implement body part hierarchy

#### Task 1.3: Skeletal System
- [x] Create simple bone structure for voxel models
- [ ] Map voxel groups to bones (basic implementation done)
- [ ] Set up joint constraints
- [x] Test basic movement

### Phase 2: Procedural Generation System
#### Task 2.1: Player DNA System
- [x] Create player generation parameters:
  ```javascript
  {
    height: 0.8-1.2 (multiplier),
    build: 'slim' | 'athletic' | 'bulky',
    skinTone: RGB value,
    hairStyle: 0-5 (preset styles),
    facialHair: boolean,
    accessories: ['headband', 'wristbands', 'goggles']
  }
  ```
- [x] Implement random generation with constraints
- [x] Create seed-based generation for consistency

#### Task 2.2: Body Generation
- [x] Implement height variations (modify voxel counts)
- [x] Create three build types with different voxel arrangements
- [ ] Add muscle definition through voxel placement
- [x] Generate unique player silhouettes

#### Task 2.3: Head and Face Generation
- [x] Create base head shapes (rectangular for NBA Jam style)
- [x] Implement pixelated facial features:
  - Eyes: 1x1 voxel blocks
  - Nose: Various small voxel arrangements (simplified)
  - Mouth: Single voxel row (simplified)
- [x] Add hair as additional voxel layers
- [ ] Implement facial hair options

### Phase 3: Clothing and Uniforms
#### Task 3.1: Tank Top Jersey System
- [x] Create jersey mesh that fits over torso voxels
- [x] Implement number display system:
  - 3x5 voxel font for numbers (simplified version)
  - Contrasting color generation
- [x] Add team color variations
- [ ] Create pixelated team logos (optional)

#### Task 3.2: Baggy Shorts
- [x] Design shorts with 90s baggy style
- [ ] Add voxel "wrinkles" for fabric effect
- [x] Implement team color matching
- [x] Add stripe or pattern options

#### Task 3.3: Cool Shoes
- [x] Create 4 shoe designs with voxel detail
- [x] Add brand-inspired (but not branded) elements
- [x] Implement color variations
- [ ] Add "glow" or highlight effects

### Phase 4: Textures and Materials
#### Task 4.1: Pixelated Texture System
- [ ] Create low-res texture generator
- [ ] Implement color palette limitations (16-32 colors)
- [ ] Add dithering effects for shading
- [ ] Create texture atlas for performance

#### Task 4.2: Material Effects
- [ ] Implement flat shading for retro look
- [ ] Add rim lighting for player visibility
- [ ] Create sweat/shine effects
- [ ] Add team color glow for special moves

### Phase 5: Animation System
#### Task 5.1: Basic Animations
- [ ] Idle stance (slight bounce)
- [ ] Running (exaggerated arm swing)
- [ ] Dribbling (hand follows ball)
- [ ] Jump (anticipation and follow-through)

#### Task 5.2: Special Move Animations
- [ ] Dunk approach (speed lines effect)
- [ ] Various dunk styles (tomahawk, windmill, etc.)
- [ ] Celebration animations
- [ ] "On Fire" mode animations

#### Task 5.3: Voxel Animation Techniques
- [ ] Implement voxel deformation for smooth movement
- [ ] Add squash and stretch for arcade feel
- [ ] Create particle effects with mini-voxels
- [ ] Implement animation blending

### Phase 6: Special Effects
#### Task 6.1: NBA Jam-Style Effects
- [ ] "On Fire" mode (flaming voxels)
- [ ] Big head mode compatibility
- [ ] Speed trails using voxel particles
- [ ] Impact effects for dunks

#### Task 6.2: Visual Feedback
- [ ] Player selection highlight
- [ ] Team color aura
- [ ] Power-up indicators
- [ ] Fatigue visualization

### Phase 7: Optimization
#### Task 7.1: Voxel Optimization
- [ ] Implement voxel merging for static parts
- [ ] Use instanced rendering for voxels
- [ ] Create LOD system for distant players
- [ ] Optimize material usage

#### Task 7.2: Performance Testing
- [ ] Test with 10 players on screen
- [ ] Implement quality settings
- [ ] Mobile device optimization
- [ ] Memory usage profiling

## Technical Implementation Details

### Voxel Generation Algorithm
```javascript
class VoxelPlayer {
  constructor(dna) {
    this.dna = dna;
    this.voxelSize = 0.1; // 10cm per voxel
    this.geometry = new THREE.BufferGeometry();
    this.generateBody();
  }

  generateBody() {
    // Generate each body part based on DNA
    const head = this.generateHead();
    const torso = this.generateTorso();
    const arms = this.generateArms();
    const legs = this.generateLegs();
    
    // Merge geometries
    this.mergeBodyParts([head, torso, arms, legs]);
  }
}
```

### Color Palette System
- Primary team colors (2 per team)
- Skin tone variations (8-10 options)
- Hair colors (black, brown, blonde, gray)
- Shoe colors (team-based + special editions)

### File Structure
```
/public/js/
  three-voxel-player.js       # Main player class
  three-voxel-generator.js    # Procedural generation
  three-voxel-animator.js     # Animation system
  three-voxel-effects.js      # Special effects
  three-voxel-utils.js        # Voxel utilities

/public/assets/
  /textures/
    player-palette.png        # Pixelated color palette
    jersey-numbers.png        # Number sprites
  /data/
    player-names.json         # Random name generator
    team-colors.json          # Team color definitions
```

## Development Priority

### Week 1: Foundation
1. Voxel generation system
2. Basic player structure
3. Simple animations

### Week 2: Procedural Generation
1. DNA system implementation
2. Body variation
3. Clothing generation

### Week 3: Polish
1. Textures and materials
2. Special effects
3. Animation refinement

### Week 4: Optimization
1. Performance improvements
2. Multiple player testing
3. Final polish

## Success Metrics
- [ ] Generate 100 unique players without repetition
- [ ] Maintain 60 FPS with 10 players on screen
- [ ] Achieve authentic NBA Jam visual style
- [ ] Smooth animation at all player scales
- [ ] Quick generation time (<100ms per player)

## References
- NBA Jam arcade cabinet screenshots
- Voxel art best practices
- Three.js instanced rendering examples
- Procedural generation techniques