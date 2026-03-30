import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface UseBarcodeScannerProps {
  onDetected: (code: string) => void;
  enabled?: boolean;
}

const PREFERRED_DEVICE_KEY = "kfz-app-preferred-camera";
const PREFERRED_DEVICE_VERSION = 3;
const SCAN_INTERVAL_MS = 80;
const MIN_ACCEPTABLE_CAMERA_SCORE = 600;

interface StoredCameraPreference {
  deviceId: string;
  version: number;
  score?: number;
  updatedAt?: number;
}

const CAMERA_SCORE_LABEL_BONUS: Array<{ keywords: string[]; score: number }> = [
  { keywords: ["back", "rear", "hinten", "rueck"], score: 120 },
  { keywords: ["main", "standard", "primary", "camera 1", "1.0", "1,0", "1x", "1,0x"], score: 260 },
  { keywords: ["camera 0", "back 0"], score: 520 },
];

const CAMERA_SCORE_LABEL_PENALTY: Array<{ keywords: string[]; score: number }> = [
  { keywords: ["ultra", "0.6", "0,6", "0.5", "0,5", "0.6x", "0,6x", "0.5x", "0,5x"], score: 260 },
  { keywords: ["wide-angle", "wideangle", "wide"], score: 200 },
  { keywords: ["macro", "depth", "mono", "tele", "portrait"], score: 180 },
  { keywords: ["front", "self", "selbst"], score: 200 },
  { keywords: ["camera 3", "back 3"], score: 220 },
  { keywords: ["camera 4", "back 4"], score: 220 },
  { keywords: ["camera 2", "back 2"], score: 320 },
];

const BASE_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, min: 15 },
};


const useBarcodeScanner = ({ onDetected, enabled = true }: UseBarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);

  // Separate useEffect fÃ¼r Kamera-Enumeration (nur einmal beim Mount)
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => {
        const cameras = devices.filter((d) => d.kind === "videoinput");
        setAvailableCameras(cameras);
        // Wenn nur eine Kamera, automatisch auswählen
        if (cameras.length === 1) {
          setSelectedCameraId(cameras[0].deviceId);
        }
        // Wenn gespeicherte Auswahl vorhanden, wiederherstellen
        else {
          const stored = localStorage.getItem(PREFERRED_DEVICE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed.deviceId && cameras.some(c => c.deviceId === parsed.deviceId)) {
                setSelectedCameraId(parsed.deviceId);
              }
            } catch {}
          }
        }
        console.log("[Scanner] available cameras:", cameras.map((d) => ({ label: d.label, id: d.deviceId })));
      })
      .catch((err) => {
        console.warn("[Scanner] enumerateDevices failed:", err);
      });
  }, []); // Nur einmal beim Mount ausfÃ¼hren

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stream: MediaStream | null = null;
    let detector: BarcodeDetector | null = null;
    let fallbackReader: any = null;
    let rafId = 0;
    let cancelled = false;

    const stopScanLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const stopFallbackLoop = () => {
      if (fallbackReader && typeof fallbackReader.reset === "function") {
        try {
          fallbackReader.reset();
        } catch (err) {
          console.warn("[Scanner] fallback reset error", err);
        }
      }
      fallbackReader = null;
    };

    const stopStream = () => {
      stopScanLoop();
      stopFallbackLoop();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const ensureVideoAttributes = () => {
      if (!videoRef.current) {
        return;
      }
      videoRef.current.muted = true;
      (videoRef.current as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
    };

    const applyInitialConstraints = async (track: MediaStreamTrack) => {
      try {
        await track.applyConstraints({
          ...BASE_CONSTRAINTS,
          aspectRatio: { ideal: 16 / 9 },
        });
      } catch (err) {
        console.warn("[Scanner] Failed to apply preferred constraints, falling back.", err);
        try {
          await track.applyConstraints({
            width: { ideal: 1280, min: 960 },
            height: { ideal: 720, min: 540 },
            frameRate: { ideal: 24, min: 12 },
            aspectRatio: { ideal: 16 / 9 },
          });
        } catch (fallbackErr) {
          console.warn("[Scanner] Failed to apply fallback constraints.", fallbackErr);
        }
      }
    };

    const logCameraScore = (
      context: string,
      label: string | undefined,
      score: number,
      extra?: Record<string, unknown>,
    ) => {
      // Debug-Logging deaktiviert
      return;
    };

    const rememberPreferredDevice = (track: MediaStreamTrack, score: number) => {
      const deviceId = track.getSettings?.().deviceId;
      if (!deviceId) {
        return;
      }
      try {
        const payload: StoredCameraPreference = {
          deviceId,
          version: PREFERRED_DEVICE_VERSION,
          score,
          updatedAt: Date.now(),
        };
        localStorage.setItem(PREFERRED_DEVICE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn("[Scanner] Unable to store preferred device:", err);
      }
    };

    const getStreamForDevice = async (deviceId?: string) => {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, ...BASE_CONSTRAINTS }
          : { facingMode: { exact: "environment" }, ...BASE_CONSTRAINTS },
        audio: false,
      };
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (!deviceId) {
          throw err;
        }
        throw err;
      }
    };

    const getDefaultStream = async () => {
      try {
        return await getStreamForDevice();
      } catch (err) {
        console.warn("[Scanner] Exact environment camera failed, trying ideal.", err);
        try {
          const streamFallback = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, ...BASE_CONSTRAINTS },
            audio: false,
          });
          return streamFallback;
        } catch (fallbackErr) {
          console.warn("[Scanner] Ideal environment camera failed, using generic video.", fallbackErr);
          return navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
    };

    const scoreLabelOnly = (labelRaw: string | undefined) => {
      if (!labelRaw) {
        return 0;
      }

      const label = labelRaw.toLowerCase();
      let score = 0;

      for (const rule of CAMERA_SCORE_LABEL_BONUS) {
        if (rule.keywords.some((keyword) => label.includes(keyword))) {
          score += rule.score;
        }
      }

      for (const rule of CAMERA_SCORE_LABEL_PENALTY) {
        if (rule.keywords.some((keyword) => label.includes(keyword))) {
          score -= rule.score;
        }
      }

      return score;
    };

    const scoreTrack = (track: MediaStreamTrack): number => {
      if (!track) {
        return -Infinity;
      }

      const label = (track.label || "").toLowerCase();
      const settings = track.getSettings?.() || {};
      const capabilities = track.getCapabilities?.() || {};

      let score = 0;

      for (const rule of CAMERA_SCORE_LABEL_BONUS) {
        if (rule.keywords.some((keyword) => label.includes(keyword))) {
          score += rule.score;
        }
      }

      for (const rule of CAMERA_SCORE_LABEL_PENALTY) {
        if (rule.keywords.some((keyword) => label.includes(keyword))) {
          score -= rule.score;
        }
      }

      const width = (settings.width as number) ?? (capabilities as any).width?.max ?? 0;
      const height = (settings.height as number) ?? (capabilities as any).height?.max ?? 0;
      score += width / 5 + height / 5;

      const zoomMax = (capabilities as any).zoom?.max;
      if (typeof zoomMax === "number") {
        score += Math.min(zoomMax, 5) * 80;
        if (zoomMax <= 1.5) {
          score -= 240;
        }
      }

      return score;
    };

    const evaluateStream = (candidateStream: MediaStream) => {
      const track = candidateStream.getVideoTracks()[0];
      if (!track) {
        return { score: -Infinity, track: undefined, deviceId: undefined as string | undefined };
      }
      const score = scoreTrack(track);
      const deviceId = track.getSettings?.().deviceId;
      logCameraScore("evaluate", track.label, score, { deviceId });
      return { score, track, deviceId };
    };

    const readStoredPreference = (): StoredCameraPreference | null => {
      try {
        const raw = localStorage.getItem(PREFERRED_DEVICE_KEY);
        if (!raw) {
          return null;
        }

        const trimmed = raw.trim();
        if (trimmed.startsWith("{")) {
          const parsed = JSON.parse(trimmed) as Partial<StoredCameraPreference>;
          if (!parsed || typeof parsed.deviceId !== "string") {
            return null;
          }
          return {
            deviceId: parsed.deviceId,
            version: typeof parsed.version === "number" ? parsed.version : 1,
            score: typeof parsed.score === "number" ? parsed.score : undefined,
            updatedAt:
              typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
          };
        }

        return { deviceId: raw, version: 0 };
      } catch (err) {
        console.warn("[Scanner] Unable to load preferred device:", err);
        return null;
      }
    };

    const safelyStopStream = (stream: MediaStream | null | undefined) => {
      if (!stream) {
        return;
      }
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
    };

    const ensureBestStream = async (initialStream: MediaStream): Promise<MediaStream> => {
      const initialEval = evaluateStream(initialStream);
      let bestScore = initialEval.score;
      let bestStream: MediaStream | null = initialStream;
      let bestTrack = initialEval.track;
      let bestDeviceId = initialEval.deviceId;

      if (!navigator.mediaDevices.enumerateDevices) {
        return initialStream;
      }

      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (err) {
        console.warn("[Scanner] enumerateDevices failed:", err);
        return initialStream;
      }

      const visited = new Set<string>();
      if (initialEval.deviceId) {
        visited.add(initialEval.deviceId);
      }


      // Filtere alle Back-Kameras (facing back/environment)
      const backCameras = devices.filter(
        (device) => device.kind === "videoinput" && device.label.toLowerCase().includes("back")
      );
      let deviceCandidates: MediaDeviceInfo[];
      if (backCameras.length > 1) {
        // Sortiere Back-Kameras nach deviceId (meist ist die erste die Hauptkamera)
        deviceCandidates = backCameras.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
      } else {
        // Fallback: wie bisher, nach Score
        deviceCandidates = devices
          .filter((device) => device.kind === "videoinput")
          .sort((a, b) => scoreLabelOnly(b.label) - scoreLabelOnly(a.label));
      }

      for (const device of deviceCandidates) {
        if (device.kind !== "videoinput") {
          continue;
        }
        if (visited.has(device.deviceId)) {
          continue;
        }
        visited.add(device.deviceId);

        const fallbackDeviceId = bestDeviceId;
        const fallbackScore = bestScore;

        // release current stream to free hardware for the next test
        safelyStopStream(bestStream);

        try {
          const candidateStream = await getStreamForDevice(device.deviceId);
          const candidateEval = evaluateStream(candidateStream);

          if (candidateEval.track) {
            try {
              await applyInitialConstraints(candidateEval.track);
            } catch {
              /* ignore */
            }
          }

          if (candidateEval.score > bestScore || !bestStream) {
            bestScore = candidateEval.score;
            bestStream = candidateStream;
            bestTrack = candidateEval.track;
            bestDeviceId = candidateEval.deviceId;
            logCameraScore("promoted", bestTrack?.label, bestScore, {
              deviceId: bestTrack?.getSettings?.().deviceId,
            });
          } else {
            safelyStopStream(candidateStream);
            if (fallbackDeviceId) {
              try {
                const fallbackStream = await getStreamForDevice(fallbackDeviceId);
                const fallbackEval = evaluateStream(fallbackStream);
                if (fallbackEval.track) {
                  try {
                    await applyInitialConstraints(fallbackEval.track);
                  } catch {
                    /* ignore */
                  }
                }
                bestStream = fallbackStream;
                bestTrack = fallbackEval.track;
                bestScore = fallbackEval.score;
                bestDeviceId = fallbackEval.deviceId;
                logCameraScore("restore", bestTrack?.label, bestScore, {
                  deviceId: bestDeviceId,
                  previousCandidate: device.label,
                });
              } catch (fallbackErr) {
                console.warn("[Scanner] Unable to restore previous camera:", fallbackErr);
                try {
                  const fallbackStream = await getDefaultStream();
                  const fallbackEval = evaluateStream(fallbackStream);
                  if (fallbackEval.track) {
                    try {
                      await applyInitialConstraints(fallbackEval.track);
                    } catch {
                      /* ignore */
                    }
                  }
                  bestStream = fallbackStream;
                  bestTrack = fallbackEval.track;
                  bestScore = fallbackEval.score;
                  bestDeviceId = fallbackEval.deviceId;
                } catch (finalErr) {
                  console.error("[Scanner] Unable to restore any camera stream:", finalErr);
                  bestStream = null;
                  bestTrack = undefined;
                  bestScore = -Infinity;
                  bestDeviceId = undefined;
                }
              }
            } else {
              try {
                const fallbackStream = await getDefaultStream();
                const fallbackEval = evaluateStream(fallbackStream);
                if (fallbackEval.track) {
                  try {
                    await applyInitialConstraints(fallbackEval.track);
                  } catch {
                    /* ignore */
                  }
                }
                bestStream = fallbackStream;
                bestTrack = fallbackEval.track;
                bestScore = fallbackEval.score;
                bestDeviceId = fallbackEval.deviceId;
              } catch (finalErr) {
                console.error("[Scanner] Unable to restore any camera stream:", finalErr);
                bestStream = null;
                bestTrack = undefined;
                bestScore = -Infinity;
                bestDeviceId = undefined;
              }
            }
          }
        } catch (err) {
          console.warn("[Scanner] Candidate camera failed:", device.label || device.deviceId, err);
          if (fallbackDeviceId) {
            try {
              const fallbackStream = await getStreamForDevice(fallbackDeviceId);
              const fallbackEval = evaluateStream(fallbackStream);
              if (fallbackEval.track) {
                try {
                  await applyInitialConstraints(fallbackEval.track);
                } catch {
                  /* ignore */
                }
              }
              bestStream = fallbackStream;
              bestTrack = fallbackEval.track;
              bestScore = fallbackEval.score;
              bestDeviceId = fallbackEval.deviceId;
              logCameraScore("recover", bestTrack?.label, bestScore, {
                deviceId: bestDeviceId,
                failedCandidate: device.label,
              });
            } catch (recoverErr) {
              console.warn("[Scanner] Unable to recover fallback camera:", recoverErr);
              try {
                const fallbackStream = await getDefaultStream();
                const fallbackEval = evaluateStream(fallbackStream);
                if (fallbackEval.track) {
                  try {
                    await applyInitialConstraints(fallbackEval.track);
                  } catch {
                    /* ignore */
                  }
                }
                bestStream = fallbackStream;
                bestTrack = fallbackEval.track;
                bestScore = fallbackEval.score;
                bestDeviceId = fallbackEval.deviceId;
              } catch (finalErr) {
                console.error("[Scanner] Unable to restore any camera stream:", finalErr);
                bestStream = null;
                bestTrack = undefined;
                bestScore = -Infinity;
                bestDeviceId = undefined;
              }
            }
          } else {
            try {
              const fallbackStream = await getDefaultStream();
              const fallbackEval = evaluateStream(fallbackStream);
              if (fallbackEval.track) {
                try {
                  await applyInitialConstraints(fallbackEval.track);
                } catch {
                  /* ignore */
                }
              }
              bestStream = fallbackStream;
              bestTrack = fallbackEval.track;
              bestScore = fallbackEval.score;
              bestDeviceId = fallbackEval.deviceId;
            } catch (finalErr) {
              console.error("[Scanner] Unable to restore any camera stream:", finalErr);
              bestStream = null;
              bestTrack = undefined;
              bestScore = -Infinity;
              bestDeviceId = undefined;
            }
          }
        }
      }

      if (bestStream && bestStream !== initialStream) {
        safelyStopStream(initialStream);
      }

      if (bestTrack && bestStream) {
        rememberPreferredDevice(bestTrack, bestScore);
        logCameraScore("selected", bestTrack.label, bestScore, {
          deviceId: bestTrack.getSettings?.().deviceId,
        });
      }

      return bestStream || initialStream;
    };

    const getStream = async () => {
      // Wenn explizit eine Kamera gewaehlt wurde, nutze diese
      if (selectedCameraId) {
        return await getStreamForDevice(selectedCameraId);
      }
      // Sonst wie bisher
      const storedPref = readStoredPreference();
      if (storedPref) {
        let storedStream: MediaStream | null = null;
        let releaseStoredStream = true;
        try {
          storedStream = await getStreamForDevice(storedPref.deviceId);
          const storedEval = evaluateStream(storedStream);
          const recordedScore =
            typeof storedPref.score === "number" ? storedPref.score : -Infinity;
          const needsUpgrade =
            storedPref.version !== PREFERRED_DEVICE_VERSION ||
            storedEval.score < MIN_ACCEPTABLE_CAMERA_SCORE ||
            recordedScore < MIN_ACCEPTABLE_CAMERA_SCORE;
          if (!needsUpgrade) {
            releaseStoredStream = false;
            return storedStream;
          }
          const upgradedStream = await ensureBestStream(storedStream);
          releaseStoredStream = upgradedStream !== storedStream;
          return upgradedStream;
        } catch (err) {
          console.warn("[Scanner] Stored camera unusable, removing preference.", err);
          try {
            localStorage.removeItem(PREFERRED_DEVICE_KEY);
          } catch {
            /* ignore */
          }
        } finally {
          if (releaseStoredStream && storedStream) {
            storedStream.getTracks().forEach((t) => t.stop());
          }
        }
      }
      const defaultStream = await getDefaultStream();
      try {
        return await ensureBestStream(defaultStream);
      } catch (err) {
        console.warn("[Scanner] ensureBestStream failed, using default stream.", err);
        return defaultStream;
      }
    };

    const startScanLoop = (video: HTMLVideoElement, barcodeDetector: BarcodeDetector) => {
      let lastScanTs = 0;

      const loop = async (timestamp: number) => {
        if (cancelled) {
          return;
        }

        if (document.visibilityState !== "visible") {
          rafId = requestAnimationFrame(loop);
          return;
        }

        if (timestamp - lastScanTs < SCAN_INTERVAL_MS) {
          rafId = requestAnimationFrame(loop);
          return;
        }
        lastScanTs = timestamp;

        if (video.readyState === 4) {
          try {
            const results = await barcodeDetector.detect(video);
            if (results.length > 0) {
              onDetected(results[0].rawValue);
              return;
            }
          } catch (err) {
            console.warn("[Scanner] detect error:", err);
          }
        }

        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);
    };

    const setup = async () => {
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera-Zugriff nicht vorhanden.");
        return;
      }

      try {
        stream = await getStream();
        if (cancelled || !stream) {
          stopStream();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stopStream();
          return;
        }

        ensureVideoAttributes();
        video.srcObject = stream;

        try {
          await video.play();
        } catch (playErr) {
          console.error("[Scanner] Video play error:", playErr);
          setError("Video konnte nicht gestartet werden.");
          stopStream();
          return;
        }

        const [track] = stream.getVideoTracks();
        if (track) {
          await applyInitialConstraints(track);
          rememberPreferredDevice(track, scoreTrack(track));
          console.log("[Scanner] active camera:", track.label, track.getSettings?.());
        }

        if (!("BarcodeDetector" in window)) {
          console.warn('[Scanner] BarcodeDetector not supported, using ZXing fallback');
          try {
            fallbackReader = new BrowserMultiFormatReader();
            setIsSupported(true);
            setError(null);
            fallbackReader.decodeFromVideoElementContinuously(video, (result: any, err: any) => {
              if (cancelled || !fallbackReader) {
                return;
              }
              if (result) {
                onDetected(result.getText());
                stopFallbackLoop();
                return;
              }
              if (err && err.name && err.name != 'NotFoundException') {
                console.warn('[Scanner] ZXing error:', err);
              }
            });
          } catch (fallbackError) {
            console.error('[Scanner] ZXing fallback setup failed:', fallbackError);
            setIsSupported(false);
            setError('BarcodeDetector wird nicht unterstützt. Bitte aktuellen Browser oder manuelle Eingabe verwenden.');
            stopStream();
          }
          return;
        }

        detector = new BarcodeDetector({
          formats: ["qr_code", "ean_13", "code_128"],
        });
        setIsSupported(true);
        setError(null);
        startScanLoop(video, detector);
      } catch (err: any) {
        console.error("[Scanner] Setup error:", err);
        stopStream();

        if (err?.name === "NotAllowedError") {
          setError("Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
        } else if (err?.name === "NotFoundError") {
          setError("Keine Kamera gefunden. Bitte Hardware prüfen.");
        } else {
          setError("Scanner-Fehler: " + (err?.message || "Unbekannter Fehler"));
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      stopStream();
      detector = null;
    };
  }, [enabled, onDetected, selectedCameraId]);

  // Callback für UI, um Kamera zu wechseln
  const selectCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
    localStorage.setItem(PREFERRED_DEVICE_KEY, JSON.stringify({ deviceId, version: PREFERRED_DEVICE_VERSION }));
  }, []);

  return {
    videoRef,
    isSupported,
    error,
    availableCameras,
    selectedCameraId,
    setSelectedCameraId: selectCamera,
  };
};

export default useBarcodeScanner;






