import React from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useGlobalRefreshSettings } from '../hooks/useGlobalRefreshSettings';

interface RefreshControlProps {
  onManualRefresh?: () => void;
  isLoading?: boolean;
  showToggle?: boolean;
  compact?: boolean;
}

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Deaktiviert' },
  { value: 5000, label: '5 Sekunden' },
  { value: 10000, label: '10 Sekunden' },
  { value: 15000, label: '15 Sekunden' },
  { value: 30000, label: '30 Sekunden' },
  { value: 60000, label: '1 Minute' },
  { value: 120000, label: '2 Minuten' },
  { value: 300000, label: '5 Minuten' },
];

export default function RefreshControl({ 
  onManualRefresh, 
  isLoading = false, 
  showToggle = true,
  compact = false 
}: RefreshControlProps) {
  const { settings, updateInterval, toggleEnabled, getIntervalLabel } = useGlobalRefreshSettings();

  const handleIntervalChange = async (event: any) => {
    const newInterval = Number(event.target.value);
    await updateInterval(newInterval);
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {onManualRefresh && (
          <Button
            variant="outlined"
            size="small"
            onClick={onManualRefresh}
            disabled={isLoading}
            startIcon={<RefreshIcon />}
          >
            Aktualisieren
          </Button>
        )}
        <TextField
          select
          size="small"
          value={settings.interval}
          onChange={handleIntervalChange}
          sx={{ minWidth: 120 }}
        >
          {INTERVAL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {showToggle && (
          <Switch
            checked={settings.enabled && settings.interval > 0}
            onChange={toggleEnabled}
            size="small"
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">Auto-Aktualisierung</Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {onManualRefresh && (
          <Button
            variant="contained"
            onClick={onManualRefresh}
            disabled={isLoading}
            startIcon={<RefreshIcon />}
          >
            Jetzt aktualisieren
          </Button>
        )}

        <TextField
          select
          label="Aktualisierungsintervall"
          value={settings.interval}
          onChange={handleIntervalChange}
          sx={{ minWidth: 200 }}
        >
          {INTERVAL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {showToggle && (
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled && settings.interval > 0}
                onChange={toggleEnabled}
              />
            }
            label="Aktiviert"
          />
        )}

        <Chip
          label={`Aktuell: ${getIntervalLabel(settings.interval)}`}
          color={settings.enabled && settings.interval > 0 ? 'success' : 'default'}
          variant="outlined"
        />
      </Box>

      {settings.enabled && settings.interval > 0 && (
        <Typography variant="body2" color="text.secondary">
          Seite wird automatisch alle {getIntervalLabel(settings.interval)} aktualisiert
        </Typography>
      )}
    </Box>
  );
}