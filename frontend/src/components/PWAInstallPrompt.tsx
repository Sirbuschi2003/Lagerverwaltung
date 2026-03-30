import React, { useState, useEffect } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import { Download, Phone } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      console.log('PWA ist installierbar!');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Prüfe ob bereits installiert
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA bereits als App installiert');
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA Installation akzeptiert');
      } else {
        console.log('PWA Installation abgelehnt');
      }
    } catch (error) {
      console.error('Fehler bei PWA Installation:', error);
    } finally {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
  };

  if (!isInstallable || !showInstallPrompt) {
    return null;
  }

  return (
    <Snackbar
      open={showInstallPrompt}
      autoHideDuration={10000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              startIcon={<Phone />}
              onClick={handleInstall}
              sx={{ mr: 1 }}
            >
              Als App installieren
            </Button>
            <Button color="inherit" size="small" onClick={handleClose}>
              Später
            </Button>
          </>
        }
        sx={{ width: '100%', maxWidth: 400 }}
      >
        Lagerverwaltung als App installieren für Offline-Nutzung!
      </Alert>
    </Snackbar>
  );
}