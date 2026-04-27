import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useBarcodeScanner from "../hooks/useBarcodeScanner";

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
  title = "Code scannen",
}) => {
  const { videoRef, isSupported, error } = useBarcodeScanner({
    onDetected: (code) => {
      onDetected(code);
      onClose();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {title}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 1 }}>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "4/3", bgcolor: "black", borderRadius: 1, overflow: "hidden" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: error ? "none" : "block" }}
            playsInline
            muted
          />

          {/* Loading spinner while camera initializes */}
          {!isSupported && !error && (
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "black",
            }}>
              <CircularProgress sx={{ color: "white" }} />
            </Box>
          )}

          {/* Error state */}
          {error && (
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              bgcolor: "black", p: 2, textAlign: "center",
            }}>
              <Typography color="error" gutterBottom>{error}</Typography>
              <Button onClick={onClose} variant="outlined" sx={{ color: "white", borderColor: "white" }}>Schließen</Button>
            </Box>
          )}

          {/* Scan frame overlay */}
          {isSupported && !error && (
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <Box sx={{
                width: 220, height: 220,
                border: "2px solid rgba(255,255,255,0.7)",
                borderRadius: 2,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }} />
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedScannerDialog;
