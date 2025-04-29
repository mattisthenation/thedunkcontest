// Debug information
console.log('Debug script loaded');

// Function to check if Socket.IO is connected
function checkSocketConnection() {
  if (typeof io === 'undefined') {
    console.error('Socket.IO not loaded!');
    document.body.innerHTML = '<h1>Error: Socket.IO not loaded!</h1><p>Check your network connection and reload the page.</p>';
    return false;
  }
  
  console.log('Socket.IO is available. Attempting connection...');
  return true;
}

// Function to check if canvas is accessible
function checkCanvas() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element not found!');
    return false;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context!');
    return false;
  }
  
  console.log('Canvas is ready for rendering');
  
  // Test render something simple
  ctx.fillStyle = 'red';
  ctx.fillRect(10, 10, 50, 50);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('Canvas working', 80, 40);
  
  return true;
}

// Export functions to window for testing in console
window.debugGame = {
  checkSocketConnection,
  checkCanvas
};

// Run checks when script loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, running debug checks...');
  checkCanvas();
  checkSocketConnection();
});
