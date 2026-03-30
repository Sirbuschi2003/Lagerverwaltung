import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Box
} from '@mui/material';
import { 
  CloudDownload, 
  CheckCircle, 
  Error as ErrorIcon,
  Wifi,
  WifiOff
} from '@mui/icons-material';
import { fetchItems, fetchVehicleStock, fetchAuthProfile } from '../utils/api';
import useAuthStore from '../store/useAuthStore';
import useItemsStore from '../store/useItemsStore';

interface OfflineSyncDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SyncItem {
  id: string;
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

export function OfflineSyncDialog({ open, onClose }: OfflineSyncDialogProps) {
  const [syncItems, setSyncItems] = useState<SyncItem[]>([
    { id: 'profile', name: 'Benutzerprofil', status: 'pending' },
    { id: 'items', name: 'Artikeldaten', status: 'pending' },
    { id: 'vehicle', name: 'Fahrzeugdaten', status: 'pending' },
  ]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const user = useAuthStore((state: any) => state.user);
  const loadItems = useItemsStore((state: any) => state.loadItems);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateSyncItem = (id: string, updates: Partial<SyncItem>) => {
    setSyncItems((prev: any) => prev.map((item: any) => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const syncOfflineData = async () => {
    if (!isOnline) {
      return;
    }

    setIsSyncing(true);

    try {
      // 1. Benutzerprofil
      updateSyncItem('profile', { status: 'loading' });
      try {
        await fetchAuthProfile();
        updateSyncItem('profile', { status: 'success' });
      } catch (error) {
        updateSyncItem('profile', { 
          status: 'error', 
          error: 'Profil konnte nicht geladen werden' 
        });
      }

      // 2. Artikeldaten
      updateSyncItem('items', { status: 'loading' });
      try {
        await loadItems();
        updateSyncItem('items', { status: 'success' });
      } catch (error) {
        updateSyncItem('items', { 
          status: 'error', 
          error: 'Artikeldaten konnten nicht geladen werden' 
        });
      }

      // 3. Fahrzeugdaten (falls verfügbar)
      if (user?.vehicleId) {
        updateSyncItem('vehicle', { status: 'loading' });
        try {
          await fetchVehicleStock(user.vehicleId);
          updateSyncItem('vehicle', { status: 'success' });
        } catch (error) {
          updateSyncItem('vehicle', { 
            status: 'error', 
            error: 'Fahrzeugdaten konnten nicht geladen werden' 
          });
        }
      } else {
        updateSyncItem('vehicle', { status: 'success' });
      }

    } finally {
      setIsSyncing(false);
    }
  };

  const allSuccess = syncItems.every((item: any) => item.status === 'success');
  const hasErrors = syncItems.some((item: any) => item.status === 'error');

  const getIcon = (status: SyncItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'loading':
        return <CloudDownload color="primary" />;
      default:
        return <CloudDownload color="disabled" />;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {isOnline ? <Wifi color="success" /> : <WifiOff color="error" />}
          Offline-Synchronisation
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!isOnline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Keine Internetverbindung. Bitte verbinde dich mit dem Internet für die Synchronisation.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Lade wichtige Daten für die Offline-Nutzung herunter. Dies stellt sicher, 
          dass die App auch ohne Internet funktioniert.
        </Typography>

        {isSyncing && <LinearProgress sx={{ mb: 2 }} />}

        <List>
          {syncItems.map((item: any) => (
            <ListItem key={item.id}>
              <ListItemIcon>
                {getIcon(item.status)}
              </ListItemIcon>
              <ListItemText 
                primary={item.name}
                secondary={item.error}
                secondaryTypographyProps={{
                  color: item.status === 'error' ? 'error' : 'text.secondary'
                }}
              />
            </ListItem>
          ))}
        </List>

        {allSuccess && !isSyncing && (
          <Alert severity="success" sx={{ mt: 2 }}>
            ✅ Alle Daten erfolgreich synchronisiert! Die App funktioniert jetzt offline.
          </Alert>
        )}

        {hasErrors && !isSyncing && (
          <Alert severity="error" sx={{ mt: 2 }}>
            ⚠️ Einige Daten konnten nicht synchronisiert werden. Versuche es später erneut.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {!allSuccess && (
          <Button 
            onClick={syncOfflineData}
            disabled={!isOnline || isSyncing}
            variant="contained"
            startIcon={<CloudDownload />}
          >
            {isSyncing ? 'Synchronisiert...' : 'Jetzt synchronisieren'}
          </Button>
        )}
        <Button onClick={onClose}>
          {allSuccess ? 'Fertig' : 'Abbrechen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}