// simple-three-test.js - A completely standalone Three.js test

// Create the scene when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Simple Three.js test starting');
  
  // Create container
  const container = document.createElement('div');
  container.id = 'three-simple-test';
  container.style.position = 'absolute';
  container.style.top = '10px';
  container.style.right = '10px';
  container.style.width = '200px';
  container.style.height = '150px';
  container.style.border = '2px solid blue';
  container.style.zIndex = '1000';
  document.body.appendChild(container);
  
  // Create scene
  const scene = new THREE.Scene();
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(75, 200/150, 0.1, 1000);
  camera.position.z = 5;
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(200, 150);
  renderer.setClearColor(0x000033);
  container.appendChild(renderer.domElement);
  
  // Create basketball
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xff6600, 
    wireframe: true 
  });
  const ball = new THREE.Mesh(geometry, material);
  scene.add(ball);
  
  // Add light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1);
  scene.add(light);
  
  // Animation function
  function animate() {
    requestAnimationFrame(animate);
    
    // Rotate basketball
    ball.rotation.x += 0.01;
    ball.rotation.y += 0.01;
    
    // Render scene
    renderer.render(scene, camera);
  }
  
  // Start animation
  animate();
  
  console.log('Simple Three.js test running');
});
