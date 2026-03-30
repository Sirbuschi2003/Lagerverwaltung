import React, { useEffect, useRef, useState } from "react";
import { 
  Alert, 
  Box, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Typography,
  Paper,
  Divider,
  Chip,
  Stack,
  LinearProgress,
  CircularProgress
} from "@mui/material";
import { CloudDownload, Wifi, WifiOff, CheckCircle, Error } from "@mui/icons-material";
import useOfflineQueue from "../store/useOfflineQueue";
import useItemsStore from "../store/useItemsStore";
import useAuthStore from "../store/useAuthStore";
import { useOfflineStorage } from "../hooks/useOfflineStorage";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { fetchVehicleStock, createItem, updateItem, deleteItem } from "../utils/api";

const SyncPage = () => {
  const { movements, isSyncing, loadFromStorage, syncNow, requiresReauth, lastError } = useOfflineQueue();
  const forceLoadItems = useItemsStore((state: any) => state.forceLoadItems);
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);
  const offlineStorage = useOfflineStorage();
  const { isOnline, lastCheck, checkNetwork } = useNetworkStatus();

  
  // Sync-Status States
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const wasOnlineRef = useRef<boolean>(isOnline);

  // Vollständige Synchronisation: Daten laden + Bewegungen übertragen
  const performFullSync = async () => {
    console.log('[SyncPage] performFullSync aufgerufen, isOnline:', isOnline, 'movements:', movements.length);
    
    if (!isOnline) {
      setSyncStatus('error');
      setSyncMessage('Keine Internetverbindung verfügbar');
      console.log('[SyncPage] Abbruch: Offline');
      return;
    }

    setSyncStatus('syncing');
    setSyncProgress(0);
    setSyncMessage('Synchronisation gestartet...');

    try {
      // 1. Ausstehende Bewegungen übertragen (wichtigste Aufgabe!)
      if (movements.length > 0) {
        console.log("[SyncPage] Übertrage", movements.length, "Bewegungen...");
        setSyncMessage(`Übertrage ${movements.length} ausstehende Bewegungen...`);
        setSyncProgress(10);
        await syncNow();
        console.log('[SyncPage] Bewegungen erfolgreich übertragen');
      } else {
        console.log('[SyncPage] Keine Bewegungen zu übertragen');
      }

      // 2. Artikel-Queue (Offline-Operationen) synchronisieren
      const itemQueue = await offlineStorage.getItemQueue();
      if (itemQueue.length > 0) {
        console.log(`[SyncPage] Übertrage ${itemQueue.length} Artikel-Änderungen...`);
        setSyncMessage(`Übertrage ${itemQueue.length} Artikel-Änderung${itemQueue.length === 1 ? '' : 'en'}...`);
        setSyncProgress(30);

        let itemErrors = 0;

        for (const entry of itemQueue) {
          try {
            if (entry.operation === "CREATE") {
              await createItem(entry.itemData);
            } else if (entry.operation === "UPDATE") {
              const { id, ...data } = entry.itemData || {};
              await updateItem(id, data);
            } else if (entry.operation === "DELETE") {
              await deleteItem(entry.itemData.id);
            }
            await offlineStorage.removeItemFromQueue(entry.id);
          } catch (err) {
            itemErrors += 1;
            console.error('[SyncPage] Fehler beim Übertragen einer Artikel-Änderung:', entry, err);
          }
        }

        if (itemErrors > 0) {
          setSyncStatus('error');
          setSyncMessage(`${itemErrors} Artikel-Änderungen konnten nicht übertragen werden. Bitte erneut synchronisieren.`);
          return;
        }
      }

      // 3. Artikelstammdaten synchronisieren
      console.log('[SyncPage] Lade Artikelstammdaten...');
      setSyncMessage('Lade Artikelstammdaten...');
      setSyncProgress(50);
      // WICHTIG: alle Artikel für Offline-Buchungen vorhalten -> großes Limit
      await forceLoadItems({ page: 1, limit: 200000 });
      const refreshedItems = useItemsStore.getState().items;
      console.log(`[SyncPage] Neu geladene Artikel: ${refreshedItems.length}`);
      await offlineStorage.setItems(refreshedItems);
      console.log('[SyncPage] Artikelstammdaten geladen und gecacht');

      // 4. Offline-Sollwerte synchronisieren (falls vorhanden)
      if (user?.vehicleId) {
        const offlineTargets = await offlineStorage.getOfflineTargets(user.vehicleId);
        if (Object.keys(offlineTargets).length > 0) {
          console.log("[SyncPage] Übertrage", Object.keys(offlineTargets).length, "Offline-Sollwerte...");
          setSyncMessage(`Übertrage ${Object.keys(offlineTargets).length} Sollwerte...`);
          setSyncProgress(70);
          
          // Übertrage jeden Sollwert einzeln an die API
          const { updateVehicleTarget } = await import('../utils/api');
          for (const [itemId, targetQuantity] of Object.entries(offlineTargets)) {
            try {
              await updateVehicleTarget(user.vehicleId, { itemId, targetQuantity });
              console.log('[SyncPage] Sollwert übertragen:', itemId, targetQuantity);
            } catch (err) {
              console.error("[SyncPage] Fehler beim Übertragen von Sollwert", itemId, err);
            }
          }
          
          // Lösche Offline-Sollwerte nach erfolgreicher Übertragung
          await offlineStorage.clearOfflineTargets(user.vehicleId);
          console.log('[SyncPage] Offline-Sollwerte erfolgreich synchronisiert und gelöscht');
        }
      }

      // 5. Fahrzeugbestand synchronisieren (falls Fahrzeug zugeordnet)
      if (user?.vehicleId) {
        console.log('[SyncPage] Lade Fahrzeugbestand für', user.vehicleId);
        setSyncMessage('Lade Fahrzeugbestand...');
        setSyncProgress(90);
        const vehicleStock = await fetchVehicleStock(user.vehicleId);
        await offlineStorage.setVehicleStock(user.vehicleId, vehicleStock);
        console.log('[SyncPage] Fahrzeugbestand geladen und gecacht:', vehicleStock.length, 'Artikel');
      } else {
        console.log('[SyncPage] Kein Fahrzeug zugeordnet, Bestand-Sync übersprungen');
      }

      // 6. Erfolgreich abgeschlossen
      setSyncProgress(100);
      setSyncStatus('success');
      setSyncMessage('Synchronisation erfolgreich abgeschlossen');
      setLastSyncTime(new Date());
      console.log('[SyncPage] Synchronisation erfolgreich abgeschlossen');

    } catch (error: any) {
      console.error('[SyncPage] Sync-Fehler:', error);
      setSyncStatus('error');
      setSyncMessage(`Synchronisation fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`);
    }
  };

  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  // Auto-Sync sobald Verbindung wieder online ist
  useEffect(() => {
    if (!wasOnlineRef.current && isOnline && syncStatus !== 'syncing') {
      void performFullSync();
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, syncStatus]);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Synchronisation & Offline-Modus
      </Typography>

      {requiresReauth && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Anmeldung abgelaufen (401). Bitte kurz neu einloggen, die Offline-Bewegungen bleiben gespeichert.{" "}
          <Button size="small" onClick={logout} sx={{ ml: 1 }}>
            Neu anmelden
          </Button>
        </Alert>
      )}

      {!requiresReauth && lastError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {lastError}
        </Alert>
      )}

      {/* Online-Status & Vollständige Synchronisation */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          {isOnline ? <Wifi color="success" /> : <WifiOff color="error" />}
          <Typography variant="h6">
            Verbindungsstatus
          </Typography>
          <Chip
            label={isOnline ? "Online" : "Offline"}
            color={isOnline ? "success" : "error"}
            size="small"
          />
          <Button 
            size="small" 
            onClick={checkNetwork}
            disabled={syncStatus === 'syncing'}
          >
            Prüfen
          </Button>
        </Stack>
        
        {lastCheck && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Letzte Netzwerk-Prüfung: {lastCheck.toLocaleString('de-DE')}
          </Typography>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        {/* Synchronisation */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Synchronisation
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Überträgt ausstehende Bewegungen und lädt aktuelle Daten (Artikel, Bestand) für die Offline-Nutzung herunter.
          Die App synchronisiert automatisch, sobald Sie wieder online sind.
        </Typography>

        {lastSyncTime && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Letzte Synchronisation: {lastSyncTime.toLocaleString('de-DE')}
          </Typography>
        )}

        {movements.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Achtung: {movements.length} Bewegungen warten auf Übertragung
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={performFullSync}
          disabled={!isOnline || syncStatus === 'syncing'}
          startIcon={syncStatus === 'syncing' ? <CircularProgress size={20} /> : <CloudDownload />}
          sx={{ mb: 2 }}
          size="large"
        >
          {syncStatus === 'syncing' ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
        </Button>

        {/* Sync-Progress */}
        {syncStatus === 'syncing' && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={syncProgress} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {syncMessage}
            </Typography>
          </Box>
        )}

        {/* Sync-Ergebnis */}
        {syncStatus === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircle />
              <span>{syncMessage}</span>
            </Stack>
          </Alert>
        )}

        {syncStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Error />
              <span>{syncMessage}</span>
            </Stack>
          </Alert>
        )}
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Bewegungen-Warteschlange (nur Info-Anzeige) */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Ausstehende Bewegungen
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          Die App speichert alle Bewegungen lokal und synchronisiert automatisch, sobald Sie wieder online sind. 
          {movements.length > 0 && ` Aktuell ${movements.length} Bewegungen in der Warteschlange.`}
        </Alert>
        
        <Chip
          label={movements.length > 0 ? `${movements.length} ausstehend` : "Alle synchronisiert"}
          color={movements.length > 0 ? "warning" : "success"}
          size="medium"
          sx={{ mb: 2, fontSize: '1rem', px: 1, py: 2 }}
        />

        {movements.length > 0 && (
          <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.default', borderRadius: 1 }}>
            {movements.map((movement: any) => (
              <ListItem key={movement.timestamp}>
                <ListItemText
                  primary={`${movement.type} - ${movement.code}`}
                  secondary={new Date(movement.timestamp).toLocaleString('de-DE')}
                />
              </ListItem>
            ))}
          </List>
        )}

        {movements.length === 0 && (
          <Alert severity="success">
            Alle Bewegungen sind synchronisiert!
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default SyncPage;






