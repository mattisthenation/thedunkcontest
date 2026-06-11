# The Dunk Contest - NBA Jam Style Multiplayer Game

## Overview
A multiplayer basketball game where players compete to pick up the ball and dunk it. Features NBA Jam-style sprite players on a 3D court.

## Features
- Multiplayer support via Socket.io
- Procedurally generated sprite players with unique appearances
- 3D basketball court with hoops
- Pick up and dunk mechanics
- Score tracking
- Random player names and team colors

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser to:
```
http://localhost:3000
```

## How to Play

- **WASD** - Move your player
- **SPACE** - Jump
- **E** - Pick up ball / Attempt dunk (when near hoop)
- **Mouse** - Look around

## Game Rules

1. Players spawn with random appearances and names
2. One basketball is available on the court
3. Pick up the ball by moving near it and pressing E
4. Dunk by getting near a hoop with the ball and pressing E
5. Score 2 points for each successful dunk
6. Ball resets to center after each dunk

## Project Structure

```
/public/
  index.html              - Main game page
  /js/
    game-client.js        - Main game logic
    network-manager.js    - Socket.io client
    sprite-player.js      - Sprite player class
    sprite-player-generator.js - Player sprite generator
    
server.js                 - Game server
package.json             - Dependencies
```

## Next Steps

- Add more animations (shooting, celebrating)
- Implement power-ups
- Add sound effects
- Create tournament mode
- Add team selection