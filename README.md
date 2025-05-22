# The Dunk Contest with Three.js

A multiplayer basketball dunk contest game with 3D graphics powered by Three.js.

## Development Setup

This project now uses Vite for development and building the Three.js integration.

### Installation

```bash
# Install dependencies
npm install
```

### Development Mode Options

#### Option 1: Original Express Server (with Socket.io)
```bash
# Start the Express server
npm run dev
```
This runs the game with the original Node.js server supporting multiplayer functionality.

#### Option 2: Vite Development Server (for Three.js development)
```bash
# Start Vite development server
npm run vite
```
This runs a local development server with hot module replacement for faster Three.js development. Note that in this mode, Socket.io is mocked for local testing.

### Building for Production

```bash
# Create production build
./build.sh
```
This creates an optimized production build in the `dist` directory.

## Project Structure

- `public/` - Static files and client-side code
  - `js/` - JavaScript files
    - `three/` - Three.js component files
  - `assets/` - Game assets (textures, models, etc.)
  - `css/` - Stylesheets

## Three.js Integration

The game now features an optional 3D mode powered by Three.js. When running the game, click the "Enable 3D Mode" button to activate the 3D rendering.

### Features
- 3D basketball court with proper dimensions and markings
- 3D basketball with physics and collision detection
- Dynamic lighting and shadows
- Particle effects for dunks and other actions
- Enhanced camera animations for special moves

## Development Workflow

1. Use Vite for Three.js development (faster feedback cycle)
2. Test multiplayer functionality with the Express server
3. Build for production when ready to deploy

## License

[MIT License](LICENSE)
