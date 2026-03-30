import React from 'react';
import { Chip, Box } from '@mui/material';
import { WifiOff } from '@mui/icons-material';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineStatusIndicator() {
  // Nutze echten Backend-Check statt nur navigator.onLine
  const { isOnline } = useNetworkStatus();

  // Nur anzeigen wenn Backend nicht erreichbar
  if (isOnline) return null;

  return (
    <Box sx={{ 
      position: 'fixed', 
      top: { xs: 60, sm: 70 }, 
      right: 16, 
      zIndex: 1300 
    }}>
      <Chip
        icon={<WifiOff />}
        label="Offline"
        color="warning"
        size="small"
        sx={{ 
          backgroundColor: '#f57c00',
          color: 'white',
          '& .MuiChip-icon': {
            color: 'white'
          }
        }}
      />
    </Box>
  );
}