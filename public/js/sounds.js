// Sound manager for The Dunk Contest
// This file handles loading and playing game sounds

// Sound effects object
const SoundManager = {
  sounds: {},
  soundsLoaded: false,
  soundsEnabled: true,
  
  // Initialize sounds
  init: function() {
    // Define the sounds we need
    const soundFiles = {
      dunk: 'sounds/dunk.mp3',
      bounce: 'sounds/bounce.mp3',
      whistle: 'sounds/whistle.mp3',
      crowd: 'sounds/crowd.mp3',
      swoosh: 'sounds/swoosh.mp3'
    };
    
    // Create audio elements
    for (const [name, path] of Object.entries(soundFiles)) {
      this.sounds[name] = new Audio(path);
      
      // Set up event listener to track when sound is loaded
      this.sounds[name].addEventListener('canplaythrough', () => {
        console.log(`Sound loaded: ${name}`);
      }, { once: true });
      
      // Handle loading errors
      this.sounds[name].addEventListener('error', (e) => {
        console.warn(`Error loading sound: ${name}`, e);
      });
    }
    
    // Ambient crowd noise setup (looping)
    if (this.sounds.crowd) {
      this.sounds.crowd.loop = true;
      this.sounds.crowd.volume = 0.2;
    }
    
    this.soundsLoaded = true;
    console.log('Sound manager initialized');
  },
  
  // Play a sound
  play: function(soundName, options = {}) {
    if (!this.soundsEnabled || !this.sounds[soundName]) return;
    
    try {
      // Reset the sound if it's already playing
      this.sounds[soundName].currentTime = 0;
      
      // Apply options
      if (options.volume !== undefined) {
        this.sounds[soundName].volume = options.volume;
      }
      
      // Play the sound
      this.sounds[soundName].play().catch(e => {
        console.warn(`Could not play sound: ${soundName}`, e);
      });
    } catch (e) {
      console.error(`Error playing sound: ${soundName}`, e);
    }
  },
  
  // Stop a specific sound
  stop: function(soundName) {
    if (this.sounds[soundName]) {
      this.sounds[soundName].pause();
      this.sounds[soundName].currentTime = 0;
    }
  },
  
  // Stop all sounds
  stopAll: function() {
    for (const sound of Object.values(this.sounds)) {
      sound.pause();
      sound.currentTime = 0;
    }
  },
  
  // Toggle sounds on/off
  toggleSounds: function() {
    this.soundsEnabled = !this.soundsEnabled;
    
    if (!this.soundsEnabled) {
      this.stopAll();
    } else if (this.sounds.crowd) {
      // Restart ambient crowd noise if sounds are turned back on
      this.sounds.crowd.play().catch(e => {
        console.warn('Could not play crowd sound', e);
      });
    }
    
    return this.soundsEnabled;
  },
  
  // Play special dunk sound effect
  playDunkEffect: function() {
    // Play multiple sounds for a more impressive effect
    this.play('dunk', { volume: 0.8 });
    setTimeout(() => this.play('crowd', { volume: 0.5 }), 300);
    setTimeout(() => this.play('swoosh', { volume: 0.6 }), 100);
  }
};

// Make sounds available globally
window.SoundManager = SoundManager;

// Initialize sound system when page loads
document.addEventListener('DOMContentLoaded', () => {
  // A short delay to let the page finish loading
  setTimeout(() => {
    SoundManager.init();
  }, 500);
});
