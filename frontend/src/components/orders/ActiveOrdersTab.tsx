import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArchiveIcon from "@mui/icons-material/Archive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import useAuthStore from "../../store/useAuthStore";
import {
  deletePurchaseOrder,
  fetchPurchaseOrderPdf,
  fetchPurchaseOrders,
  receivePurchaseOrder,
  type PurchaseOrderDto,
  type PurchaseOrderStatus,
  updatePurchaseOrder,
} from "../../utils/api";

const statusMeta: Record<
  PurchaseOrderStatus,
  { label: string; color: "default" | "info" | "success" | "warning" | "error" }
> = {
  DRAFT: { label: "Entwurf", color: "default" },
  ORDERED: { label: "Bestellt", color: "info" },
  RECEIVED: { label: "Eingegangen", color: "success" },
  CANCELLED: { label: "Storniert", color: "error" },
  ARCHIVED: { label: "Archiviert", color: "warning" },
};

type SortOption = "newest" | "oldest" | "supplierAsc" | "supplierDesc";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("de-DE");
};

const getOrderYear = (order: PurchaseOrderDto) => {
  const reference = order.orderedAt || order.createdAt;
  const parsed = new Date(reference);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

const ActiveOrdersTab: React.FC = () => {
  const theme = useTheme();
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const user = useAuthStore((state: any) => state.user);
  const isSuperAdmin = user?.branchId === null || user?.branchId === undefined;
  const canEdit = hasPermission("orders.edit");
  const canDelete = hasPermission("orders.delete");
  const canReceive = hasPermission("orders.receive");

  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | PurchaseOrderStatus>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PurchaseOrderDto | null>(null);
  const [orderForm, setOrderForm] = useState({
    status: "DRAFT" as PurchaseOrderStatus,
    orderNumber: "",
    note: "",
  });
  const [updating, setUpdating] = useState(false);

  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderDto | null>(null);

  const loadOrders = async (status?: PurchaseOrderStatus) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders(status ? { status } : undefined);
      setOrders(data.filter((order) => order.status !== "ARCHIVED"));
    } catch {
      setError("Bestellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders(statusFilter === "ALL" ? undefined : statusFilter);
  }, [statusFilter]);

  const supplierOptions = useMemo(() => {
    const supplierMap = new Map<string, string>();
    orders.forEach((order) => {
      if (order.supplier?.id) {
        supplierMap.set(order.supplier.id, order.supplier.name || "Unbekannt");
      }
    });
    return [...supplierMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [orders]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    orders.forEach((order) => {
      years.add(getOrderYear(order));
    });
    return [...years].sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      if (supplierFilter !== "ALL" && order.supplier?.id !== supplierFilter) return false;
      if (yearFilter !== "ALL" && getOrderYear(order) !== Number.parseInt(yearFilter, 10)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      const supplierA = a.supplier?.name || "";
      const supplierB = b.supplier?.name || "";

      switch (sortOption) {
        case "oldest":
          return dateA - dateB;
        case "supplierAsc":
          return supplierA.localeCompare(supplierB, "de", { sensitivity: "base" }) || dateB - dateA;
        case "supplierDesc":
          return supplierB.localeCompare(supplierA, "de", { sensitivity: "base" }) || dateB - dateA;
        case "newest":
        default:
          return dateB - dateA;
      }
    });
  }, [orders, supplierFilter, yearFilter, sortOption]);

  const handleEditOpen = (order: PurchaseOrderDto) => {
    setActiveOrder(order);
    setOrderForm({
      status: order.status,
      orderNumber: order.orderNumber || "",
      note: order.note || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!activeOrder) return;
    setUpdating(true);
    try {
      await updatePurchaseOrder(activeOrder.id, orderForm);
      setSuccessMessage("Bestellung aktualisiert.");
      setEditDialogOpen(false);
      await loadOrders(statusFilter === "ALL" ? undefined : statusFilter);
    } catch (err: any) {
      alert(`Fehler beim Aktualisieren: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleReceiveOpen = (order: PurchaseOrderDto) => {
    setActiveOrder(order);
    const quantities: Record<string, number> = {};
    order.lines.forEach((line) => {
      const remaining = Math.max(0, line.quantity - (line.receivedQuantity || 0));
      quantities[line.id] = remaining;
    });
    setReceiveQuantities(quantities);
    setReceiveDialogOpen(true);
  };

  const handleReceive = async () => {
    if (!activeOrder) return;
    setReceiving(true);
    try {
      const lines = Object.entries(receiveQuantities).map(([lineId, receivedQuantity]) => ({
        lineId,
        receivedQuantity,
      }));
      await receivePurchaseOrder(activeOrder.id, { lines });
      setSuccessMessage("Wareneingang erfolgreich gebucht.");
      setReceiveDialogOpen(false);
      await loadOrders(statusFilter === "ALL" ? undefined : statusFilter);
    } catch (err: any) {
      alert(`Fehler beim Wareneingang: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setReceiving(false);
    }
  };

  const handleDownloadPdf = async (order: PurchaseOrderDto) => {
    try {
      const blob = await fetchPurchaseOrderPdf(order.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Bestellung_${order.supplier?.name || "Lieferant"}_${order.orderNumber || order.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF-Download fehlgeschlagen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  const handleArchive = async (order: PurchaseOrderDto) => {
    if (!window.confirm("Bestellung wirklich archivieren?")) return;
    try {
      await updatePurchaseOrder(order.id, { status: "ARCHIVED" });
      setSuccessMessage("Bestellung archiviert.");
      await loadOrders(statusFilter === "ALL" ? undefined : statusFilter);
    } catch (err: any) {
      alert(`Fehler beim Archivieren: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePurchaseOrder(deleteTarget.id);
      setSuccessMessage("Bestellung gelöscht.");
      setDeleteTarget(null);
      await loadOrders(statusFilter === "ALL" ? undefined : statusFilter);
    } catch (err: any) {
      alert(`Fehler beim Löschen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          mb: 2,
          p: 2,
          backgroundColor: alpha(theme.palette.background.paper, 0.88),
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Offene Bestellungen ({filteredOrders.length})
          </Typography>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 145 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | PurchaseOrderStatus)}
              >
                <MenuItem value="ALL">Alle</MenuItem>
                <MenuItem value="DRAFT">Entwurf</MenuItem>
                <MenuItem value="ORDERED">Bestellt</MenuItem>
                <MenuItem value="RECEIVED">Eingegangen</MenuItem>
                <MenuItem value="CANCELLED">Storniert</MenuItem>
              </Select>
            </FormControl>

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

            <FormControl size="small" sx={{ minWidth: 165 }}>
              <InputLabel>Sortierung</InputLabel>
              <Select
                value={sortOption}
                label="Sortierung"
                onChange={(event) => setSortOption(event.target.value as SortOption)}
              >
                <MenuItem value="newest">Neueste zuerst</MenuItem>
                <MenuItem value="oldest">Älteste zuerst</MenuItem>
                <MenuItem value="supplierAsc">Lieferant A-Z</MenuItem>
                <MenuItem value="supplierDesc">Lieferant Z-A</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadOrders(statusFilter === "ALL" ? undefined : statusFilter)}
            >
              Aktualisieren
            </Button>
          </Box>
        </Box>
      </Paper>

      {filteredOrders.length === 0 ? (
        <Alert severity="info">Keine Bestellungen mit den aktuellen Filtern vorhanden.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bestellnummer</TableCell>
                <TableCell>Lieferant</TableCell>
                {isSuperAdmin && <TableCell>Niederlassung</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Jahr</TableCell>
                <TableCell>Artikel</TableCell>
                <TableCell>Erstellt</TableCell>
                <TableCell>Bestellt</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {order.orderNumber || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>{order.supplier?.name || "-"}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <Chip
                        label={order.branch?.name || order.branch?.externalCode || "–"}
                        size="small"
                        variant="outlined"
                        color="secondary"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip label={statusMeta[order.status].label} color={statusMeta[order.status].color} size="small" />
                  </TableCell>
                  <TableCell>{getOrderYear(order)}</TableCell>
                  <TableCell>{order.lines.length} Artikel</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>{formatDate(order.orderedAt)}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                      {canEdit && (
                        <Tooltip title="Bearbeiten">
                          <IconButton size="small" onClick={() => handleEditOpen(order)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canReceive && order.status === "ORDERED" && (
                        <Tooltip title="Wareneingang buchen">
                          <IconButton size="small" color="success" onClick={() => handleReceiveOpen(order)}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="PDF herunterladen">
                        <IconButton size="small" onClick={() => handleDownloadPdf(order)}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canEdit && order.status === "RECEIVED" && (
                        <Tooltip title="Archivieren">
                          <IconButton size="small" onClick={() => handleArchive(order)}>
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Löschen">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(order)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bestellung bearbeiten</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Bestellnummer"
              value={orderForm.orderNumber}
              onChange={(event) => setOrderForm({ ...orderForm, orderNumber: event.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={orderForm.status}
                label="Status"
                onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value as PurchaseOrderStatus })}
              >
                <MenuItem value="DRAFT">Entwurf</MenuItem>
                <MenuItem value="ORDERED">Bestellt</MenuItem>
                <MenuItem value="RECEIVED">Eingegangen</MenuItem>
                <MenuItem value="CANCELLED">Storniert</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notiz"
              value={orderForm.note}
              onChange={(event) => setOrderForm({ ...orderForm, note: event.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={updating}>
            {updating ? "Speichere..." : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={receiveDialogOpen} onClose={() => setReceiveDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Wareneingang buchen</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tragen Sie die tatsächlich eingegangene Menge ein. Teillieferungen sind möglich.
          </Alert>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Artikel</TableCell>
                <TableCell align="right">Bestellt</TableCell>
                <TableCell align="right">Bereits empfangen</TableCell>
                <TableCell align="right">Noch offen</TableCell>
                <TableCell align="right">Jetzt empfangen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeOrder?.lines.map((line) => {
                const ordered = line.quantity;
                const alreadyReceived = line.receivedQuantity || 0;
                const remaining = Math.max(0, ordered - alreadyReceived);
                const currentReceiving = receiveQuantities[line.id] || 0;

                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{line.item.code} – {line.item.description}</Typography>
                      {line.item.descriptionSecondary && (
                        <Typography variant="body2" color="text.secondary">{line.item.descriptionSecondary}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{ordered}</TableCell>
                    <TableCell align="right">{alreadyReceived}</TableCell>
                    <TableCell align="right">{remaining}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={currentReceiving}
                        onChange={(event) => {
                          const value = Math.max(0, Math.min(remaining, Number.parseInt(event.target.value, 10) || 0));
                          setReceiveQuantities({
                            ...receiveQuantities,
                            [line.id]: value,
                          });
                        }}
                        inputProps={{ min: 0, max: remaining }}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiveDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={handleReceive}
            variant="contained"
            disabled={receiving || Object.values(receiveQuantities).every((value) => value === 0)}
          >
            {receiving ? "Buche..." : "Wareneingang buchen"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Bestellung löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie die Bestellung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveOrdersTab;

