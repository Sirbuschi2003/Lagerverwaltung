import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const REASON_OPTIONS = [
  "Inventur / Nachzählung",
  "Fehlbuchung korrigiert",
  "Beschädigt / Ausschuss",
  "Verlust / Diebstahl",
  "Sonstiger Grund",
];

interface StockAdjustmentReasonDialogProps {
  open: boolean;
  delta: number;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

// Rein informativ fuer die spaetere Nachvollziehbarkeit im Bewegungs-Log -
// Auswahl UND Freitext sind bewusst optional, damit das Speichern des
// Ist-Bestands nie an einer fehlenden Begruendung scheitert.
export default function StockAdjustmentReasonDialog({ open, delta, onCancel, onConfirm }: StockAdjustmentReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const reset = () => {
    setReason("");
    setNote("");
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    const combined = [reason, note.trim()].filter(Boolean).join(": ");
    reset();
    onConfirm(combined || "Ist-Bestand angepasst");
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Grund für die Bestandsänderung</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ist-Bestand wird um {Math.abs(delta)} {delta > 0 ? "erhöht" : "verringert"}. Die Angabe ist optional, hilft aber später bei der Nachvollziehbarkeit.
        </Typography>
        <Stack spacing={2}>
          <TextField
            select
            label="Grund (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          >
            <MenuItem value="">— keine Auswahl —</MenuItem>
            {REASON_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Anmerkung (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Abbrechen</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
