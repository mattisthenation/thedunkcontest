// dev-main.js - Entry point for Vite development mode
import './js/debug.js';
import './js/sound.js';
import './js/particles.js';
import './js/game.js';
import './js/three-init.js';

// Create a mock Socket.io for development if needed
if (typeof io === 'undefined') {
  console.log('Socket.io not found, creating mock for development');
  
  window.io = function() {
    const mockListeners = {};
    
    const mockSocket = {
      id: 'dev-player-' + Math.floor(Math.random() * 10000),
      
      on: function(event, callback) {
        mockListeners[event] = callback;
        console.log(`[Mock Socket] Registered listener for ${event}`);
        
        // Immediately trigger gameState event with mock data
        if (event === 'gameState') {
          const mockGameState = createMockGameState();
          setTimeout(() => callback(mockGameState), 500);
        }
      },
      
      emit: function(event, data) {
        console.log(`[Mock Socket] Emitted event ${event}`, data);
        
        // Mock server responses
        if (event === 'playerMovement') {
          // Update mock state
          if (window.players && window.players[mockSocket.id]) {
            window.players[mockSocket.id].x = data.x;
            window.players[mockSocket.id].y = data.y;
          }
        } else if (event === 'playerJump') {
          // Trigger jump event
          if (mockListeners['playerJumped']) {
            mockListeners['playerJumped']({ playerId: mockSocket.id });
            
            // Simulate landing after 1 second
            setTimeout(() => {
              if (mockListeners['playerLanded']) {
                mockListeners['playerLanded']({ playerId: mockSocket.id });
              }
            }, 1000);
          }
        } else if (event === 'getBall') {
          // Try to get ball
          if (window.basketball && !window.basketball.possessedBy) {
            const player = window.players[mockSocket.id];
            
            if (player && Math.abs(player.x - window.basketball.x) < 30 && 
                Math.abs(player.y - window.basketball.y) < 30) {
              
              window.basketball.possessedBy = mockSocket.id;
              player.hasBall = true;
              
              // Update ball position
              window.basketball.x = player.x;
              window.basketball.y = player.y - 10;
              
              // Trigger ball possession event
              if (mockListeners['ballPossession']) {
                mockListeners['ballPossession']({
                  playerId: mockSocket.id,
                  basketball: window.basketball
                });
              }
            }
          }
        }
      }
    };
    
    return mockSocket;
  };
  
  // Create mock game state
  function createMockGameState() {
    const mockPlayerId = 'dev-player-' + Math.floor(Math.random() * 10000);
    
    const mockPlayers = {
      [mockPlayerId]: {
        id: mockPlayerId,
        name: 'Dev Player',
        x: 400,
        y: 450,
        outfit: {
          type: 'professional',
          primaryColor: '#FF0000',
          secondaryColor: '#FFFFFF'
        },
        hasBall: false,
        score: 0,
        isJumping: false
      }
    };
    
    const mockBasketball = {
      x: 400,
      y: 300,
      possessedBy: null
    };
    
    const mockCourt = {
      width: 800,
      height: 600,
      hoopX: 400,
      hoopY: 90
    };
    
    // Set global variables
    window.players = mockPlayers;
    window.basketball = mockBasketball;
    window.court = mockCourt;
    
    return {
      players: mockPlayers,
      basketball: mockBasketball,
      court: mockCourt
    };
  }
}
