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

  const playBeep = useCallback(
    (frequency: number, startTime: number, duration: number, peakGain: number, ctx: AudioContext) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.008);
      gain.gain.setValueAtTime(peakGain, startTime + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    },
    [],
  );

  // Zwei aufsteigende Doppel-Beeps – kurz, scharf, klar positiv
  const playSuccess = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    playBeep(900,  t,        0.12, 0.45, ctx);
    playBeep(1400, t + 0.15, 0.15, 0.45, ctx);
  }, [getContext, playBeep]);

  // Drei absteigende Buzzer – laut, tief, penetrant
  const playError = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    playBeep(320, t,        0.18, 0.5, ctx);
    playBeep(260, t + 0.22, 0.18, 0.5, ctx);
    playBeep(200, t + 0.44, 0.22, 0.5, ctx);
  }, [getContext, playBeep]);

  return {
    playSuccess,
    playError,
  };
};

export default useScanSound;

