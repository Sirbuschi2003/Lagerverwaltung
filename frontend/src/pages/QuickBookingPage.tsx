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
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CloseIcon from "@mui/icons-material/Close";
import { io, type Socket } from "socket.io-client";
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

interface CameraScanFeedback {
  type: "success" | "duplicate" | "error";
  text: string;
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
  const [cameraScanFeedback, setCameraScanFeedback] = useState<CameraScanFeedback | null>(null);
  const [syncConnected, setSyncConnected] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  // Ref damit handleScan immer den aktuellen Inhalt der Liste sieht (stale-closure-safe)
  const bookingListRef = useRef<BookingEntry[]>([]);
  useEffect(() => { bookingListRef.current = bookingList; }, [bookingList]);
  // Verhindert gleichzeitige Scan-Verarbeitungen (z.B. schnelle Folge-Scans)
  const busyRef = useRef(false);
  // Socket-Ref für Echtzeit-Sync
  const socketRef = useRef<Socket | null>(null);
  // Wenn true, kommt die nächste Listenänderung vom Remote → nicht zurücksenden
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    void loadItems();
  }, []);

  // ── Socket.io Echtzeit-Sync ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const socket = io("/stock", { path: "/socket.io", transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSyncConnected(true);
      socket.emit("quickbook:join", { userId: user.id });
    });
    socket.on("disconnect", () => setSyncConnected(false));

    // Anderes Gerät hat die Liste geändert → lokal übernehmen ohne zurückzusenden
    socket.on("quickbook:state", (data: { list: BookingEntry[] }) => {
      remoteUpdateRef.current = true;
      setBookingList(data.list ?? []);
    });

    // Anderes Gerät hat gebucht oder Liste gelöscht
    socket.on("quickbook:cleared", () => {
      remoteUpdateRef.current = true;
      setBookingList([]);
      setCurrentItem(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSyncConnected(false);
    };
  }, [user?.id]);

  // Listenänderungen an alle anderen Geräte senden
  useEffect(() => {
    if (remoteUpdateRef.current) {
      // Wurde vom Remote gesetzt → nicht zurücksenden, Flag zurücksetzen
      remoteUpdateRef.current = false;
      return;
    }
    if (!socketRef.current?.connected || !user?.id) return;
    socketRef.current.emit("quickbook:update", { userId: user.id, list: bookingList });
  }, [bookingList]);

  const refocusBarcode = () => setTimeout(() => barcodeRef.current?.focus(), 80);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const closeCameraDialog = () => {
    setCameraOpen(false);
    setCameraScanFeedback(null);
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

  const bookEntry = async (entry: BookingEntry): Promise<{ ok: boolean; error?: string }> => {
    if (!entry.locationId) {
      return {
        ok: false,
        error: `${entry.itemCode}: Kein Lagerort hinterlegt – Buchung nicht möglich. Bitte Lagerort am Artikel pflegen.`,
      };
    }
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
      return { ok: true };
    } catch (err: any) {
      const msg =
        Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(", ")
          : (err?.response?.data?.message ?? err?.message ?? "Unbekannter Fehler");
      return { ok: false, error: `${entry.itemCode}: ${msg}` };
    }
  };

  const handleScan = async (code: string) => {
    if (!code.trim()) return;
    // Verhindert parallele Verarbeitung falls Cooldown kürzer als API-Antwortzeit
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setItemNotFound(false);

    const found = await lookupItem(code.trim());
    setBarcodeInput("");

    if (!found) {
      playError();
      setItemNotFound(true);
      setCurrentItem(null);
      setCameraScanFeedback({ type: "error", text: `"${code.trim()}" – Artikel nicht gefunden` });
      busyRef.current = false;
      setBusy(false);
      refocusBarcode();
      return;
    }

    // Bei CHECKOUT: prüfen ob Gesamtmenge (Liste + neuer Scan) den Bestand überschreitet
    if (mode === "CHECKOUT" && found.currentQuantity !== null && found.currentQuantity !== undefined) {
      const alreadyBooked = bookingListRef.current
        .filter((e) => e.itemId === found.id && e.mode === "CHECKOUT")
        .reduce((sum, e) => sum + e.quantity, 0);
      const totalAfterScan = alreadyBooked + quantity;
      if (totalAfterScan > found.currentQuantity) {
        playError();
        const available = found.currentQuantity - alreadyBooked;
        const msg = available <= 0
          ? `${found.code} – Bestand aufgebraucht (${found.currentQuantity} Stk. vorhanden)`
          : `${found.code} – nur noch ${available} Stk. verfügbar (Bestand: ${found.currentQuantity})`;
        showError(msg);
        setCameraScanFeedback({ type: "error", text: msg });
        busyRef.current = false;
        setBusy(false);
        refocusBarcode();
        return;
      }
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
      const result = await bookEntry(entry);
      if (result.ok) {
        showSuccess(`${found.code} – ${quantity}x ${mode === "CHECKIN" ? "eingebucht" : "ausgebucht"}`);
        setCameraScanFeedback({ type: "success", text: `${found.code} – direkt gebucht (${quantity}×)` });
      } else {
        playError();
        showError(result.error ?? `Fehler beim Buchen von ${found.code}`);
        setCameraScanFeedback({ type: "error", text: result.error ?? `Fehler beim Buchen von ${found.code}` });
        busyRef.current = false;
        setBusy(false);
        refocusBarcode();
        return;
      }
    } else {
      // Ref nutzen statt bookingList direkt (stale closure im useCallback vermeiden)
      const existing = bookingListRef.current.find((e) => e.itemId === found.id && e.mode === mode);
      if (existing) {
        setCameraScanFeedback({
          type: "duplicate",
          text: `${found.code} – bereits in Liste, Menge jetzt: ${existing.quantity + quantity}`,
        });
      } else {
        setCameraScanFeedback({ type: "success", text: `${found.code} – zur Liste hinzugefügt` });
      }
      setBookingList((prev) => {
        const ex = prev.find((e) => e.itemId === found.id && e.mode === mode);
        if (ex) {
          return prev.map((e) =>
            e.itemId === found.id && e.mode === mode
              ? { ...e, quantity: e.quantity + quantity }
              : e,
          );
        }
        return [...prev, entry];
      });
    }

    busyRef.current = false;
    setBusy(false);
    refocusBarcode();
  };

  // Kamera-Scanner: bleibt offen nach jedem Scan für den nächsten Code
  const handleCameraDetected = useCallback(
    (code: string) => {
      setCameraScanFeedback(null); // kurz zurücksetzen während Lookup läuft
      void handleScan(code);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, quantity, reference, sofortBuchen, items],
  );

  const { videoRef, isSupported, error: scannerError } = useBarcodeScanner({
    onDetected: handleCameraDetected,
    enabled: cameraOpen,
    cooldownMs: 1500,
  });

  const handleUebernehmen = async () => {
    if (bookingList.length === 0) return;
    setBusy(true);
    const failedMessages: string[] = [];
    let success = 0;

    for (const entry of bookingList) {
      const result = await bookEntry(entry);
      if (result.ok) {
        success++;
      } else {
        failedMessages.push(result.error ?? entry.itemCode);
      }
    }

    setBusy(false);
    if (failedMessages.length === 0) {
      showSuccess(`${success} Position${success !== 1 ? "en" : ""} erfolgreich gebucht`);
      if (socketRef.current?.connected && user?.id) {
        socketRef.current.emit("quickbook:booked", { userId: user.id });
      }
      remoteUpdateRef.current = true;
      setBookingList([]);
      setCurrentItem(null);
    } else {
      showError(
        failedMessages.length === 1
          ? failedMessages[0]
          : `${failedMessages.length} Fehler: ${failedMessages.slice(0, 3).join(" | ")}${failedMessages.length > 3 ? " …" : ""}`,
      );
    }
    refocusBarcode();
  };

  const handleLoschen = () => {
    // Alle Geräte im Room informieren
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit("quickbook:clear", { userId: user.id });
    }
    remoteUpdateRef.current = true; // eigene Listenänderung nicht nochmal senden
    setBookingList([]);
    setCurrentItem(null);
    setBarcodeInput("");
    setReference("");
    setItemNotFound(false);
    refocusBarcode();
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* ── Sync-Status-Banner ── */}
      {syncConnected && (
        <Alert
          severity="info"
          icon={<SyncIcon fontSize="small" />}
          sx={{ mb: 1, py: 0.25, "& .MuiAlert-message": { py: 0.5 } }}
        >
          Echtzeit-Sync aktiv – Buchungsliste wird auf allen angemeldeten Geräten synchronisiert
        </Alert>
      )}
      {/* ── Kopfzeile: Buchungsart + Barcode + Menge + Vorgang ── */}
      <Paper sx={{ p: 2, mb: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "flex-start" }}>
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
                        onClick={() => { setCameraOpen(true); setCameraScanFeedback(null); }}
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
              fullWidth
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
            onClick={() => { setCameraOpen(true); setCameraScanFeedback(null); }}
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
        <Box sx={{ p: 1.5 }}>
          {/* Mobile */}
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            <Stack spacing={1}>
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
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleLoschen}
                  disabled={busy}
                  sx={{ flex: 1 }}
                >
                  Löschen
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  disabled={bookingList.length === 0 || busy}
                  onClick={() => void handleUebernehmen()}
                  sx={{ flex: 2 }}
                >
                  {busy ? "Buche…" : "Übernehmen"}
                </Button>
              </Stack>
            </Stack>
          </Box>
          {/* Desktop */}
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ display: { xs: "none", sm: "flex" } }}
          >
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
        </Box>
      </Paper>

      {/* ── Kamera-Scanner Dialog ── */}
      <Dialog
        open={cameraOpen}
        onClose={closeCameraDialog}
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
          <IconButton size="small" onClick={closeCameraDialog}>
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
          </Box>

          {/* Scan-Feedback: zeigt tatsächliches Ergebnis nach dem Lookup */}
          {cameraScanFeedback ? (
            <Alert
              severity={
                cameraScanFeedback.type === "error"
                  ? "error"
                  : cameraScanFeedback.type === "duplicate"
                  ? "info"
                  : "success"
              }
              sx={{ mt: 1 }}
            >
              {cameraScanFeedback.text}
            </Alert>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
              Halte den Code in den markierten Bereich
            </Typography>
          )}

          {/* Anzeige wie viele Artikel bereits in der Liste sind */}
          {!sofortBuchen && bookingList.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 0.5 }}>
              {bookingList.length} Artikel in der Liste
            </Typography>
          )}
        </DialogContent>
        <Box sx={{ p: 1.5, pt: 0 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={closeCameraDialog}
          >
            {!sofortBuchen && bookingList.length > 0
              ? `Fertig (${bookingList.length} Artikel)`
              : "Fertig"}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default QuickBookingPage;
