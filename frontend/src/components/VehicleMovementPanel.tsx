import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { ItemDto } from "../utils/api";
import useBarcodeScanner from "../hooks/useBarcodeScanner";
import useScanSound from "../hooks/useScanSound";
import { findItemByCode } from "../utils/itemLookup";

type MovementType = "CHECKIN" | "CHECKOUT";

type RestockPanelRequest = {
  item: ItemDto | (ItemDto & { targetStock?: number; alternateCodes?: string[] });
  status: string;
  quantityNeeded: number;
  quantityProvided?: number;
  preparedBy?: { id: string; displayName: string } | null;
};

type ScannedStockInfo = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  targetQuantity: number;
  existsOnVehicle: boolean;
};

type VehicleMovementPanelProps = {
  items: ItemDto[];
  isProcessing: boolean;
  onMovement: (type: MovementType, itemId: string, quantity: number) => Promise<boolean>;
  onReceiveProvided?: (itemId: string, quantity: number) => Promise<void>;
  externalError?: string | null;
  onClearError?: () => void;
  restockRequests?: RestockPanelRequest[];
  onItemNotFound?: (code: string) => void; // Callback wenn Artikel nicht gefunden
  onItemScanned?: (item: ItemDto | null, source?: "scan" | "manual") => void;
  scanFeedback?: ScannedStockInfo | null;
  onSetTargetForMissingItem?: (item: ItemDto, value: number) => Promise<void>;
  scanTargetSaving?: string | null;
  hideActionButtons?: boolean;
  onManualInput?: () => void;
};

type AutocompleteOption = {
  item: ItemDto;
  label: string;
};

const VehicleMovementPanel = React.memo(({
  items,
  isProcessing,
  onMovement,
  onReceiveProvided,
  externalError,
  onClearError,
  restockRequests = [],
  onItemNotFound,
  onItemScanned,
  scanFeedback,
  onSetTargetForMissingItem,
  scanTargetSaving,
  hideActionButtons = false,
  onManualInput,
}: VehicleMovementPanelProps) => {
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [scannerActive, setScannerActive] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [missingTargetDraft, setMissingTargetDraft] = useState<string>("1");
  const [missingTargetError, setMissingTargetError] = useState<string | null>(null);
  const { playSuccess, playError } = useScanSound();

  useEffect(() => {
    if (!scanFeedback) {
      setMissingTargetError(null);
      return;
    }
    if (scanFeedback.existsOnVehicle) {
      setMissingTargetDraft("1");
      setMissingTargetError(null);
    } else if (scanFeedback.targetQuantity > 0) {
      setMissingTargetDraft(String(scanFeedback.targetQuantity));
    } else {
      setMissingTargetDraft("1");
    }
  }, [scanFeedback?.id, scanFeedback?.existsOnVehicle, scanFeedback?.targetQuantity]);

  const itemsForAutocomplete = useMemo<AutocompleteOption[]>(
    () =>
      items.map((item) => ({
        item,
        label: `${item.code} - ${item.description}`,
      })),
    [items],
  );

  const isSavingMissingTarget = useMemo(
    () => Boolean(scanTargetSaving && selectedItem && scanTargetSaving === selectedItem.id),
    [scanTargetSaving, selectedItem],
  );

  const computeSuggestedQuantity = useCallback(
    (itemId?: string | null) => {
      if (!itemId) {
        return 1;
      }
      const restock = restockRequests?.find((r: RestockPanelRequest) => r.item.id === itemId);
      if (!restock) {
        return 1;
      }

      const provided = restock.quantityProvided ?? 0;
      if (provided > 0) {
        return provided;
      }

      return 1;
    },
    [restockRequests],
  );



  // RestockRequest-Logik: Finde zugewiesene RestockRequest für das aktuell gewählte Item
  const currentRestock = useMemo(() => {
    if (!selectedItem || !restockRequests) return null;
    return restockRequests.find((r: RestockPanelRequest) => r.item.id === selectedItem.id) ?? null;
  }, [selectedItem, restockRequests]);

  const selectedOption = useMemo<AutocompleteOption | null>(() => {
    if (!selectedItem) return null;
    return { item: selectedItem, label: `${selectedItem.code} - ${selectedItem.description}` };
  }, [selectedItem]);

  const handleDetected = useCallback(
    (code: string) => {
      const item = findItemByCode(items, code);
      setLastCode(code);
      setScannerActive(false);

      if (item) {
        setSelectedItem(item);
        setQuantity(1);
        setLocalError(null);
        onClearError?.();
        onItemScanned?.(item, "scan");
        playSuccess();
      } else {
        // Artikel nicht gefunden - rufe Callback auf statt Fehler zu zeigen
        if (onItemNotFound) {
          onItemNotFound(code);
        } else {
          setLocalError(`Artikel mit Code "${code}" nicht gefunden.`);
        }
        onItemScanned?.(null, "manual");
        playError();
      }
    },
    [items, onClearError, onItemNotFound, onItemScanned, playError, playSuccess],
  );

  const { videoRef, isSupported, error: scannerError } = useBarcodeScanner({
    onDetected: handleDetected,
    enabled: scannerActive,
  });

  const disableActions = isProcessing || !selectedItem;


  // Wenn eine RestockRequest existiert, schlage die bereitgestellte Menge vor
  const suggestedQuantity = useMemo(
    () => computeSuggestedQuantity(selectedItem?.id),
    [computeSuggestedQuantity, selectedItem?.id],
  );

  const adjustQuantity = (delta: number) => {
    setQuantity((prev: any) => Math.max(1, prev + delta));
  };


  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setQuantity(Number.isNaN(value) || value <= 0 ? 1 : value);
  };

  const handleMissingTargetSave = useCallback(async () => {
    if (!selectedItem || !onSetTargetForMissingItem) {
      return;
    }
    const trimmed = missingTargetDraft.trim();
    if (trimmed === "") {
      setMissingTargetError("Bitte eine Sollmenge eingeben.");
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) {
      setMissingTargetError("Nur ganze Zahlen ab 0 sind erlaubt.");
      return;
    }
    setMissingTargetError(null);
    await onSetTargetForMissingItem(selectedItem, value);
  }, [missingTargetDraft, onSetTargetForMissingItem, selectedItem]);

  // Rückgängig-Button: Setze Menge zurück auf Vorschlag
  const handleResetQuantity = () => {
    setQuantity(suggestedQuantity);
  };

  const triggerMovement = async (type: MovementType, customQuantity?: number) => {
    if (!selectedItem) {
      setLocalError("Bitte zuerst einen Artikel auswählen oder scannen.");
      playError();
      return;
    }

    setLocalError(null);
    onClearError?.();

    const qty = customQuantity ?? quantity;
    try {
      const success = await onMovement(type, selectedItem.id, qty);
      if (success) {
        playSuccess();
        setQuantity(1);
      } else {
        playError();
      }
    } catch (err) {
      console.error("Movement failed", err);
      playError();
      setLocalError("Bewegung konnte nicht verarbeitet werden.");
    }
  };

  const activeError = localError || externalError || scannerError;

  useEffect(() => {
    if (scannerActive) {
      // Scanner aktiv: Panel in den sichtbaren Bereich scrollen
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }, [scannerActive]);

  return (
    <Card sx={{ mb: 3 }} ref={panelRef}>
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h6" component="h2">
              Bewegungen erfassen
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scanne den QR-Code oder wähle den Artikel aus. Anschließend kannst du mit den Buttons unten ein- oder ausbuchen.
            </Typography>
          </Stack>

          <Stack spacing={2}>
            <Button
              variant={scannerActive ? "outlined" : "contained"}
              startIcon={scannerActive ? <StopCircleIcon /> : <QrCodeScannerIcon />}
              onClick={() =>
                setScannerActive((prev: any) => {
                  const next = !prev;
                  if (!prev) {
                    // Beim Aktivieren direkt nach oben scrollen
                    setTimeout(() => {
                      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 0);
                  }
                  return next;
                })
              }
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              {scannerActive ? "Scanner stoppen" : "Scanner starten"}
            </Button>
            <Box
              sx={{
                display: scannerActive ? "flex" : "none",
                borderRadius: 2,
                overflow: "hidden",
                border: 1,
                borderColor: "divider",
                width: "100%",
                maxWidth: "100%",
                backgroundColor: "black",
                position: "relative",
                justifyContent: "center",
                alignItems: "center",
                aspectRatio: "3 / 4",
                maxHeight: '65vh',
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </Box>
            {!isSupported && scannerActive && !scannerError && (
              <Alert severity="info">
                BarcodeDetector wird auf diesem Gerät oder Browser nicht unterstützt. Bitte verwende einen anderen Browser oder die manuelle Auswahl.
              </Alert>
            )}
            {lastCode && (
              <Typography variant="caption" color="text.secondary">
                Zuletzt gescannt: {lastCode}
              </Typography>
            )}
            {scanFeedback && (
              <Alert
                severity={
                  !scanFeedback.existsOnVehicle
                    ? "warning"
                    : scanFeedback.targetQuantity > 0 && scanFeedback.quantity < scanFeedback.targetQuantity
                      ? "warning"
                      : "success"
                }
                sx={{ mt: 1 }}
                onClose={(event: React.SyntheticEvent, reason?: string) => {
                  if (reason === "clickaway") {
                    return;
                  }
                  onItemScanned?.(null, "manual");
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {scanFeedback.code} - {scanFeedback.description}
                </Typography>
                {scanFeedback.existsOnVehicle ? (
                  <Typography variant="body2">
                    Fahrzeugbestand: <strong>{scanFeedback.quantity} Stück</strong>
                    {scanFeedback.targetQuantity > 0 && (
                      <>
                        {" "} | Soll: {scanFeedback.targetQuantity} Stück
                        {scanFeedback.quantity < scanFeedback.targetQuantity && (
                          <> (Fehlen {scanFeedback.targetQuantity - scanFeedback.quantity})</>
                        )}
                      </>
                    )}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      Dieser Artikel befindet sich aktuell nicht auf deinem Fahrzeug.
                    </Typography>
                    {onSetTargetForMissingItem && selectedItem && selectedItem.id === scanFeedback.id && (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "stretch", sm: "center" }}
                      >
                        <TextField
                          label="Soll-Bestand"
                          type="number"
                          size="small"
                          inputProps={{ min: 0, inputMode: "numeric", pattern: "[0-9]*" }}
                          value={missingTargetDraft}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMissingTargetDraft(event.target.value)}
                          error={Boolean(missingTargetError)}
                          helperText={missingTargetError ?? "Lege fest, wie viel auf dem Fahrzeug vorhanden sein soll."}
                          sx={{ flex: 1 }}
                        />
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleMissingTargetSave}
                          disabled={isSavingMissingTarget}
                        >
                          {isSavingMissingTarget ? "Speichern..." : "Sollwert speichern"}
                        </Button>
                      </Stack>
                    )}
                    {onSetTargetForMissingItem && (!selectedItem || selectedItem.id !== scanFeedback.id) && (
                      <Typography variant="caption" color="text.secondary">
                        Wähle den Artikel unten aus, um einen Soll-Bestand zu hinterlegen.
                      </Typography>
                    )}
                  </Stack>
                )}
              </Alert>
            )}
          </Stack>

          <Divider flexItem />

          <Autocomplete
            freeSolo
            options={itemsForAutocomplete}
            value={selectedOption}
            onChange={(_: any, option: AutocompleteOption | string | null) => {
              if (typeof option === 'string') {
                onManualInput?.();
                // Freie Eingabe: Versuche Artikel zu finden
                const item = findItemByCode(items, option);
                if (item) {
                  setSelectedItem(item);
                  setLocalError(null);
                  setQuantity(1);
                  onClearError?.();
                  onItemScanned?.(item, "manual");
                } else {
                  // Artikel nicht gefunden - rufe Callback auf
                  setSelectedItem(null);
                  onItemScanned?.(null, "manual");
                  if (onItemNotFound) {
                    onItemNotFound(option);
                  } else {
                    setLocalError(`Artikel mit Code "${option}" nicht gefunden.`);
                  }
                }
              } else if (option && typeof option === 'object') {
                onManualInput?.();
                // Reguläre Auswahl aus Liste
                setSelectedItem(option?.item ?? null);
                setLocalError(null);
                setQuantity(1);
                onClearError?.();
                if (option?.item) {
                  onItemScanned?.(option.item, "manual");
                } else {
                  onItemScanned?.(null, "manual");
                }
              } else {
                // null/undefined
                onManualInput?.();
                setSelectedItem(null);
                setLocalError(null);
                onItemScanned?.(null, "manual");
              }
            }}
            onInputChange={(_: any, value: string, reason: string) => {
              if (reason === 'input' || reason === 'clear') {
                onManualInput?.();
              }
              // Bei Enter: Versuche als Code zu interpretieren
              if (reason === 'reset' && value) {
                const item = findItemByCode(items, value);
                if (!item && onItemNotFound) {
                  onItemNotFound(value);
                }
              }
            }}
            renderInput={(params: any) => (
              <TextField {...params} label="Artikel auswählen" placeholder="Code oder Beschreibung eingeben" fullWidth onFocus={() => onManualInput?.()} />
            )}
            renderOption={(props: any, option: any) => (
              <li {...props}>
                <Stack spacing={0.25}>
                  <Typography variant="body2">{option.item.description}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.item.code} - {option.item.manufacturer || "-"}
                  </Typography>
                </Stack>
              </li>
            )}
            getOptionLabel={(option: any) => {
              if (typeof option === 'string') return option;
              return option.label || '';
            }}
            isOptionEqualToValue={(option: any, value: any) => {
              if (typeof option === 'string' || typeof value === 'string') return false;
              return option.item.id === value.item.id;
            }}
            noOptionsText="Keine Artikel gefunden"
          />

          {selectedItem && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: "action.hover",
              }}
            >
              <Typography variant="subtitle2">{selectedItem.description}</Typography>
              <Typography variant="body2" color="text.secondary">
                Code: {selectedItem.code}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hersteller: {selectedItem.manufacturer || "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Warengruppe: {selectedItem.productGroup || "-"}
              </Typography>
            </Box>
          )}


          {hideActionButtons ? (
            <Alert severity="info">
              Ein- und Ausbuchen läuft für den aktuellen Scan über den Bereich oben. Schließe den Hinweis dort, um hier wieder manuell zu buchen.
            </Alert>
          ) : (
            <>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <IconButton
                  size="large"
                  color="primary"
                  onClick={() => adjustQuantity(-1)}
                  disabled={quantity <= 1}
                  aria-label="Menge verringern"
                >
                  <RemoveIcon />
                </IconButton>
                <TextField
                  label="Menge"
                  type="number"
                  inputProps={{ min: 1, inputMode: "numeric", pattern: "[0-9]*" }}
                  value={quantity}
                  onChange={handleQuantityChange}
                  sx={{ width: 120 }}
                  // Farbliche Kennzeichnung, wenn Menge abweicht
                  color={suggestedQuantity !== quantity ? "warning" : "success"}
                  helperText={currentRestock ? `Vorgeschlagen: ${suggestedQuantity}` : undefined}
                />
                <IconButton
                  size="large"
                  color="primary"
                  onClick={() => adjustQuantity(1)}
                  aria-label="Menge erhöhen"
                >
                  <AddIcon />
                </IconButton>
              </Stack>


              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  size="large"
                  onClick={() => triggerMovement("CHECKOUT")}
                  disabled={disableActions}
                >
                  Ausbuchen
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  size="large"
                  onClick={() => triggerMovement("CHECKIN")}
                  disabled={disableActions}
                >
                  Einbuchen
                </Button>
                {currentRestock && typeof currentRestock.quantityProvided === "number" && currentRestock.quantityProvided > 0 && (
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    sx={{ ml: { sm: 2 } }}
                    onClick={async () => {
                      if (onReceiveProvided) {
                        await onReceiveProvided(selectedItem!.id, currentRestock.quantityProvided!);
                        return;
                      }
                      await triggerMovement("CHECKIN", currentRestock.quantityProvided!);
                    }}
                    disabled={disableActions}
                  >
                    +{currentRestock.quantityProvided} Lagererhalt (bereitgestellt)
                  </Button>
                )}
              </Stack>
            </>
          )}
          {/* Statusanzeige für RestockRequest */}
          {currentRestock && (
            <Alert severity={
              currentRestock.status === "APPROVED" ? "info"
              : currentRestock.status === "FULFILLED" ? "success"
              : currentRestock.status === "CANCELLED" ? "warning"
              : "error"
            } sx={{ mt: 2 }}>
              Status: {currentRestock.status === "APPROVED"
                ? "Bereitgestellt"
                : currentRestock.status === "FULFILLED"
                  ? "Erledigt"
                  : currentRestock.status === "CANCELLED"
                    ? "Storniert"
                    : "Offen"}
              {currentRestock.preparedBy && (
                <> – Bereit durch {currentRestock.preparedBy.displayName}</>
              )}
            </Alert>
          )}
          {activeError && <Alert severity="error">{activeError}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
});

VehicleMovementPanel.displayName = 'VehicleMovementPanel';

export default VehicleMovementPanel;












