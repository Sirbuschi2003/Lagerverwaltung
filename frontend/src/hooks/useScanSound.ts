import { useCallback, useRef } from "react";

type AudioContextClass = typeof AudioContext;

type ExtendedWindow = typeof window & {
  webkitAudioContext?: AudioContextClass;
};

const getAudioContextClass = (): AudioContextClass | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const extendedWindow = window as ExtendedWindow;
  return window.AudioContext ?? extendedWindow.webkitAudioContext;
};

const useScanSound = () => {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    const AudioContextImpl = getAudioContextClass();
    if (!AudioContextImpl) {
      return null;
    }
    if (!contextRef.current) {
      contextRef.current = new AudioContextImpl();
    }
    return contextRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number) => {
      const ctx = getContext();
      if (!ctx) {
        return;
      }
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    },
    [getContext],
  );

  const playSuccess = useCallback(() => {
    playTone(880);
  }, [playTone]);

  const playError = useCallback(() => {
    playTone(220);
  }, [playTone]);

  return {
    playSuccess,
    playError,
  };
};

export default useScanSound;

