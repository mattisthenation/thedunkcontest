# The Dunk Contest

A multiplayer basketball dunk contest game that supports many concurrent players using Node.js, Express, and Socket.IO.

## Game Description

In this multiplayer basketball game, players compete to recover the basketball and perform dunks to score points. Features include:

- Real-time multiplayer gameplay
- Various basketball outfits for players (professional, street, retro, etc.)
- Automatic name generation for players
- Live scoreboard
- Dynamic court sizing based on player count
- Single basketball and hoop that all players compete for

## Installation

To install and run the game, follow these steps:

```bash
# Navigate to the game directory
cd /Users/matthewlittlehale/Sites/thedunkcontest

# Install dependencies
npm install

# Start the game server
npm start
```

## How to Play

1. Open your browser and navigate to `http://localhost:3000`
2. You will be assigned a random basketball player name
3. Use the following controls:
   - Move: WASD or Arrow Keys
   - Jump/Dunk: Spacebar
   - Get Ball: E key
4. Get the basketball and bring it to the hoop
5. Jump near the hoop while having the ball to perform a dunk and score points
6. The player with the most points wins!

## Deployment

### Local Testing

For local testing, simply run the server on your machine and connect using `http://localhost:3000`.

### Glitch Deployment

To deploy this game on Glitch:

1. Create a new project on Glitch
2. Import this GitHub repository or upload the files
3. Glitch will automatically install dependencies and start your server
4. Share the Glitch URL with friends to play together

## Architecture

The game uses:

- **Node.js** and **Express** for the server
- **Socket.IO** for real-time communication
- HTML5 Canvas for rendering
- JavaScript for game logic

## Future Enhancements

Potential future enhancements include:

- Different types of dunks with varying point values
- Special power-ups or abilities
- Multiple basketball courts/rooms
- Player customization
- Advanced animations and physics
- Mobile support

## License

This project is licensed under the MIT License.
