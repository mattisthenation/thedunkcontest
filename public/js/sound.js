// Sound system for the basketball game
// Provides 3D audio effects based on position and events

class SoundManager {
  constructor() {
    this.sounds = {};
    this.audioContext = null;
    this.masterGain = null;
    this.initialized = false;
    this.muted = false;
  }

  // Initialize the audio system
  init() {
    try {
      // Create audio context
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Create master volume
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5; // 50% volume by default
      this.masterGain.connect(this.audioContext.destination);
      
      // Pre-load essential sound effects
      this.loadSound('bounce', 'bounce.mp3');
      this.loadSound('dunk', 'dunk.mp3');
      this.loadSound('swish', 'swish.mp3');
      this.loadSound('crowd', 'crowd.mp3');
      
      this.initialized = true;
      console.log('Sound system initialized');
      
      return true;
    } catch (e) {
      console.error('Sound system failed to initialize:', e);
      return false;
    }
  }
  
  // Load a sound effect
  loadSound(name, filename) {
    // For development, we'll use synthesized sounds
    // In production, you would load actual files
    this.sounds[name] = {
      buffer: null,
      loaded: true,
      synthesize: () => {
        const buffer = this.audioContext.createBuffer(
          1, // mono
          this.audioContext.sampleRate * 1, // 1 second duration
          this.audioContext.sampleRate
        );
        
        // Get channel data
        const channelData = buffer.getChannelData(0);
        
        // Fill with appropriate waveform based on sound type
        switch(name) {
          case 'bounce':
            // Short decreasing frequency sound
            for (let i = 0; i < channelData.length; i++) {
              const t = i / this.audioContext.sampleRate; // Time in seconds
              const decay = Math.exp(-15 * t); // Exponential decay
              const freq = 150 + 200 * decay; // Decreasing frequency
              channelData[i] = decay * Math.sin(2 * Math.PI * freq * t);
            }
            break;
            
          case 'dunk':
            // Deeper impact sound with reverb
            for (let i = 0; i < channelData.length; i++) {
              const t = i / this.audioContext.sampleRate;
              const decay = Math.exp(-8 * t);
              const freq1 = 80; // Low frequency
              const freq2 = 120; // Slightly higher
              channelData[i] = decay * (
                0.7 * Math.sin(2 * Math.PI * freq1 * t) +
                0.3 * Math.sin(2 * Math.PI * freq2 * t)
              );
            }
            break;
            
          case 'swish':
            // High-frequency "swoosh" sound
            for (let i = 0; i < channelData.length; i++) {
              const t = i / this.audioContext.sampleRate;
              const attack = Math.min(1, t * 10); // Quick attack
              const decay = Math.exp(-5 * t); // Medium decay
              const freq = 800 + 400 * Math.sin(2 * Math.PI * 2 * t); // Modulated frequency
              channelData[i] = 0.7 * attack * decay * Math.sin(2 * Math.PI * freq * t);
            }
            break;
            
          case 'crowd':
            // Crowd "ooh" sound
            for (let i = 0; i < channelData.length; i++) {
              const t = i / this.audioContext.sampleRate;
              const attack = Math.min(1, t * 2); // Slow attack
              const decay = t < 0.5 ? 1 : Math.exp(-3 * (t - 0.5)); // Sustain then decay
              
              // Multiple frequencies for richer sound
              const noise = Math.random() * 0.1; // Add some noise
              const freq1 = 200 + 50 * Math.sin(2 * Math.PI * 0.5 * t); // Base crowd hum
              const freq2 = 300; // Higher pitch
              
              channelData[i] = attack * decay * (
                0.6 * Math.sin(2 * Math.PI * freq1 * t) +
                0.3 * Math.sin(2 * Math.PI * freq2 * t) +
                noise
              );
            }
            break;
            
          default:
            // Default beep sound
            for (let i = 0; i < channelData.length; i++) {
              const t = i / this.audioContext.sampleRate;
              channelData[i] = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-5 * t);
            }
        }
        
        return buffer;
      }
    };
  }
  
  // Play a sound with options
  play(name, options = {}) {
    if (!this.initialized || this.muted) return;
    
    const sound = this.sounds[name];
    if (!sound || !sound.loaded) return;
    
    try {
      // Create buffer source
      const source = this.audioContext.createBufferSource();
      
      // Synthesize the sound if needed
      if (!sound.buffer && sound.synthesize) {
        sound.buffer = sound.synthesize();
      }
      
      source.buffer = sound.buffer;
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = options.volume || 1.0;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      // Play sound
      source.start(0);
      
      return source;
    } catch (e) {
      console.error(`Error playing sound "${name}":`, e);
      return null;
    }
  }
  
  // Play dunk effect - combination of sounds
  playDunkEffect() {
    if (!this.initialized || this.muted) return;
    
    // Play dunk sound
    this.play('dunk', { volume: 0.7 });
    
    // Play swish sound with slight delay
    setTimeout(() => {
      this.play('swish', { volume: 0.5 });
    }, 100);
    
    // Play crowd reaction with more delay
    setTimeout(() => {
      this.play('crowd', { volume: 0.8 });
    }, 300);
  }
  
  // Set master volume
  setVolume(value) {
    if (!this.initialized) return;
    
    // Clamp value between 0 and 1
    value = Math.max(0, Math.min(1, value));
    this.masterGain.gain.value = value;
  }
  
  // Mute/unmute all sounds
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// Create global sound manager instance
window.SoundManager = new SoundManager();

// Initialize sound system when document is ready
document.addEventListener('DOMContentLoaded', () => {
  // Try to initialize sound system
  window.SoundManager.init();
  
  // Add volume control in game UI if needed
  const addVolumeControl = () => {
    const gameInfo = document.getElementById('game-info');
    if (!gameInfo) return;
    
    const volumeControl = document.createElement('div');
    volumeControl.innerHTML = `
      <div style="margin-top:15px;">
        <label for="volume-slider">Sound: </label>
        <input type="range" id="volume-slider" min="0" max="100" value="50" style="width:100px;">
        <button id="mute-button" style="margin-left:5px;">Mute</button>
      </div>
    `;
    
    gameInfo.appendChild(volumeControl);
    
    // Add event listeners
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      window.SoundManager.setVolume(e.target.value / 100);
    });
    
    document.getElementById('mute-button').addEventListener('click', () => {
      const muted = window.SoundManager.toggleMute();
      document.getElementById('mute-button').textContent = muted ? 'Unmute' : 'Mute';
    });
  };
  
  // Add volume control after a short delay to ensure DOM is ready
  setTimeout(addVolumeControl, 1000);
});
