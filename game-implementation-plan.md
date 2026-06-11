# NBA Jam Style Dunk Contest - Implementation Plan

## Overview
Rebuild "The Dunk Contest" multiplayer game using:
- Three.js for 3D rendering
- Sprite-based player models from sprite-demo
- Socket.io for real-time multiplayer
- Original game mechanics (pick up ball, dunk it)

## Architecture

### Client-Side Structure
```
/public/
  index.html              - Main game page
  /js/
    game-main.js         - Main game initialization and loop
    game-scene.js        - Three.js scene setup (court, lights, camera)
    game-players.js      - Player management and sprite integration
    game-ball.js         - Basketball object and physics
    game-network.js      - Socket.io client handling
    game-input.js        - Keyboard/mouse input handling
    game-ui.js           - Score display and game UI
    
    (existing sprite files)
    sprite-player-generator.js
    sprite-player.js
```

### Server-Side Structure
```
server.js                - Existing Socket.io server (minimal changes needed)
```

## Implementation Steps

### Phase 1: Core Setup
1. Create new index.html with Three.js
2. Set up basic Three.js scene (game-scene.js)
3. Copy court and hoop setup from sprite-demo
4. Initialize Socket.io connection

### Phase 2: Player System
1. Integrate sprite player generator
2. Create player manager for multiplayer
3. Handle player join/leave with sprites
4. Sync player positions and animations

### Phase 3: Game Mechanics
1. Create 3D basketball object
2. Implement ball pickup mechanics
3. Add dunk detection in 3D space
4. Handle scoring and feedback

### Phase 4: Polish
1. Add UI for scores and player names
2. Implement smooth interpolation
3. Add sound effects
4. Optimize performance

## Key Features to Implement

### 1. Player Management
- Generate unique sprite for each player
- Assign team colors from server outfit data
- Display player names above sprites
- Handle multiple players smoothly

### 2. Basketball Mechanics
- 3D ball with physics
- Pickup detection (proximity based)
- Ball follows player when possessed
- Reset after successful dunk

### 3. Dunk Detection
- Check player position relative to hoop
- Trigger dunk animation
- Update score
- Reset ball position

### 4. Network Synchronization
- Player positions (x, y, z)
- Animation states (idle, run, jump)
- Ball possession
- Score updates

## Technical Specifications

### Court Dimensions (from sprite-demo)
- Size: 20x30 units
- Hoop height: 3 units
- Hoop positions: (0, 3, -13) and (0, 3, 13)

### Player Specifications
- Height: ~2 units (sprite scale)
- Movement speed: 5 units/second
- Jump height: adjustable for dunking

### Camera Setup
- Position: (0, 8, 12)
- LookAt: (0, 2, 0)
- FOV: 60 degrees