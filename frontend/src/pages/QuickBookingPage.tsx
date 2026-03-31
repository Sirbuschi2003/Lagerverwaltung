import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CloseIcon from "@mui/icons-material/Close";
import useItemsStore from "../store/useItemsStore";
import useAuthStore from "../store/useAuthStore";
import { findItemByAnyCode, recordMovement, type ItemDto } from "../utils/api";
import useScanSound from "../hooks/useScanSound";
import { findItemByCode } from "../utils/itemLookup";
import useBarcodeScanner from "../hooks/useBarcodeScanner";

type BookingMode = "CHECKOUT" | "CHECKIN";

interface BookingEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  mode: BookingMode;
  locationId?: string;
  locationName?: string;
  reference?: string;
}

const QuickBookingPage: React.FC = () => {
  const { items, loadItems } = useItemsStore();
  const { user } = useAuthStore();
  const { playSuccess, playError } = useScanSound();

  const [mode, setMode] = useState<BookingMode>("CHECKOUT");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [currentItem, setCurrentItem] = useState<ItemDto | null>(null);
  const [itemNotFound, setItemNotFound] = useState(false);
  const [bookingList, setBookingList] = useState<BookingEntry[]>([]);
  const [sofortBuchen, setSofortBuchen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadItems();
  }, []);

  const refocusBarcode = () => setTimeout(() => barcodeRef.current?.focus(), 80);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const lookupItem = async (code: string): Promise<ItemDto | null> => {
    if (navigator.onLine) {
      try {
        return await findItemByAnyCode(code);
      } catch {
        // API nicht erreichbar – Store-Fallback
      }
    }
    return findItemByCode(items, code) ?? null;
  };

  const bookEntry = async (entry: BookingEntry): Promise<boolean> => {
    try {
      await recordMovement({
        itemId: entry.itemId,
        locationId: entry.locationId,
        userId: user?.id,
        type: entry.mode,
        quantity: entry.quantity,
        occurredAt: new Date().toISOString(),
        source: entry.reference || "quick-booking",
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleScan = async (code: string) => {
    if (!code.trim()) return;
    setBusy(true);
    setItemNotFound(false);

    const found = await lookupItem(code.trim());
    setBarcodeInput("");

    if (!found) {
      playError();
      setItemNotFound(true);
      setCurrentItem(null);
      setBusy(false);
      refocusBarcode();
      return;
    }

    playSuccess();
    setCurrentItem(found);

    const entry: BookingEntry = {
      itemId: found.id,
      itemCode: found.code,
      itemName: found.description,
      quantity,
      mode,
      locationId: found.storageLocation?.id,
      locationName: found.storageLocation
        ? `${found.storageLocation.code}${found.storageLocation.name ? ` – ${found.storageLocation.name}` : ""}`
        : undefined,
      reference: reference || undefined,
    };

    if (sofortBuchen) {
      const ok = await bookEntry(entry);
      if (ok) {
        showSuccess(`${found.code} – ${quantity}x ${mode === "CHECKIN" ? "eingebucht" : "ausgebucht"}`);
      } else {
        showError(`Fehler beim Buchen von ${found.code}`);
      }
    } else {
      setBookingList((prev) => {
        const existing = prev.find((e) => e.itemId === found.id && e.mode === mode);
        if (existing) {
          return prev.map((e) =>
            e.itemId === found.id && e.mode === mode
              ? { ...e, quantity: e.quantity + quantity }
              : e,
          );
        }
        return [...prev, entry];
      });
    }

    setBusy(false);
    refocusBarcode();
  };

  // Kamera-Scanner: wird nur aufgerufen wenn Dialog offen
  const handleCameraDetected = useCallback(
    (code: string) => {
      setCameraOpen(false);
      void handleScan(code);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, quantity, reference, sofortBuchen, items],
  );

  const { videoRef, isSupported, error: scannerError } = useBarcodeScanner({
    onDetected: handleCameraDetected,
    enabled: cameraOpen,
  });

  const handleUebernehmen = async () => {
    if (bookingList.length === 0) return;
    setBusy(true);
    let errors = 0;
    let success = 0;

    for (const entry of bookingList) {
      const ok = await bookEntry(entry);
      if (ok) success++;
      else errors++;
    }

    setBusy(false);
    if (errors === 0) {
      showSuccess(`${success} Position${success !== 1 ? "en" : ""} erfolgreich gebucht`);
      setBookingList([]);
      setCurrentItem(null);
    } else {
      showError(`${errors} Fehler bei der Buchung (${success} erfolgreich)`);
    }
    refocusBarcode();
  };

  const handleLoschen = () => {
    setBookingList([]);
    setCurrentItem(null);
    setBarcodeInput("");
    setReference("");
    setItemNotFound(false);
    refocusBarcode();
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* ── Kopfzeile: Buchungsart + Barcode + Menge + Vorgang ── */}
      <Paper sx={{ p: 2, mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap">
          {/* Buchungsart */}
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
              Buchungsart
            </Typography>
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as BookingMode)}>
              <FormControlLabel
                value="CHECKOUT"
                control={<Radio size="small" />}
                label="Lagerentnahme"
                sx={{ mb: 0 }}
              />
              <FormControlLabel
                value="CHECKIN"
                control={<Radio size="small" />}
                label="Wareneingang"
              />
            </RadioGroup>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />

          {/* Barcode + Kamera-Button */}
          <Box sx={{ flex: 2, minWidth: 200 }}>
            <TextField
              inputRef={barcodeRef}
              label="Barcode"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleScan(barcodeInput);
              }}
              size="small"
              fullWidth
              autoFocus
              disabled={busy}
              error={itemNotFound}
              helperText={itemNotFound ? "Artikel nicht gefunden" : " "}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Kamera-Scanner öffnen">
                      <IconButton
                        size="small"
                        onClick={() => setCameraOpen(true)}
                        edge="end"
                        color="primary"
                      >
                        <QrCodeScannerIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Vorgangsnummer */}
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <TextField
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>Vorgangsnummer</span>
                  <Tooltip title="Optionale Referenz – z.B. Auftragsnummer oder Reparatur-ID. Wird bei der Buchung gespeichert und erleichtert spätere Auswertungen.">
                    <InfoOutlinedIcon sx={{ fontSize: 14, cursor: "help" }} />
                  </Tooltip>
                </Stack>
              }
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              size="small"
              fullWidth
              helperText=" "
            />
          </Box>

          {/* Menge */}
          <Box sx={{ minWidth: 100 }}>
            <TextField
              label="Menge"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              size="small"
              inputProps={{ min: 1, style: { textAlign: "right" } }}
              helperText=" "
            />
          </Box>
        </Stack>

        {/* Kamera-Scanner-Button für Mobile (prominent) */}
        <Box sx={{ display: { xs: "block", sm: "none" }, mt: 1 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={busy}
          >
            QR-Code / Barcode scannen
          </Button>
        </Box>
      </Paper>

      {/* ── Artikel-Info Panel ── */}
      <Paper sx={{ p: 2, mb: 1, minHeight: 76 }}>
        {currentItem ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Artikel-Nr.
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {currentItem.code}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentItem.description}
                {currentItem.descriptionSecondary
                  ? ` – ${currentItem.descriptionSecondary}`
                  : ""}
              </Typography>
            </Box>
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: "none", sm: "block" } }}
            />
            <Stack spacing={0.3} sx={{ minWidth: 200 }}>
              <Stack direction="row" justifyContent="space-between" spacing={4}>
                <Typography variant="body2" color="text.secondary">
                  Bestand:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentItem.currentQuantity ?? "–"}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" spacing={4}>
                <Typography variant="body2" color="text.secondary">
                  Lagerort:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentItem.storageLocation
                    ? `${currentItem.storageLocation.code}${currentItem.storageLocation.name ? ` – ${currentItem.storageLocation.name}` : ""}`
                    : "–"}
                </Typography>
              </Stack>
              {!currentItem.storageLocation && (
                <Typography variant="caption" color="warning.main">
                  Kein Lagerort am Artikel hinterlegt
                </Typography>
              )}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 0.5 }}>
            Barcode scannen oder eingeben und Enter drücken
          </Typography>
        )}
      </Paper>

      {/* Status */}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 1 }}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errorMsg}
        </Alert>
      )}

      {/* ── Buchungsliste ── */}
      <Paper>
        {/* Mobile: Karten-Ansicht */}
        <Box sx={{ display: { xs: "block", sm: "none" }, minHeight: 180 }}>
          {bookingList.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Noch keine Artikel in der Liste
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1} sx={{ p: 1 }}>
              {bookingList.map((entry, idx) => (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor:
                      entry.mode === "CHECKIN"
                        ? "rgba(76,175,80,0.06)"
                        : "rgba(244,67,54,0.06)",
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          label={entry.mode === "CHECKIN" ? "Eingang" : "Entnahme"}
                          color={entry.mode === "CHECKIN" ? "success" : "error"}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {entry.itemCode}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {entry.itemName}
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary">
                          Menge:{" "}
                          <Box component="span" sx={{ fontWeight: 700 }}>
                            {entry.quantity}
                          </Box>
                        </Typography>
                        {entry.locationName && (
                          <Typography variant="caption" color="text.secondary">
                            {entry.locationName}
                          </Typography>
                        )}
                        {entry.reference && (
                          <Typography variant="caption" color="text.secondary">
                            #{entry.reference}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setBookingList((prev) => prev.filter((_, i) => i !== idx))}
                      sx={{ ml: 1, flexShrink: 0 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>

        {/* Desktop: Tabellen-Ansicht */}
        <TableContainer sx={{ minHeight: 180, display: { xs: "none", sm: "block" } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Buchungsart</TableCell>
                <TableCell>Artikel-Nr.</TableCell>
                <TableCell>Bezeichnung</TableCell>
                <TableCell align="right">Menge</TableCell>
                <TableCell>Lagerort</TableCell>
                <TableCell>Vorgang</TableCell>
                <TableCell padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {bookingList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    sx={{ textAlign: "center", py: 5, color: "text.secondary" }}
                  >
                    Noch keine Artikel in der Liste
                  </TableCell>
                </TableRow>
              ) : (
                bookingList.map((entry, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      bgcolor:
                        entry.mode === "CHECKIN"
                          ? "rgba(76,175,80,0.06)"
                          : "rgba(244,67,54,0.06)",
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={entry.mode === "CHECKIN" ? "Eingang" : "Entnahme"}
                        color={entry.mode === "CHECKIN" ? "success" : "error"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{entry.itemCode}</TableCell>
                    <TableCell>{entry.itemName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {entry.quantity}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>
                      {entry.locationName || "–"}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>
                      {entry.reference || "–"}
                    </TableCell>
                    <TableCell padding="none">
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setBookingList((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <DeleteIcon fontSize="small" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />

        {/* Aktionsleiste */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 1.5 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleLoschen}
            disabled={busy}
          >
            Löschen
          </Button>

          <Box sx={{ flex: 1 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={sofortBuchen}
                onChange={(e) => setSofortBuchen(e.target.checked)}
                size="small"
              />
            }
            label="Sofort buchen"
          />

          <Button
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            disabled={bookingList.length === 0 || busy}
            onClick={() => void handleUebernehmen()}
            sx={{ minWidth: 140 }}
          >
            {busy ? "Buche…" : "Übernehmen"}
          </Button>
        </Stack>
      </Paper>

      {/* ── Kamera-Scanner Dialog ── */}
      <Dialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{
          "& .MuiDialog-paper": {
            margin: { xs: 1, sm: 2 },
            width: { xs: "calc(100% - 16px)", sm: "auto" },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <QrCodeScannerIcon />
            <span>QR-Code / Barcode scannen</span>
          </Stack>
          <IconButton size="small" onClick={() => setCameraOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1 }}>
          {scannerError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {scannerError}
            </Alert>
          )}
          {!isSupported && !scannerError && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Kamera wird auf diesem Gerät nicht unterstützt.
            </Alert>
          )}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              bgcolor: "black",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", display: "block", maxHeight: "60vh", objectFit: "cover" }}
              muted
              playsInline
            />
            {/* Fadenkreuz */}
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 200,
                height: 200,
                border: "2px solid rgba(255,255,255,0.7)",
                borderRadius: 1,
                pointerEvents: "none",
                "&::before, &::after": {
                  content: '""',
                  position: "absolute",
                  background: "rgba(255,255,255,0.7)",
                },
                "&::before": { top: "50%", left: 0, right: 0, height: 1 },
                "&::after": { left: "50%", top: 0, bottom: 0, width: 1 },
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
            Halte den Code in den markierten Bereich
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default QuickBookingPage;
