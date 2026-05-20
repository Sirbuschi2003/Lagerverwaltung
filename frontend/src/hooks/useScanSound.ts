import { useCallback, useEffect, useRef } from "react";
import api from "../utils/api";

type AudioContextClass = typeof AudioContext;
type ExtendedWindow = typeof window & { webkitAudioContext?: AudioContextClass };

const getAudioContextClass = (): AudioContextClass | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as ExtendedWindow).webkitAudioContext;
};

const useScanSound = () => {
  const contextRef    = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const customSuccess = useRef<string | null>(null);
  const customError   = useRef<string | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    const AudioContextImpl = getAudioContextClass();
    if (!AudioContextImpl) return null;
    if (!contextRef.current) {
      const ctx = new AudioContextImpl();
      // Loudness maximizer – komprimiert Peaks statt zu clippen
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.knee.value      = 3;
      comp.ratio.value     = 20;
      comp.attack.value    = 0.001;
      comp.release.value   = 0.1;
      comp.connect(ctx.destination);
      contextRef.current    = ctx;
      compressorRef.current = comp;
    }
    return contextRef.current;
  }, []);

  // Custom sounds beim ersten Rendern laden
  useEffect(() => {
    api.get<{ success: string | null; error: string | null }>("/company/scan-sounds")
      .then(({ data }) => {
        customSuccess.current = data.success;
        customError.current   = data.error;
      })
      .catch(() => { /* kein Custom-Sound – kein Problem */ });
  }, []);

  const playCustom = useCallback((dataUrl: string): boolean => {
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 1.0;
      void audio.play();
      return true;
    } catch {
      return false;
    }
  }, []);

  const playBeep = useCallback(
    (frequency: number, startTime: number, duration: number, ctx: AudioContext, dest: AudioNode) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(1.0, startTime + 0.008);
      gain.gain.setValueAtTime(1.0, startTime + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + duration);
    },
    [],
  );

  // Zwei aufsteigende Beeps – klar positiv
  const playSuccess = useCallback(() => {
    if (customSuccess.current && playCustom(customSuccess.current)) return;
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const dest = compressorRef.current ?? ctx.destination;
    const t = ctx.currentTime;
    playBeep(1000, t,        0.14, ctx, dest);
    playBeep(1600, t + 0.17, 0.18, ctx, dest);
  }, [getContext, playBeep, playCustom]);

  // Drei absteigende Buzzer – penetrant
  const playError = useCallback(() => {
    if (customError.current && playCustom(customError.current)) return;
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const dest = compressorRef.current ?? ctx.destination;
    const t = ctx.currentTime;
    playBeep(300, t,        0.20, ctx, dest);
    playBeep(240, t + 0.25, 0.20, ctx, dest);
    playBeep(180, t + 0.50, 0.25, ctx, dest);
  }, [getContext, playBeep, playCustom]);

  const reloadSounds = useCallback(() => {
    api.get<{ success: string | null; error: string | null }>("/company/scan-sounds")
      .then(({ data }) => {
        customSuccess.current = data.success;
        customError.current   = data.error;
      })
      .catch(() => {});
  }, []);

  return {
    playSuccess,
    playError,
    reloadSounds,
  };
};

export default useScanSound;

