// Initialize Three.js integration when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing Three.js');
  // Wait a moment to ensure the original game is initialized
  setTimeout(initThreeJS, 1000);
});

// Initialize Three.js
function initThreeJS() {
  console.log('Initializing Three.js integration');

  // Import Three.js integration
  import('./three-game.js')
    .then(module => {
      console.log('Three.js module loaded successfully');
      const ThreeGame = module.default;
      
      // Add initialization button
      const enableButton = document.createElement('button');
      enableButton.id = 'enable-threejs';
      enableButton.textContent = 'Enable 3D Mode';
      enableButton.style.position = 'absolute';
      enableButton.style.top = '10px';
      enableButton.style.left = '50%';
      enableButton.style.transform = 'translateX(-50%)';
      enableButton.style.zIndex = '1000';
      enableButton.style.padding = '10px 15px';
      enableButton.style.backgroundColor = '#ff9900';
      enableButton.style.color = 'white';
      enableButton.style.border = 'none';
      enableButton.style.borderRadius = '5px';
      enableButton.style.fontWeight = 'bold';
      enableButton.style.cursor = 'pointer';
      
      // Get game container
      const gameContainer = document.getElementById('game-container');
      if (!gameContainer) {
        console.error('Game container not found!');
        return;
      }
      
      gameContainer.appendChild(enableButton);
      console.log('Added 3D mode button to the game container');
      
      // Add event listener to button
      enableButton.addEventListener('click', function() {
        console.log('3D mode button clicked');
        
        try {
          // Get game canvas
          const gameCanvas = document.getElementById('game-canvas');
          if (!gameCanvas) {
            console.error('Game canvas not found!');
            return;
          }
          
          // Initialize Three.js game
          ThreeGame.init({
            container: gameContainer,
            canvas: gameCanvas,
            debug: false,
            showStats: true
          });
          
          // Remove button
          enableButton.remove();
          
          // Add sync with original game
          setupGameSync(ThreeGame);
          
          console.log('Three.js game initialized successfully!');
        } catch (error) {
          console.error('Error initializing Three.js:', error);
          alert('Failed to initialize 3D mode. See console for details.');
        }
      });
    })
    .catch(err => {
      console.error('Failed to load Three.js integration:', err);
      // Show error message to user
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'absolute';
      errorDiv.style.top = '50px';
      errorDiv.style.left = '50%';
      errorDiv.style.transform = 'translateX(-50%)';
      errorDiv.style.background = 'rgba(255, 0, 0, 0.8)';
      errorDiv.style.color = 'white';
      errorDiv.style.padding = '10px 20px';
      errorDiv.style.borderRadius = '5px';
      errorDiv.style.fontWeight = 'bold';
      errorDiv.style.zIndex = '1000';
      errorDiv.textContent = 'Failed to load 3D mode: ' + err.message;
      document.body.appendChild(errorDiv);
    });
}

// Set up synchronization with the original game
function setupGameSync(ThreeGame) {
  console.log('Setting up game sync');
  
  try {
    // Save original game loop
    const originalGameLoop = window.gameLoop;
    
    if (!originalGameLoop) {
      console.error('Original game loop not found!');
      return;
    }
    
    // Override game loop
    window.gameLoop = function() {
      // Call original game loop
      originalGameLoop();
      
      // Sync game state with Three.js
      if (window.players && window.basketball && window.court) {
        ThreeGame.syncGameState({
          players: window.players,
          basketball: window.basketball,
          court: window.court
        });
      }
    };
    
    // Hook into dunk events
    const originalShowDunkEffect = window.showDunkEffect;
    if (originalShowDunkEffect) {
      window.showDunkEffect = function(player, startPos, endPos, hoopX, hoopY) {
        // Call original function
        originalShowDunkEffect(player, startPos, endPos, hoopX, hoopY);
        
        // Trigger Three.js dunk animation
        ThreeGame.handleDunk({
          playerId: player.id,
          startPosition: startPos,
          dunkPosition: endPos,
          hoopPosition: { x: hoopX, y: hoopY }
        });
      };
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
      ThreeGame.resize();
    });
    
    console.log('Game sync setup complete');
  } catch (error) {
    console.error('Error setting up game sync:', error);
  }
}
