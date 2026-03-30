import React, { useCallback, useEffect, useRef, useState } from "react";
import { Snackbar, Alert } from "@mui/material";
import { io, Socket } from "socket.io-client";
import useAuthStore from "../store/useAuthStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { fetchPushPublicKey, registerPushSubscription } from "../utils/api";

type RestockStatus = "PENDING" | "APPROVED" | "FULFILLED" | "CANCELLED";

interface RestockRequestEvent {
  id: string;
  status: RestockStatus;
  quantityNeeded: number;
  quantityProvided?: number;
  note?: string | null;
  vehicle: { id: string; licensePlate: string; description: string };
  item: { id: string; code: string; description: string; manufacturer: string; productGroup: string };
}

const RestockNotifier: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isOnline } = useNetworkStatus();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const lastStatuses = useRef<Record<string, RestockStatus>>({});
  const lastNotifiedAt = useRef<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const statusStorageKey = user?.id ? `restock-status-${user.id}` : null;

  // Lade bekannte Stati aus LocalStorage, damit nach Reconnect keine Duplikate gepusht werden
  useEffect(() => {
    if (!statusStorageKey) return;
    try {
      const raw = localStorage.getItem(statusStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          lastStatuses.current = parsed;
        }
      } else {
        lastStatuses.current = {};
      }
    } catch (e) {
      console.warn("[Push] Konnte gespeicherte Stati nicht laden:", e);
    }
  }, [statusStorageKey]);

  const ensurePushSubscription = useCallback(async () => {
    if (!token || !user?.vehicleId) return;
    if (typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let existing = await registration.pushManager.getSubscription();
      const publicKey = await fetchPushPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Falls Subscription mit anderem Key existiert, neu abonnieren
      const existingKey = applicationServerKeyToBase64Url(existing?.options.applicationServerKey ?? null);
      if (existing && existingKey && existingKey !== publicKey) {
        console.log("[Push] Subscription-Keys unterscheiden sich, deaktiviere alte und abonniere neu...");
        await existing.unsubscribe();
        existing = null;
      }

      const subscription = existing ?? (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      }));

      const json = subscription.toJSON();
      if (json?.endpoint && (json as any)?.keys) {
        await registerPushSubscription(json as any);
        console.log("[Push] Subscription aktualisiert");
      }
    } catch (error) {
      console.warn("[Push] Subscription fehlgeschlagen:", error);
    }
  }, [token, user?.vehicleId]);

  useEffect(() => {
    if (!token || !user?.vehicleId || !isOnline) {
      // Falls Benutzer abgemeldet oder offline ist, offene Verbindungen schließen
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    void ensurePushSubscription();
    // Schließe ggf. alte Verbindungen, bevor eine neue aufgebaut wird
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io("/stock", {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
    });
    socketRef.current = socket;

    const triggerNotification = async (message: string, tag?: string) => {
      if ("Notification" in window) {
        const ensurePermission = async () => {
          if (Notification.permission === "default") {
            return Notification.requestPermission();
          }
          return Notification.permission;
        };

        const perm = await ensurePermission();
        if (perm === "granted") {
          try {
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration?.showNotification) {
              await registration.showNotification("Artikel bereitgestellt", {
                body: message,
                icon: "/pwa-192x192.png",
                badge: "/pwa-192x192.png",
                data: { url: "/my-vehicle" },
                tag: tag || "restock-ready",
              });
            } else {
              new Notification("Artikel bereitgestellt", {
                body: message,
                icon: "/pwa-192x192.png",
              });
            }
          } catch (e) {
            console.warn("[Push] Notification konnte nicht angezeigt werden:", e);
          }
        }
      }
      setSnackbar({ open: true, message });
    };

    const handleRestockUpdate = async (requests: RestockRequestEvent[]) => {
      let changed = false;
      for (const req of requests) {
        const prev = lastStatuses.current[req.id];
        // Nur Benachrichtigungen für das eigene Fahrzeug und Statuswechsel auf APPROVED
        if (req.vehicle?.id === user.vehicleId && req.status === "APPROVED" && prev !== "APPROVED") {
          // Doppel-Guard: falls Backend in kurzer Folge zwei Events schickt
          const now = Date.now();
          const last = lastNotifiedAt.current[req.id] || 0;
          if (now - last < 10_000) {
            lastStatuses.current[req.id] = req.status;
            return;
          }

          const qty = typeof req.quantityProvided === "number" ? req.quantityProvided : req.quantityNeeded;
          const msg = `${qty}x ${req.item.description} (${req.item.code}) bereitgestellt für ${req.vehicle.licensePlate}`;
          // Benachrichtigung immer über SW mit tag, damit zusammengefasst wird
          await triggerNotification(msg, req.status === "APPROVED" ? "restock-ready" : undefined);
          setSnackbar({ open: true, message: msg });
          lastNotifiedAt.current[req.id] = now;
        }
        lastStatuses.current[req.id] = req.status;
        changed = true;
      }

      // Persistiere Status nach Batch, um erneute Benachrichtigungen nach Reconnect zu vermeiden
      if (changed && statusStorageKey) {
        try {
          localStorage.setItem(statusStorageKey, JSON.stringify(lastStatuses.current));
        } catch (e) {
          console.warn("[Push] Konnte Stati nicht speichern:", e);
        }
      }
    };

    socket.on("connect", () => {
      socket.emit("subscribeRestock");
    });
    socket.on("restockUpdate", handleRestockUpdate);

    return () => {
      socket.off("restockUpdate", handleRestockUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.vehicleId, isOnline, ensurePushSubscription]);

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={4000}
      onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="info" onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
};

export default RestockNotifier;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function applicationServerKeyToBase64Url(key: ArrayBuffer | null): string | null {
  if (!key) return null;
  const bytes = new Uint8Array(key);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
