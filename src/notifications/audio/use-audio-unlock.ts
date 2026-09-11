import { useState, useCallback } from 'react';
import { audioManager } from './audio-manager';

export function useAudioUnlock() {
  const [isUnlocked, setIsUnlocked] = useState(() => audioManager.isEnabled());

  const unlock = useCallback(async () => {
    const success = await audioManager.unlock();
    setIsUnlocked(success);
    return success;
  }, []);

  return { isUnlocked, unlock };
}
