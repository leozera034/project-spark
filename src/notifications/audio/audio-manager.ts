import { getLocalSetting, setLocalSetting } from "@/lib/storage";

class AudioManager {
  private static instance: AudioManager;
  private context: AudioContext | null = null;
  private soundEnabled: boolean = false;
  private volume: number = 0.5;

  private constructor() {
    this.soundEnabled = getLocalSetting('sound_enabled', false);
    this.volume = getLocalSetting('sound_volume', 0.5);
  }

  static getInstance() {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  async unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.soundEnabled = true;
    setLocalSetting('sound_enabled', true);
    return this.context.state === 'running';
  }

  play(pattern: 'new_order' | 'attention' | 'assignment') {
    if (!this.soundEnabled || !this.context || this.context.state !== 'running') return;
    
    // Web Audio API oscillation for MVP (No remote assets)
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    gain.gain.setValueAtTime(this.volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);
    
    if (pattern === 'new_order') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.context.currentTime);
    } else if (pattern === 'attention') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.context.currentTime);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, this.context.currentTime);
    }
    
    osc.start();
    osc.stop(this.context.currentTime + 0.5);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    setLocalSetting('sound_volume', this.volume);
  }

  isEnabled() { return this.soundEnabled && this.context?.state === 'running'; }
}

export const audioManager = AudioManager.getInstance();
