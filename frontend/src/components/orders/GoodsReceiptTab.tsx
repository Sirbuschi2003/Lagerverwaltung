import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { Check as CheckIcon, Refresh as RefreshIcon } from "@mui/icons-material";

import {
  fetchPurchaseOrders,
  receivePurchaseOrder,
  type PurchaseOrderDto,
  type PurchaseOrderLineDto,
} from "../../utils/api";
import { findItemByCode } from "../../utils/itemLookup";
import ItemEditDialog from "../items/ItemEditDialog";

type DeliveryState = "OPEN" | "PARTIAL" | "COMPLETE";

type DeliveryMeta = {
  label: string;
  color: "default" | "warning" | "success";
};

type ScanCandidate = {
  lineId: string;
  code: string;
  description: string;
  ordered: number;
  alreadyReceived: number;
  remaining: number;
  suggestedQuantity: number;
};

const deliveryMetaMap: Record<DeliveryState, DeliveryMeta> = {
  OPEN: { label: "Offen", color: "default" },
  PARTIAL: { label: "Teilgeliefert", color: "warning" },
  COMPLETE: { label: "Vollständig", color: "success" },
};

const getOrderYear = (order: PurchaseOrderDto) => {
  const reference = order.orderedAt || order.createdAt;
  const parsed = new Date(reference);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    DRAFT: "Entwurf",
    ORDERED: "Bestellt",
    RECEIVED: "Eingegangen",
    CANCELLED: "Storniert",
    ARCHIVED: "Archiviert",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string): "error" | "warning" | "success" | "info" | "default" => {
  const colors: Record<string, "error" | "warning" | "success" | "info" | "default"> = {
    DRAFT: "warning",
    ORDERED: "info",
    RECEIVED: "success",
    CANCELLED: "error",
    ARCHIVED: "default",
  };
  return colors[status] || "default";
};

const getRemainingQuantity = (ordered?: number | null, received?: number | null) =>
  Math.max(0, (ordered ?? 0) - (received ?? 0));

const getOrderDeliveryState = (order: PurchaseOrderDto): DeliveryState => {
  const lines = order.lines ?? [];
  if (lines.length === 0) return "OPEN";

  const allComplete = lines.every((line) => getRemainingQuantity(line.quantity, line.receivedQuantity) <= 0);
  if (allComplete) return "COMPLETE";

  const anyReceived = lines.some((line) => (line.receivedQuantity ?? 0) > 0);
  return anyReceived ? "PARTIAL" : "OPEN";
};

const getLineDeliveryState = (line: PurchaseOrderLineDto, plannedNow = 0): DeliveryState => {
  const ordered = line.quantity ?? 0;
  const alreadyReceived = line.receivedQuantity ?? 0;
  const afterBooking = alreadyReceived + plannedNow;
  if (afterBooking >= ordered) return "COMPLETE";
  if (afterBooking > 0) return "PARTIAL";
  return "OPEN";
};

const getItemAlternateCodes = (item: any): string[] => {
  if (Array.isArray(item?.alternateCodes)) {
    return item.alternateCodes.filter((entry: unknown): entry is string => typeof entry === "string");
  }
  if (Array.isArray(item?.codes)) {
    return item.codes
      .map((entry: any) => String(entry?.code ?? "").trim())
      .filter((entry: string) => entry.length > 0);
  }
  return [];
};

const lineMatchesScannedCode = (line: PurchaseOrderLineDto, code: string): boolean => {
  const lookupItem = {
    code: line.item?.code ?? "",
    qrCodeValue: (line.item as any)?.qrCodeValue ?? "",
    alternateCodes: getItemAlternateCodes(line.item),
  };
  return Boolean(findItemByCode([lookupItem], code));
};

const GoodsReceiptTab: React.FC = () => {
  const theme = useTheme();

  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");

  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanCandidate, setScanCandidate] = useState<ScanCandidate | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [itemDialogId, setItemDialogId] = useState<string | null>(null);
  const [confirmWithoutNoteOpen, setConfirmWithoutNoteOpen] = useState(false);

  const focusBarcodeInput = () => {
    window.setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 30);
  };

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftOrders, orderedOrders] = await Promise.all([
        fetchPurchaseOrders({ status: "DRAFT" }),
        fetchPurchaseOrders({ status: "ORDERED" }),
      ]);
      setOrders([...draftOrders, ...orderedOrders]);
    } catch (err: any) {
      setError(`Fehler beim Laden der Bestellungen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      focusBarcodeInput();
    }
  }, [dialogOpen]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      if (order.supplier?.id) map.set(order.supplier.id, order.supplier.name || "Unbekannt");
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [orders]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    orders.forEach((order) => years.add(getOrderYear(order)));
    return [...years].sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (supplierFilter !== "ALL" && order.supplier?.id !== supplierFilter) return false;
        if (yearFilter !== "ALL" && getOrderYear(order) !== Number.parseInt(yearFilter, 10)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, supplierFilter, yearFilter]);

  const hasPlannedReceipt = useMemo(() => {
    if (!selectedOrder) return false;
    return selectedOrder.lines.some((line) => {
      const remaining = getRemainingQuantity(line.quantity, line.receivedQuantity);
      const qty = Math.max(0, Math.min(remaining, receivedQuantities[line.id] ?? 0));
      return qty > 0;
    });
  }, [selectedOrder, receivedQuantities]);

  const receiptSummary = useMemo(() => {
    if (!selectedOrder) {
      return {
        ordered: 0,
        alreadyReceived: 0,
        plannedNow: 0,
        remainingAfterBooking: 0,
        deliveryStateAfterBooking: "OPEN" as DeliveryState,
      };
    }

    const ordered = selectedOrder.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
    const alreadyReceived = selectedOrder.lines.reduce((sum, line) => sum + (line.receivedQuantity ?? 0), 0);
    const plannedNow = selectedOrder.lines.reduce((sum, line) => {
      const remaining = getRemainingQuantity(line.quantity, line.receivedQuantity);
      const qty = Math.max(0, Math.min(remaining, receivedQuantities[line.id] ?? 0));
      return sum + qty;
    }, 0);
    const remainingAfterBooking = selectedOrder.lines.reduce((sum, line) => {
      const remaining = getRemainingQuantity(line.quantity, line.receivedQuantity);
      const qty = Math.max(0, Math.min(remaining, receivedQuantities[line.id] ?? 0));
      return sum + Math.max(0, remaining - qty);
    }, 0);

    let deliveryStateAfterBooking: DeliveryState = "OPEN";
    if (remainingAfterBooking <= 0 && ordered > 0) {
      deliveryStateAfterBooking = "COMPLETE";
    } else if (alreadyReceived + plannedNow > 0) {
      deliveryStateAfterBooking = "PARTIAL";
    }

    return {
      ordered,
      alreadyReceived,
      plannedNow,
      remainingAfterBooking,
      deliveryStateAfterBooking,
    };
  }, [selectedOrder, receivedQuantities]);

  const handleOpenReceiptDialog = (order: PurchaseOrderDto) => {
    setSelectedOrder(order);
    const quantities: Record<string, number> = {};
    order.lines.forEach((line) => {
      quantities[line.id] = 0;
    });
    setReceivedQuantities(quantities);
    setDeliveryNoteNumber(order.deliveryNoteNumber ?? "");
    setBarcodeInput("");
    setScanCandidate(null);
    setScanFeedback(null);
    setDialogOpen(true);
  };

  const handleCloseReceiptDialog = () => {
    setSelectedOrder(null);
    setReceivedQuantities({});
    setDeliveryNoteNumber("");
    setBarcodeInput("");
    setScanCandidate(null);
    setScanFeedback(null);
    setDialogOpen(false);
  };

  const handleQuantityChange = (lineId: string, value: number, max: number) => {
    setReceivedQuantities((prev) => ({
      ...prev,
      [lineId]: Math.max(0, Math.min(max, value)),
    }));
  };

  const handleFillRemaining = () => {
    if (!selectedOrder) return;
    const nextValues: Record<string, number> = {};
    selectedOrder.lines.forEach((line) => {
      nextValues[line.id] = getRemainingQuantity(line.quantity, line.receivedQuantity);
    });
    setReceivedQuantities(nextValues);
    setScanFeedback("Alle offenen Mengen wurden als Vorschlag übernommen.");
    setScanCandidate(null);
    focusBarcodeInput();
  };

  const handleBarcodeScan = (incomingCode?: string) => {
    if (!selectedOrder) return;

    const code = (incomingCode ?? barcodeInput).trim();
    if (!code) return;

    const line = selectedOrder.lines.find((entry) => lineMatchesScannedCode(entry, code));
    if (!line) {
      setError(`Artikel mit Code "${code}" nicht in dieser Bestellung gefunden.`);
      setScanFeedback(null);
      setScanCandidate(null);
      setBarcodeInput("");
      focusBarcodeInput();
      return;
    }

    const remaining = getRemainingQuantity(line.quantity, line.receivedQuantity);
    if (remaining <= 0) {
      setError(null);
      setScanFeedback(`Artikel ${line.item?.code || code} ist bereits vollständig geliefert.`);
      setScanCandidate(null);
      setBarcodeInput("");
      focusBarcodeInput();
      return;
    }

    setError(null);
    setScanFeedback(
      `Scan erkannt: ${line.item?.code || code} | Bestellt ${line.quantity ?? 0}, bereits ${
        line.receivedQuantity ?? 0
      }, offen ${remaining}.`,
    );
    setScanCandidate({
      lineId: line.id,
      code: line.item?.code || code,
      description: line.item?.description || "-",
      ordered: line.quantity ?? 0,
      alreadyReceived: line.receivedQuantity ?? 0,
      remaining,
      suggestedQuantity: remaining,
    });
    setBarcodeInput("");
    focusBarcodeInput();
  };

  const handleApplyScanCandidate = () => {
    if (!scanCandidate) return;
    const bookedQty = Math.max(0, Math.min(scanCandidate.remaining, Math.round(scanCandidate.suggestedQuantity)));
    if (bookedQty <= 0) {
      setError("Bitte eine gültige Menge für den gescannten Artikel eingeben.");
      return;
    }

    setReceivedQuantities((prev) => ({
      ...prev,
      [scanCandidate.lineId]: bookedQty,
    }));
    setError(null);
    setScanFeedback(`${scanCandidate.code}: ${bookedQty} Stk. für den Wareneingang vorgemerkt.`);
    setScanCandidate(null);
    setBarcodeInput("");
    focusBarcodeInput();
  };

  const handleReceiveOrder = async (skipNoteCheck = false) => {
    if (!selectedOrder) return;

    if (!skipNoteCheck && !deliveryNoteNumber.trim()) {
      setConfirmWithoutNoteOpen(true);
      return;
    }

    setReceiving(true);
    setError(null);
    try {
      const lines = selectedOrder.lines
        .map((line) => ({
          lineId: line.id,
          receivedQuantity: Math.max(
            0,
            Math.min(
              getRemainingQuantity(line.quantity, line.receivedQuantity),
              receivedQuantities[line.id] ?? 0,
            ),
          ),
        }))
        .filter((line) => line.receivedQuantity > 0);

      if (lines.length === 0) {
        setError("Bitte mindestens eine Menge für den Wareneingang angeben.");
        setReceiving(false);
        return;
      }

      const updated = await receivePurchaseOrder(selectedOrder.id, {
        lines,
        deliveryNoteNumber: deliveryNoteNumber.trim() || undefined,
      });
      const allReceived = updated.lines.every(
        (line) => getRemainingQuantity(line.quantity, line.receivedQuantity) <= 0,
      );
      setSuccess(
        allReceived
          ? `Wareneingang für Bestellung ${updated.orderNumber || updated.id} vollständig gebucht.`
          : `Wareneingang als Teillieferung gebucht. Bestellung ${updated.orderNumber || updated.id} bleibt offen.`,
      );
      handleCloseReceiptDialog();
      await loadOrders();
    } catch (err: any) {
      setError(`Fehler beim Wareneingang: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setReceiving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "320px" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, backgroundColor: alpha(theme.palette.background.paper, 0.88) }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Wareneingang ({filteredOrders.length})
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Lieferant</InputLabel>
              <Select
                value={supplierFilter}
                label="Lieferant"
                onChange={(event) => setSupplierFilter(event.target.value)}
              >
                <MenuItem value="ALL">Alle Lieferanten</MenuItem>
                {supplierOptions.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Jahr</InputLabel>
              <Select value={yearFilter} label="Jahr" onChange={(event) => setYearFilter(event.target.value)}>
                <MenuItem value="ALL">Alle</MenuItem>
                {yearOptions.map((year) => (
                  <MenuItem key={year} value={String(year)}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadOrders}>
              Aktualisieren
            </Button>
          </Box>
        </Box>
      </Paper>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent>
            <Typography sx={{ textAlign: "center", py: 2 }}>
              Keine offenen Bestellungen für Wareneingang vorhanden.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filteredOrders.map((order) => {
            const totalRemaining = order.lines.reduce(
              (sum, line) => sum + getRemainingQuantity(line.quantity, line.receivedQuantity),
              0,
            );
            const deliveryState = getOrderDeliveryState(order);
            const deliveryMeta = deliveryMetaMap[deliveryState];

            return (
              <Card key={order.id} sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {order.orderNumber || order.id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.supplier?.name || "-"} | Jahr {getOrderYear(order)}
                        {order.deliveryNoteNumber && ` | LS: ${order.deliveryNoteNumber}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Chip label={getStatusLabel(order.status)} color={getStatusColor(order.status)} size="small" />
                      <Chip label={deliveryMeta.label} color={deliveryMeta.color} size="small" variant="outlined" />
                      <Chip
                        label={`${totalRemaining} offen`}
                        color={totalRemaining > 0 ? "warning" : "success"}
                        variant="outlined"
                        size="small"
                      />
                      <Button variant="contained" size="small" onClick={() => handleOpenReceiptDialog(order)}>
                        Eingang
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseReceiptDialog} maxWidth="lg" fullWidth>
        <DialogTitle>Wareneingang - Bestellung {selectedOrder?.orderNumber || selectedOrder?.id}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Ablauf: Artikel scannen, Vorschlagsmenge prüfen, mit "OK übernehmen" bestätigen und am Ende Wareneingang buchen.
          </Alert>

          <TextField
            label="Lieferschein-Nr. (optional)"
            value={deliveryNoteNumber}
            onChange={(event) => setDeliveryNoteNumber(event.target.value)}
            size="small"
            inputProps={{ maxLength: 128 }}
            sx={{ mb: 2, width: { xs: "100%", sm: 320 } }}
            autoComplete="off"
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Barcode / Artikelnummer (Handscanner)"
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              inputRef={barcodeInputRef}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleBarcodeScan();
                }
              }}
              size="small"
              autoComplete="off"
            />
            <Button variant="outlined" onClick={() => handleBarcodeScan()}>
              Code prüfen
            </Button>
            <Button variant="outlined" onClick={handleFillRemaining}>
              Rest für alle
            </Button>
          </Stack>

          {scanFeedback && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setScanFeedback(null)}>
              {scanFeedback}
            </Alert>
          )}

          {scanCandidate && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Scan-Treffer: {scanCandidate.code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {scanCandidate.description}
                  </Typography>
                </Box>
                <Chip size="small" label={`Bestellt ${scanCandidate.ordered}`} />
                <Chip size="small" label={`Bereits ${scanCandidate.alreadyReceived}`} />
                <Chip size="small" label={`Offen ${scanCandidate.remaining}`} color="warning" />
                <TextField
                  size="small"
                  type="number"
                  label="Menge"
                  value={scanCandidate.suggestedQuantity}
                  inputProps={{ min: 0, max: scanCandidate.remaining }}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    const nextValue = Number.isNaN(parsed) ? 0 : parsed;
                    setScanCandidate((prev) =>
                      !prev
                        ? prev
                        : {
                            ...prev,
                            suggestedQuantity: Math.max(0, Math.min(prev.remaining, nextValue)),
                          },
                    );
                  }}
                  sx={{ width: 120 }}
                />
                <Button variant="contained" onClick={handleApplyScanCandidate}>
                  OK übernehmen
                </Button>
              </Stack>
            </Paper>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
            <Chip label={`Bestellt: ${receiptSummary.ordered}`} size="small" />
            <Chip label={`Bereits da: ${receiptSummary.alreadyReceived}`} size="small" />
            <Chip label={`Jetzt: ${receiptSummary.plannedNow}`} size="small" color="info" />
            <Chip
              label={`Nach Buchung offen: ${receiptSummary.remainingAfterBooking}`}
              size="small"
              color={receiptSummary.remainingAfterBooking > 0 ? "warning" : "success"}
            />
            <Chip
              label={deliveryMetaMap[receiptSummary.deliveryStateAfterBooking].label}
              size="small"
              color={deliveryMetaMap[receiptSummary.deliveryStateAfterBooking].color}
              variant="outlined"
            />
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Artikelnummer</TableCell>
                  <TableCell>Beschreibung</TableCell>
                  <TableCell align="right">Bestellt</TableCell>
                  <TableCell align="right">Bereits eingegangen</TableCell>
                  <TableCell align="right">Offen</TableCell>
                  <TableCell>Status nach Buchung</TableCell>
                  <TableCell align="right">Jetzt eingehend</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedOrder?.lines.map((line) => {
                  const remaining = getRemainingQuantity(line.quantity, line.receivedQuantity);
                  const value = Math.max(0, Math.min(remaining, receivedQuantities[line.id] || 0));
                  const lineState = getLineDeliveryState(line, value);
                  const lineMeta = deliveryMetaMap[lineState];
                  const highlighted = scanCandidate?.lineId === line.id;

                  return (
                    <TableRow
                      key={line.id}
                      onDoubleClick={() => { if (line.item?.id) setItemDialogId(line.item.id); }}
                      sx={{
                        cursor: "pointer",
                        backgroundColor: highlighted
                          ? alpha(theme.palette.primary.main, 0.1)
                          : undefined,
                      }}
                    >
                      <TableCell>{line.item?.code || "-"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{line.item?.description || "-"}</Typography>
                        {line.item?.descriptionSecondary && (
                          <Typography variant="body2" color="text.secondary">{line.item.descriptionSecondary}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{line.quantity ?? 0}</TableCell>
                      <TableCell align="right">{line.receivedQuantity ?? 0}</TableCell>
                      <TableCell align="right">{remaining}</TableCell>
                      <TableCell>
                        <Chip size="small" label={lineMeta.label} color={lineMeta.color} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={value}
                          inputProps={{ min: 0, max: remaining }}
                          onFocus={(e) => e.target.select()}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            handleQuantityChange(line.id, Number.isNaN(parsed) ? 0 : parsed, remaining);
                          }}
                          sx={{ width: 110 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReceiptDialog}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleReceiveOrder}
            disabled={receiving || !hasPlannedReceipt}
            startIcon={receiving ? <CircularProgress size={18} /> : <CheckIcon />}
          >
            {receiving ? "Verarbeite..." : "Wareneingang buchen"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmWithoutNoteOpen} onClose={() => setConfirmWithoutNoteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Keine Lieferscheinnummer</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Es wurde keine Lieferscheinnummer eingegeben. Du kannst sie hier noch nachtragen oder ohne buchen.
          </Typography>
          <TextField
            label="Lieferschein-Nr."
            value={deliveryNoteNumber}
            onChange={(e) => setDeliveryNoteNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && deliveryNoteNumber.trim()) {
                setConfirmWithoutNoteOpen(false);
                void handleReceiveOrder(true);
              }
            }}
            size="small"
            fullWidth
            autoFocus
            inputProps={{ maxLength: 128 }}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmWithoutNoteOpen(false)}>Zurück</Button>
          <Button
            onClick={() => {
              setConfirmWithoutNoteOpen(false);
              void handleReceiveOrder(true);
            }}
          >
            Ohne Nummer buchen
          </Button>
          <Button
            variant="contained"
            disabled={!deliveryNoteNumber.trim()}
            onClick={() => {
              setConfirmWithoutNoteOpen(false);
              void handleReceiveOrder(true);
            }}
          >
            Buchen
          </Button>
        </DialogActions>
      </Dialog>

      <ItemEditDialog itemId={itemDialogId} open={!!itemDialogId} onClose={() => setItemDialogId(null)} />
    </Box>
  );
};

export default GoodsReceiptTab;

