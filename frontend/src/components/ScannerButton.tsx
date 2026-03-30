import React, { useState } from 'react';
import { Button, Fab } from '@mui/material';
import { QrCodeScanner, Camera, Edit } from '@mui/icons-material';
import AdvancedScannerDialog from './AdvancedScannerDialog';

interface ScannerButtonProps {
  onDetected: (code: string) => void;
  variant?: 'button' | 'fab';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  children?: React.ReactNode;
  title?: string;
}

export const ScannerButton: React.FC<ScannerButtonProps> = ({
  onDetected,
  variant = 'button',
  size = 'medium',
  disabled = false,
  children,
  title = 'Code scannen'
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleDetected = (code: string) => {
    onDetected(code);
    handleClose();
  };

  if (variant === 'fab') {
    return (
      <>
        <Fab
          color="primary"
          onClick={handleOpen}
          disabled={disabled}
          size={size}
        >
          <QrCodeScanner />
        </Fab>
        
        <AdvancedScannerDialog
          open={open}
          onClose={handleClose}
          onDetected={handleDetected}
          title={title}
        />
      </>
    );
  }

  return (
    <>
      <Button
        startIcon={<QrCodeScanner />}
        onClick={handleOpen}
        disabled={disabled}
        size={size}
        variant="outlined"
      >
        {children || 'Scannen'}
      </Button>
      
      <AdvancedScannerDialog
        open={open}
        onClose={handleClose}
        onDetected={handleDetected}
        title={title}
      />
    </>
  );
};