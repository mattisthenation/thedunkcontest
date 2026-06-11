# Ball Pickup Fix for The Dunk Contest

## Issues Identified

1. **Socket Event Mismatch**: 
   - Client sends `'getBall'` event
   - Server listens for `'pickupBall'` event
   - Result: Ball pickup never works

2. **Coordinate System Mismatch**:
   - Client uses 2D coordinates (0-800, 0-600)
   - Server expects 3D coordinates (-10 to 10, -15 to 15)
   - Result: Distance calculations are wrong

3. **Missing Game State Structure**:
   - Client expects `basketball` object
   - Server has `ball` object
   - Different property names cause issues

4. **Movement Events Missing**:
   - Client sends `'playerMovement'` 
   - Server expects `'move'` with different data structure

## Fix Implementation

### Step 1: Update Client Event Names
In `game.js`, change the E key handler:
```javascript
// Change from:
socket.emit('getBall');
// To:
socket.emit('pickupBall');
```

### Step 2: Fix Movement Updates
The client needs to send the proper format the server expects:
```javascript
// In updatePlayerPosition() function
socket.emit('move', {
  position: { 
    x: player.x, 
    y: 0,  // Always 0 for ground level
    z: player.y  // Map Y to Z for 3D
  },
  velocity: { x: 0, y: 0, z: 0 },
  animation: moved ? 'run' : 'idle',
  facingDirection: 1
});
```

### Step 3: Fix Game State Reception
Update the initial game state handler to properly map server data to client expectations.

### Step 4: Proper Coordinate Conversion
The server uses 3D coordinates, but the client game logic still uses 2D. We need to:
- Convert 2D client positions to 3D before sending to server
- Convert 3D server positions to 2D when receiving

## Complete Fix Files

I'll create the complete fixed versions of the necessary files.
