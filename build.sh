#!/bin/bash

# Build script for The Dunk Contest

echo "Building production version..."

# Run Vite build
npm run build

# Copy server files to dist
echo "Copying server files..."
cp server.js dist/
cp package.json dist/
cp package-lock.json dist/

# Create README for production deployment
cat > dist/README.md << EOL
# The Dunk Contest - Production Build

This is the optimized production build of The Dunk Contest basketball game.

## Deployment Instructions

1. Install dependencies:
   \`\`\`
   npm install --production
   \`\`\`

2. Start the server:
   \`\`\`
   npm start
   \`\`\`

3. Open a browser and navigate to http://localhost:3000
EOL

echo "Build complete! Production files are in the 'dist' directory."
