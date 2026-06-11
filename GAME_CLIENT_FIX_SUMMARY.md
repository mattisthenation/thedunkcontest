# Ball Pickup Fix for game-client.js Implementation

## The Problem
The game is using a different implementation than we initially thought:
- It's using `game-client.js` instead of `game.js`
- The error "player.position.distanceTo is not a function" occurs in `ball-handler.js`
- The player positions are plain objects `{x, y, z}` but the code expects Three.js Vector3 objects

## Fixes Applied

### 1. Fixed ball-handler.js Distance Calculation
Changed the `attemptPickup` method to handle both plain objects and Vector3:
```javascript
// Calculate distance to ball
// Handle both plain objects and Vector3
let distance;
if (player.position.distanceTo) {
    // Three.js Vector3 object
    distance = player.position.distanceTo(this.basketball.position);
} else {
    // Plain object with x, y, z
    const dx = player.position.x - this.basketball.position.x;
    const dy = player.position.y - this.basketball.position.y;
    const dz = player.position.z - this.basketball.position.z;
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
}
```

### 2. Fixed forceDrop Method
Updated to handle both plain objects and Vector3:
```javascript
if (this.carrier.position.copy && this.basketball.position.copy) {
    // Three.js Vector3 objects
    this.basketball.position.copy(this.carrier.position);
    this.basketball.position.y += 1;
} else {
    // Plain objects
    this.basketball.position.x = this.carrier.position.x;
    this.basketball.position.y = this.carrier.position.y + 1;
    this.basketball.position.z = this.carrier.position.z;
}
```

### 3. Added Debug Logging
Added console logs to track:
- When E/Enter is pressed
- Player and ball positions
- Pickup attempts and results
- Any errors in the update loop

### 4. Fixed Server Ball Height
Changed initial ball position from Y=1 to Y=0.3 (ground level) in server.js

## How Ball Pickup Works in This Implementation

1. Player presses E or Enter
2. `game-client.js` checks if player has ball
3. If not, it calls `ballHandler.attemptPickup(localPlayer)`
4. Ball handler checks distance (must be < 2.5 units)
5. If close enough, local pickup succeeds
6. Then `networkManager.requestBallPickup()` syncs with server

## Visual Indicators
- Green ring shows pickup range (2.5 units)
- Yellow ring appears under player with ball
- Both indicators pulse/animate

## Testing Instructions

1. Restart the server
2. Open the game
3. Open browser console (F12)
4. Move near the ball (look for green ring)
5. Press E or Enter
6. Check console for debug messages

## If Still Not Working

Check console for:
- "E/Enter key pressed" message
- Player and ball positions
- Distance calculations
- Any error messages

The issue might be:
- Player position not initialized
- Ball position not set correctly
- Network sync issues
- Key event not registering

## Key Differences from Original Implementation

1. Uses `game-client.js` with class-based structure
2. Has local ball physics simulation
3. Uses sprite-based player system
4. Different network event names
5. More complex animation system
