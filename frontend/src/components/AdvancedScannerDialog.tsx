import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
} from '@mui/material';
import useBarcodeScanner from '../hooks/useBarcodeScanner';

interface AdvancedScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}

const AdvancedScannerDialog: React.FC<AdvancedScannerDialogProps> = ({
  open,
  onClose,
  onDetected,
  title = 'Code scannen'
}) => {
  const [manualInput, setManualInput] = useState('');
  
  const { videoRef, isSupported, error } = useBarcodeScanner({ 
    onDetected: (code) => {
      onDetected(code);
      onClose();
    }, 
    enabled: open 
  });

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onDetected(manualInput.trim());
      onClose();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleManualSubmit();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          
          {!error && (
            <Box
              sx={{
                display: 'block',
                borderRadius: 2,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                minHeight: 200,
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </Box>
          )}

          {!isSupported && (
            <Alert severity="info">
              BarcodeDetector wird nicht unterstützt. Verwenden Sie die manuelle Eingabe.
            </Alert>
          )}

          <TextField
            fullWidth
            label="Code manuell eingeben"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Geben Sie den Code ein"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button 
          variant="contained" 
          onClick={handleManualSubmit}
          disabled={!manualInput.trim()}
        >
          Code übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedScannerDialog;
