// three-test.js - Simple test of Three.js functionality
console.log('Three.js test script loaded');

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, running Three.js test');
  
  // Try to initialize Three.js
  try {
    if (typeof THREE === 'undefined') {
      console.error('THREE is not defined - Three.js not loaded');
      addErrorMessage('Three.js library not loaded correctly.');
      return;
    }
    
    console.log('THREE is defined, version:', THREE.REVISION);
    
    // Create a simple Three.js scene
    const container = document.createElement('div');
    container.id = 'three-test-container';
    container.style.position = 'absolute';
    container.style.top = '100px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = '300px';
    container.style.height = '200px';
    container.style.border = '2px solid #ff9900';
    document.body.appendChild(container);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(300, 200);
    renderer.setClearColor(0x333333);
    container.appendChild(renderer.domElement);
    
    // Create scene
    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, 300 / 200, 0.1, 1000);
    camera.position.z = 5;
    
    // Create a cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xff9900, wireframe: true });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Add light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    
    // Animation function
    function animate() {
      requestAnimationFrame(animate);
      
      // Rotate cube
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      // Render scene
      renderer.render(scene, camera);
    }
    
    // Start animation
    animate();
    
    // Add success message
    addSuccessMessage('Three.js test successful! You should see a rotating cube above.');
    
  } catch (error) {
    console.error('Error initializing Three.js:', error);
    addErrorMessage('Error initializing Three.js: ' + error.message);
  }
});

// Helper function to add error message to the page
function addErrorMessage(message) {
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
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
}

// Helper function to add success message to the page
function addSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.style.position = 'absolute';
  successDiv.style.top = '50px';
  successDiv.style.left = '50%';
  successDiv.style.transform = 'translateX(-50%)';
  successDiv.style.background = 'rgba(0, 128, 0, 0.8)';
  successDiv.style.color = 'white';
  successDiv.style.padding = '10px 20px';
  successDiv.style.borderRadius = '5px';
  successDiv.style.fontWeight = 'bold';
  successDiv.style.zIndex = '1000';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
}
