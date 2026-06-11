# Ball Handling, Shooting, and Dunking Implementation Plan

## Overview
Enhance the basketball game with realistic ball handling, dynamic shooting mechanics, and spectacular dunk animations. This plan breaks down the implementation into small, focused tasks.

## Phase 1: Ball Handling Foundation

### Task 1.1: Ball Possession System
- [ ] Create `BallHandler` class to manage ball ownership
- [ ] Implement ball attachment to player when possessed
- [ ] Add visual indicator for who has the ball
- [ ] Prevent multiple players from having ball simultaneously

### Task 1.2: Dribbling Animation
- [ ] Add dribble animation frames to sprite generator
  - Frame 1: Ball at waist height
  - Frame 2: Ball bouncing down
  - Frame 3: Ball at ground
  - Frame 4: Ball bouncing up
- [ ] Create dribble sound effect trigger points
- [ ] Sync ball bounce with player movement speed

### Task 1.3: Ball Physics Enhancement
- [ ] Implement realistic ball drop after score
- [ ] Add ball bounce physics when hitting ground
- [ ] Create random spawn positions within court bounds
- [ ] Add ball rolling physics when on ground

## Phase 2: Shooting Mechanics

### Task 2.1: Shot Detection System
- [ ] Calculate distance from player to nearest hoop
- [ ] Define shooting zones:
  - Close range: < 3 units (dunk zone)
  - Mid range: 3-8 units
  - Long range: > 8 units
- [ ] Create shot power calculation based on distance

### Task 2.2: Shooting Animation
- [ ] Add shooting animation frames to sprite generator
  - Frame 1: Ball at chest (wind up)
  - Frame 2: Ball above head
  - Frame 3: Ball release
  - Frame 4: Follow through
- [ ] Implement shot arc physics
- [ ] Add shot trajectory preview (optional)

### Task 2.3: Shot Success Calculation
- [ ] Implement accuracy system based on:
  - Distance from hoop
  - Player movement (penalty for moving shots)
  - Random factor for excitement
- [ ] Create visual feedback for made/missed shots
- [ ] Add backboard bounce mechanics

## Phase 3: Dunking System

### Task 3.1: Dunk Zone Detection
- [ ] Create invisible trigger zones around hoops
- [ ] Detect when player with ball enters dunk zone
- [ ] Check player velocity for dunk eligibility (must be moving toward hoop)

### Task 3.2: Dunk Animation Types
Create multiple dunk animations:
- [ ] **Basic Dunk**: Simple one-handed slam
  - Jump → Extend arm → Slam → Hang → Land
- [ ] **360 Spin**: Full rotation dunk
  - Jump → Rotate 360° → Slam → Land
- [ ] **Windmill**: Circular arm motion
  - Jump → Windmill motion → Slam → Land
- [ ] **Helicopter**: Spinning with ball extended
  - Jump → Spin horizontally → Slam → Land
- [ ] **Reverse**: Backwards dunk
  - Jump → Turn back to hoop → Slam → Land

### Task 3.3: Dunk Selection System
- [ ] Create random dunk selector
- [ ] Add special dunk conditions:
  - Velocity-based (faster = flashier)
  - Score-based (winning player gets better dunks)
- [ ] Implement dunk animation queue

## Phase 4: Ball Recovery System

### Task 4.1: Post-Score Ball Behavior
- [ ] After made shot/dunk:
  - Ball falls through hoop
  - Bounces realistically
  - Settles at random court position
- [ ] Add "ball available" indicator
- [ ] Reset ball carrier state

### Task 4.2: Ball Pickup Enhancement
- [ ] Improve pickup detection radius
- [ ] Add pickup animation
- [ ] Prevent pickup during certain animations
- [ ] Add steal mechanic (future enhancement)

## Phase 5: Control Enhancements

### Task 5.1: Arrow Key Support
- [ ] Map arrow keys to movement:
  - Up/Down → Forward/Backward
  - Left/Right → Strafe
- [ ] Maintain WASD support
- [ ] Add diagonal movement support

### Task 5.2: Action Button Mapping
- [ ] Standardize controls:
  - E or Enter: Pickup/Shoot/Dunk
  - Space: Jump
  - Shift: Sprint (future)
- [ ] Add controller support prep

## Phase 6: Visual and Audio Feedback

### Task 6.1: Visual Effects
- [ ] Ball trail effect during shots
- [ ] Hoop shake on successful dunk
- [ ] Court impact effects for hard dunks
- [ ] Swish effect for perfect shots

### Task 6.2: Audio Implementation
- [ ] Dribble sounds (synchronized with animation)
- [ ] Shot release sound
- [ ] Swish sound for made shots
- [ ] Rim/backboard sounds for misses
- [ ] Dunk impact sounds (varied by dunk type)
- [ ] Crowd reactions

## Implementation Order

### Week 1: Core Ball Handling
1. Ball possession system (Task 1.1)
2. Basic dribbling (Task 1.2)
3. Ball physics (Task 1.3)
4. Arrow key support (Task 5.1)

### Week 2: Shooting
1. Shot detection (Task 2.1)
2. Shooting animation (Task 2.2)
3. Shot physics and success (Task 2.3)
4. Post-score ball behavior (Task 4.1)

### Week 3: Dunking
1. Dunk zone detection (Task 3.1)
2. Basic dunk animation (Task 3.2 - first type)
3. Additional dunk types (Task 3.2 - remaining)
4. Dunk selection system (Task 3.3)

### Week 4: Polish
1. Visual effects (Task 6.1)
2. Audio implementation (Task 6.2)
3. Ball pickup enhancement (Task 4.2)
4. Testing and balancing

## Technical Specifications

### Ball Attachment Offset
```javascript
// When player has ball
ballOffset = {
  dribbling: { x: 0.5, y: 0.8, z: 0.3 },
  shooting: { x: 0, y: 2.5, z: 0.2 },
  dunking: { x: 0.3, y: 2.8, z: 0.5 }
}
```

### Animation Timing
```javascript
animations = {
  dribble: { frames: 4, duration: 0.5 },
  shoot: { frames: 4, duration: 0.8 },
  dunk_basic: { frames: 5, duration: 1.0 },
  dunk_360: { frames: 8, duration: 1.2 },
  dunk_windmill: { frames: 6, duration: 1.1 }
}
```

### Physics Constants
```javascript
physics = {
  ballGravity: -9.8,
  ballBounce: 0.7,
  ballFriction: 0.98,
  shotArcHeight: 5,
  dunkJumpHeight: 3
}
```

## Success Metrics
- [ ] Smooth ball handling with no glitches
- [ ] Natural-looking shot arcs
- [ ] Exciting dunk animations
- [ ] Responsive controls
- [ ] Fair shooting percentages
- [ ] Fun gameplay loop

## Future Enhancements
- Power-ups affecting shot accuracy
- Combo dunk system
- Alley-oop mechanics
- Block/steal system
- Shot clock
- Three-point line bonus