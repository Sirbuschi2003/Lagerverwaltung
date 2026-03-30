import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Alert,
} from '@mui/material';
import {
  CloudOff,
  CloudDone,
  Sync,
  CloudQueue,
  Delete,
  Refresh,
  SignalWifiOff,
  SignalWifi4Bar,
} from '@mui/icons-material';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

export const SyncStatusIndicator: React.FC = () => {
  const {
    queueStatus,
    isOnline,
    hasQueuedItems,
    processQueue,
    clearQueue,
    refreshQueueStatus,
  } = useBackgroundSync();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    refreshQueueStatus();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    await processQueue();
    setIsProcessing(false);
    handleClose();
  };

  const handleClearQueue = async () => {
    if (window.confirm('Alle ausstehenden Sync-Vorgänge löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      await clearQueue();
      handleClose();
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'error';
    if (hasQueuedItems) return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <SignalWifiOff />;
    if (hasQueuedItems) return <CloudQueue />;
    return <SignalWifi4Bar />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (hasQueuedItems) return `${queueStatus.count} ausstehend`;
    return 'Synchronisiert';
  };

  return (
    <>
      <Tooltip title={`Sync-Status: ${getStatusText()}`}>
        <IconButton onClick={handleClick} size="small">
          <Badge badgeContent={hasQueuedItems ? queueStatus.count : 0} color="error">
            <Chip
              icon={getStatusIcon()}
              label={isOnline ? 'Online' : 'Offline'}
              color={getStatusColor()}
              size="small"
              variant={isOnline ? 'filled' : 'outlined'}
            />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 300 }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6" gutterBottom>
            Synchronisations-Status
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {getStatusIcon()}
            <Typography>
              {isOnline ? 'Online' : 'Offline'} • {getStatusText()}
            </Typography>
          </Box>

          {!isOnline && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Sie sind offline. Änderungen werden automatisch synchronisiert, sobald die Verbindung wiederhergestellt ist.
            </Alert>
          )}

          {hasQueuedItems && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {queueStatus.count} Bewegungen warten auf Synchronisation.
            </Alert>
          )}
        </Box>

        <Divider />

        {hasQueuedItems && (
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ p: 1, pb: 0 }}>
              Ausstehende Synchronisationen:
            </Typography>
            {queueStatus.items.slice(0, 5).map((item, index) => (
              <MenuItem key={item.id} dense>
                <ListItemIcon>
                  <CloudQueue fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`${item.method} ${new URL(item.url).pathname}`}
                  secondary={`${new Date(item.timestamp).toLocaleTimeString()} (${item.retryCount} Versuche)`}
                />
              </MenuItem>
            ))}
            {queueStatus.items.length > 5 && (
              <Typography variant="caption" sx={{ p: 1, color: 'text.secondary' }}>
                ... und {queueStatus.items.length - 5} weitere
              </Typography>
            )}
          </Box>
        )}

        <Divider />

        <MenuItem onClick={refreshQueueStatus}>
          <ListItemIcon>
            <Refresh />
          </ListItemIcon>
          <ListItemText>Status aktualisieren</ListItemText>
        </MenuItem>

        {isOnline && hasQueuedItems && (
          <MenuItem onClick={handleProcessQueue} disabled={isProcessing}>
            <ListItemIcon>
              <Sync />
            </ListItemIcon>
            <ListItemText>
              {isProcessing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
            </ListItemText>
          </MenuItem>
        )}

        {hasQueuedItems && (
          <MenuItem onClick={handleClearQueue} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Warteschlange löschen</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};