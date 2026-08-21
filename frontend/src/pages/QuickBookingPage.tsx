import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  type AutocompleteRenderInputParams,
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
  Snackbar,
  Switch,
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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PrintIcon from "@mui/icons-material/Print";
import { QRCodeSVG } from "qrcode.react";
import { io, type Socket } from "socket.io-client";
import useItemsStore from "../store/useItemsStore";
import useAuthStore from "../store/useAuthStore";
import { useUserSettingsStore } from "../store/useUserSettingsStore";
import { checkRecentCheckouts, findItemByAnyCode, recordMovement, type CheckoutHistoryHit, type ItemDto } from "../utils/api";
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
  currentQuantity?: number;
}

interface CameraScanFeedback {
  type: "success" | "duplicate" | "error";
  text: string;
}

interface DuplicateWarning {
  itemCode: string;
  itemName: string;
  customerNumber: string;
  hits: CheckoutHistoryHit[];
}

/** Extrahiert die Kundennummer aus dem LFS-Format: "LFS/461101/101574/400" → "461101" */
const extractCustomerNumber = (reference: string): string | null => {
  const parts = reference.split("/");
  if (parts.length >= 3 && /^\d+$/.test(parts[1])) return parts[1];
  return null;
};

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
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const qrConfirmRef = useRef<HTMLDivElement>(null);
  const qrResetRef = useRef<HTMLDivElement>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [cameraScanTarget, setCameraScanTarget] = useState<"barcode" | "source">("barcode");
  const [syncConnected, setSyncConnected] = useState(false);
  const { settings: userSettings, loaded: settingsLoaded, loadSettings, updateQuickBookingWorkflow, updateQuickBookingDuplicateCheck } = useUserSettingsStore();
  const vorgangsnummerFirst = userSettings.quickBookingWorkflow;
  const duplicateCheckEnabled = userSettings.quickBookingDuplicateCheck;
  const duplicateCheckMonths = userSettings.quickBookingDuplicateCheckMonths ?? 2;

  const toggleWorkflow = () => { void updateQuickBookingWorkflow(!vorgangsnummerFirst); };
  const toggleDuplicateCheck = () => { void updateQuickBookingDuplicateCheck(!duplicateCheckEnabled, duplicateCheckMonths); };
  const setDuplicateCheckMonths = (months: number) => { void updateQuickBookingDuplicateCheck(duplicateCheckEnabled, months); };

  const barcodeWrapperRef = useRef<HTMLDivElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  // Ref damit handleScan immer den aktuellen Inhalt der Liste sieht (stale-closure-safe)
  const bookingListRef = useRef<BookingEntry[]>([]);
  useEffect(() => { bookingListRef.current = bookingList; }, [bookingList]);
  // Refs für Werte die im Scanner-Callback immer aktuell sein müssen (ohne Scanner-Neustart)
  const cameraScanTargetRef = useRef<"barcode" | "source">("barcode");
  useEffect(() => { cameraScanTargetRef.current = cameraScanTarget; }, [cameraScanTarget]);
  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  // Verhindert gleichzeitige Scan-Verarbeitungen (z.B. schnelle Folge-Scans)
  const busyRef = useRef(false);
  const duplicateCheckEnabledRef = useRef(duplicateCheckEnabled);
  useEffect(() => { duplicateCheckEnabledRef.current = duplicateCheckEnabled; }, [duplicateCheckEnabled]);
  const duplicateCheckMonthsRef = useRef(duplicateCheckMonths);
  useEffect(() => { duplicateCheckMonthsRef.current = duplicateCheckMonths; }, [duplicateCheckMonths]);
  // Socket-Ref für Echtzeit-Sync
  const socketRef = useRef<Socket | null>(null);
  // Wenn true, kommt die nächste Listenänderung vom Remote → nicht zurücksenden
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    void loadItems();
    if (!settingsLoaded) void loadSettings();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settingsLoaded) return;
    if (vorgangsnummerFirst) {
      setTimeout(() => referenceRef.current?.focus(), 100);
    } else {
      setTimeout(() => barcodeWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 100);
    }
  }, [settingsLoaded]);  // eslint-disable-line react-hooks/exhaustive-deps

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

    // Anderes Gerät hat Vorgangsnummer gescannt
    socket.on("quickbook:reference", (data: { reference: string }) => {
      setReference(data.reference ?? "");
      if (referenceRef.current) {
        referenceRef.current.value = data.reference ?? "";
      }
    });

    // Anderes Gerät hat die Liste gelöscht
    socket.on("quickbook:cleared", () => {
      remoteUpdateRef.current = true;
      setBookingList([]);
      setCurrentItem(null);
    });

    // Anderes Gerät hat gebucht → Liste leeren + Fokus zurücksetzen
    socket.on("quickbook:booked", () => {
      remoteUpdateRef.current = true;
      setBookingList([]);
      setCurrentItem(null);
      setReference("");
      setTimeout(() => {
        const refInput = referenceRef.current;
        if (refInput) {
          refInput.value = "";
          refInput.focus();
        }
      }, 80);
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

  const refocusBarcode = () => {
    // double-rAF: ensures React has committed the new DOM before focusing
    requestAnimationFrame(() => requestAnimationFrame(() => {
      barcodeWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }));
  };

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

  const handlePrintQrCodes = () => {
    const confirmSvg = qrConfirmRef.current?.innerHTML ?? "";
    const resetSvg = qrResetRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Schnellbuchung QR-Aktionscodes</title>
      <style>
        body{font-family:Arial,sans-serif;display:flex;justify-content:center;gap:48px;padding:48px;background:#fff;}
        .card{text-align:center;border:2px solid #ccc;border-radius:10px;padding:24px 32px;}
        h2{margin:0 0 16px 0;font-size:18px;}
        p{margin:12px 0 0 0;font-size:13px;color:#555;max-width:160px;}
        @media print{@page{size:A5 landscape;margin:10mm;}}
      </style></head><body>
      <div class="card"><h2>✅ Übernehmen</h2>${confirmSvg}<p>Buchung abschließen</p></div>
      <div class="card"><h2>🔄 Neue Vorgangsnummer</h2>${resetSvg}<p>Vorgangsnummer zurücksetzen, Artikel bleiben in der Liste</p></div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
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

  const processFoundItem = async (found: ItemDto) => {
    if (mode === "CHECKOUT" && found.currentQuantity !== null && found.currentQuantity !== undefined) {
      const currentRef = reference || "";
      const alreadyBooked = bookingListRef.current
        .filter((e) => e.itemId === found.id && e.mode === "CHECKOUT" && e.reference === currentRef)
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
      reference: reference || "",
      currentQuantity: found.currentQuantity ?? undefined,
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
      const entryRef = reference || "";
      const existing = bookingListRef.current.find(
        (e) => e.itemId === found.id && e.mode === mode && e.reference === entryRef,
      );
      if (existing) {
        setCameraScanFeedback({
          type: "duplicate",
          text: `${found.code} – bereits in Liste, Menge jetzt: ${existing.quantity + quantity}`,
        });
      } else {
        setCameraScanFeedback({ type: "success", text: `${found.code} – zur Liste hinzugefügt` });
      }
      setBookingList((prev) => {
        const ex = prev.find(
          (e) => e.itemId === found.id && e.mode === mode && e.reference === entryRef,
        );
        if (ex) {
          return prev.map((e) =>
            e.itemId === found.id && e.mode === mode && e.reference === entryRef
              ? { ...e, quantity: e.quantity + quantity }
              : e,
          );
        }
        return [...prev, entry];
      });
    }

    // Duplikat-Prüfung: nur bei CHECKOUT mit gültiger Kundennummer, nicht-blockierend
    if (duplicateCheckEnabledRef.current && mode === "CHECKOUT" && reference) {
      const customerNumber = extractCustomerNumber(reference);
      if (customerNumber) {
        checkRecentCheckouts(found.id, customerNumber, duplicateCheckMonthsRef.current).then((hits) => {
          if (hits.length > 0) {
            setDuplicateWarnings((prev) => {
              const exists = prev.some((w) => w.itemCode === found.code && w.customerNumber === customerNumber);
              if (exists) return prev;
              return [...prev, { itemCode: found.code, itemName: found.description, customerNumber, hits }];
            });
          }
        });
      }
    }

    setQuantity(1);
    busyRef.current = false;
    setBusy(false);
    refocusBarcode();
  };

  const handleScan = async (code: string) => {
    if (!code.trim()) return;

    // QR-Aktionscodes auswerten bevor Artikelsuche startet
    const trimmed = code.trim();
    if (trimmed === "QB:CONFIRM") {
      setBarcodeInput("");
      if (busyRef.current) return;
      if (!sofortBuchen && bookingListRef.current.length > 0) {
        void handleUebernehmen();
      } else {
        // Im Sofort-Modus sind Artikel bereits gebucht → nur Vorgangsnummer zurücksetzen
        setReference("");
        setTimeout(() => { referenceRef.current?.focus(); }, 80);
        playSuccess();
      }
      return;
    }
    if (trimmed === "QB:RESET") {
      setBarcodeInput("");
      setReference("");
      setTimeout(() => { referenceRef.current?.focus(); }, 80);
      playSuccess();
      return;
    }

    // Verhindert parallele Verarbeitung falls Cooldown kürzer als API-Antwortzeit
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setItemNotFound(false);
    setBarcodeInput("");

    const found = await lookupItem(trimmed);

    if (!found) {
      // Wenn der Code aussieht wie eine Vorgangsnummer (z.B. LFS/461101/…), direkt als neue Referenz setzen.
      // Löst gleichzeitig die Duplikat-Warnung – der User wechselt zum nächsten Vorgang.
      if (extractCustomerNumber(trimmed)) {
        setReference(trimmed);
        if (referenceRef.current) referenceRef.current.value = trimmed;
        setDuplicateWarnings([]);
        setItemNotFound(false);
        busyRef.current = false;
        setBusy(false);
        if (socketRef.current?.connected && userIdRef.current) {
          socketRef.current.emit("quickbook:reference", { userId: userIdRef.current, reference: trimmed });
        }
        refocusBarcode();
        return;
      }
      playError();
      setItemNotFound(true);
      setCurrentItem(null);
      setCameraScanFeedback({ type: "error", text: `"${trimmed}" – Artikel nicht gefunden` });
      busyRef.current = false;
      setBusy(false);
      refocusBarcode();
      return;
    }

    await processFoundItem(found);
  };

  const handleScanItem = async (item: ItemDto) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setItemNotFound(false);
    setBarcodeInput("");
    await processFoundItem(item);
  };

  // Kamera-Scanner: bleibt offen nach jedem Scan für den nächsten Code.
  // cameraScanTarget + userId werden via Ref gelesen → Callback stabil, kein Scanner-Neustart.
  const handleCameraDetected = useCallback(
    (code: string) => {
      if (cameraScanTargetRef.current === "source") {
        const trimmed = code.trim();
        setReference(trimmed);
        setCameraOpen(false);
        setCameraScanFeedback(null);
        // Vorgangsnummer an andere Geräte übertragen
        if (socketRef.current?.connected && userIdRef.current) {
          socketRef.current.emit("quickbook:reference", { userId: userIdRef.current, reference: trimmed });
        }
        setTimeout(() => {
          barcodeWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus();
        }, 80);
        return;
      }
      setCameraScanFeedback(null);
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
      setDuplicateWarnings([]);
      setReference("");
      setTimeout(() => {
        if (referenceRef.current) {
          referenceRef.current.value = "";
          referenceRef.current.focus();
        }
      }, 80);
    } else {
      showError(
        failedMessages.length === 1
          ? failedMessages[0]
          : `${failedMessages.length} Fehler: ${failedMessages.slice(0, 3).join(" | ")}${failedMessages.length > 3 ? " …" : ""}`,
      );
    }
  };

  const handleLoschen = () => {
    // Alle Geräte im Room informieren
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit("quickbook:clear", { userId: user.id });
    }
    remoteUpdateRef.current = true; // eigene Listenänderung nicht nochmal senden
    setBookingList([]);
    setCurrentItem(null);
    setDuplicateWarnings([]);
    setBarcodeInput("");
    setReference("");
    setItemNotFound(false);
    refocusBarcode();
  };

  const computeEffectiveStock = (entry: BookingEntry): number | null => {
    if (entry.currentQuantity == null) return null;
    const delta = bookingList
      .filter((e) => e.itemId === entry.itemId)
      .reduce((sum, e) => sum + (e.mode === "CHECKOUT" ? -e.quantity : e.quantity), 0);
    return entry.currentQuantity + delta;
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
            <RadioGroup value={mode} onChange={(e) => { setMode(e.target.value as BookingMode); refocusBarcode(); }}>
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
          <Box ref={barcodeWrapperRef} sx={{ flex: 2, minWidth: 200 }}>
            <Autocomplete<ItemDto, false, true, true>
              freeSolo
              disableClearable
              options={items}
              inputValue={barcodeInput}
              onInputChange={(_: React.SyntheticEvent, val: string, reason: string) => {
                if (reason === "input") setBarcodeInput(val);
              }}
              filterOptions={(opts: ItemDto[], { inputValue }: { inputValue: string }) => {
                const q = inputValue.trim().toLowerCase();
                if (q.length < 2) return [];
                return opts.filter((item) =>
                  item.code.toLowerCase().includes(q) ||
                  (item.description ?? "").toLowerCase().includes(q) ||
                  (item.descriptionSecondary ?? "").toLowerCase().includes(q)
                ).slice(0, 15);
              }}
              getOptionLabel={(opt: ItemDto | string) => (typeof opt === "string" ? opt : opt.code)}
              onChange={(_: React.SyntheticEvent, value: ItemDto | string | null) => {
                if (value && typeof value !== "string") void handleScanItem(value);
              }}
              renderOption={(props: React.HTMLAttributes<HTMLLIElement>, option: ItemDto) => (
                <li {...props} key={option.id}>
                  <Stack spacing={0}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                      {option.descriptionSecondary ? ` – ${option.descriptionSecondary}` : ""}
                    </Typography>
                  </Stack>
                </li>
              )}
              noOptionsText="Kein Artikel gefunden"
              renderInput={(params: AutocompleteRenderInputParams) => (
                <TextField
                  {...params}
                  label="Barcode / Suche"
                  size="small"
                  fullWidth
                  disabled={busy}
                  error={itemNotFound}
                  helperText={itemNotFound ? "Artikel nicht gefunden" : " "}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.defaultPrevented) void handleScan(barcodeInput);
                  }}
                  InputProps={{
                    ...params.InputProps,
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
                            onClick={() => { setCameraScanTarget("barcode"); setCameraOpen(true); setCameraScanFeedback(null); }}
                            edge="end"
                            color="primary"
                            aria-label="Kamera-Scanner öffnen"
                          >
                            <QrCodeScannerIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Box>

          {/* Vorgangsnummer */}
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <TextField
              inputRef={referenceRef}
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
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") refocusBarcode();
              }}
              size="small"
              fullWidth
              helperText=" "
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Vorgangsnummer scannen">
                      <IconButton
                        size="small"
                        edge="end"
                        color="primary"
                        onClick={() => { setCameraScanTarget("source"); setCameraOpen(true); setCameraScanFeedback(null); }}
                        aria-label="Vorgangsnummer scannen"
                      >
                        <QrCodeScannerIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
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

        {/* Workflow-Einstellungen */}
        <Divider sx={{ mt: 1.5 }} />
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch size="small" checked={vorgangsnummerFirst} onChange={toggleWorkflow} />
            <Typography variant="caption" color="text.secondary">
              {vorgangsnummerFirst
                ? "Workflow: Vorgangsnummer → Artikel (z.B. Tonerlager)"
                : "Workflow: Direkt Artikel (z.B. Teilelager)"}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="QR-Aktionscodes drucken (Übernehmen / Neue Vorgangsnummer)">
              <Button size="small" variant="text" startIcon={<PrintIcon fontSize="small" />} onClick={() => setQrDialogOpen(true)} sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                QR-Aktionscodes
              </Button>
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch size="small" checked={duplicateCheckEnabled} onChange={toggleDuplicateCheck} />
            <Typography variant="caption" color="text.secondary">
              Duplikat-Warnung: gleicher Artikel an gleichen Kunden innerhalb von
            </Typography>
            <TextField
              select
              size="small"
              value={duplicateCheckMonths}
              onChange={(e) => setDuplicateCheckMonths(Number(e.target.value))}
              disabled={!duplicateCheckEnabled}
              sx={{ width: 90 }}
              SelectProps={{ native: true }}
              inputProps={{ style: { padding: "2px 4px", fontSize: "0.75rem" } }}
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? "Monat" : "Monate"}</option>
              ))}
            </TextField>
          </Stack>
        </Stack>

        {/* Kamera-Scanner-Button für Mobile (prominent) */}
        <Box sx={{ display: { xs: "block", sm: "none" }, mt: 1 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => { setCameraScanTarget("barcode"); setCameraOpen(true); setCameraScanFeedback(null); }}
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
                  Lagerort:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentItem.storageLocation
                    ? `${currentItem.storageLocation.code}${currentItem.storageLocation.name ? ` – ${currentItem.storageLocation.name}` : ""}`
                    : "–"}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" spacing={4}>
                <Typography variant="body2" color="text.secondary">
                  Buchungsmenge:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {quantity} Stk.
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" spacing={4}>
                <Typography variant="body2" color="text.secondary">
                  Verfügbarer Bestand:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color:
                      currentItem.currentQuantity == null
                        ? "text.secondary"
                        : currentItem.currentQuantity <= 0
                        ? "error.main"
                        : currentItem.currentQuantity <= (currentItem.minimumStock ?? 0)
                        ? "warning.main"
                        : "success.main",
                  }}
                >
                  {currentItem.currentQuantity ?? "–"} Stk.
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

      {/* Duplikat-Warnung – Snackbar ist von MUI explizit nicht-blockierend */}
      <Snackbar
        open={duplicateWarnings.length > 0}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 8, maxWidth: { xs: "calc(100vw - 32px)", sm: 480 }, width: "100%" }}
      >
        <Paper
          elevation={12}
          sx={{
            width: "100%",
            border: "3px solid",
            borderColor: "warning.dark",
            overflow: "hidden",
            "@keyframes dupeShake": {
              "0%, 100%": { transform: "translateX(0)" },
              "20%": { transform: "translateX(-6px)" },
              "40%": { transform: "translateX(6px)" },
              "60%": { transform: "translateX(-4px)" },
              "80%": { transform: "translateX(4px)" },
            },
            animation: "dupeShake 0.45s ease-in-out",
          }}
        >
          <Box sx={{ bgcolor: "warning.main", color: "warning.contrastText", py: 1, px: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 26 }} />
            <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
              Duplikat-Warnung
            </Typography>
            <IconButton size="small" onClick={() => setDuplicateWarnings([])} sx={{ color: "warning.contrastText" }} aria-label="Schliessen">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
            {duplicateWarnings.map((w, idx) => (
              <Box key={`${w.itemCode}-${w.customerNumber}-${idx}`} sx={{ mb: idx < duplicateWarnings.length - 1 ? 2 : 0 }}>
                <Typography variant="body1" fontWeight={800}>
                  {w.itemCode} – bereits an Kunde {w.customerNumber} ausgebucht!
                </Typography>
                {w.hits.map((h, hi) => (
                  <Typography key={hi} variant="body2" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                    {new Date(h.occurredAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    {" · "}Vorgang: {h.source}
                    {" · "}{h.quantity} Stk.
                  </Typography>
                ))}
                {idx < duplicateWarnings.length - 1 && <Divider sx={{ mt: 1.5 }} />}
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Schließt sich nach „Übernehmen" oder manuell per ✕.
            </Typography>
          </Box>
        </Paper>
      </Snackbar>

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
                        {computeEffectiveStock(entry) != null && (
                          <Typography variant="caption" color="text.secondary">
                            Bestand:{" "}
                            <Box
                              component="span"
                              sx={{
                                fontWeight: 700,
                                color: (computeEffectiveStock(entry) ?? 0) < 0 ? "error.main" : (computeEffectiveStock(entry) ?? 0) === 0 ? "warning.main" : "text.primary",
                              }}
                            >
                              {computeEffectiveStock(entry)}
                            </Box>
                          </Typography>
                        )}
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
                      onClick={() => { setBookingList((prev) => prev.filter((_, i) => i !== idx)); refocusBarcode(); }}
                      sx={{ ml: 1, flexShrink: 0 }}
                      aria-label="Loeschen"
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
                <TableCell align="right">Bestand</TableCell>
                <TableCell>Lagerort</TableCell>
                <TableCell>Vorgang</TableCell>
                <TableCell padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {bookingList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
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
                    <TableCell align="right" sx={{ fontWeight: 700, color: (() => { const s = computeEffectiveStock(entry); return s == null ? "text.secondary" : s < 0 ? "error.main" : s === 0 ? "warning.main" : "text.primary"; })() }}>
                      {computeEffectiveStock(entry) ?? "–"}
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
                        onClick={() => { setBookingList((prev) => prev.filter((_, i) => i !== idx)); refocusBarcode(); }}
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

      {/* ── QR-Aktionscodes Dialog ── */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          QR-Aktionscodes drucken
          <IconButton size="small" onClick={() => setQrDialogOpen(false)} aria-label="Schliessen"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Diese QR-Codes ausdrucken und z.B. im Fahrzeug oder Lager aufhängen. Beim Scannen wird die jeweilige Aktion direkt ausgelöst.
          </Typography>
          <Box sx={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>✅ Übernehmen</Typography>
              <Box ref={qrConfirmRef} sx={{ display: "inline-block", border: "3px solid", borderColor: "success.main", borderRadius: 2, p: 1.5 }}>
                <QRCodeSVG value="QB:CONFIRM" size={160} />
              </Box>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, maxWidth: 180 }}>
                Buchung abschließen (Übernehmen)
              </Typography>
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>🔄 Neue Vorgangsnummer</Typography>
              <Box ref={qrResetRef} sx={{ display: "inline-block", border: "3px solid", borderColor: "info.main", borderRadius: 2, p: 1.5 }}>
                <QRCodeSVG value="QB:RESET" size={160} />
              </Box>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, maxWidth: 180 }}>
                Vorgangsnummer löschen, Artikel bleiben in der Liste
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrintQrCodes}>
              Drucken
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

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
            <span>{cameraScanTarget === "source" ? "Vorgangsnummer scannen" : "QR-Code / Barcode scannen"}</span>
          </Stack>
          <IconButton size="small" onClick={closeCameraDialog} aria-label="Schliessen">
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
