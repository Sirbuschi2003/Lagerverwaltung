import React, { useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArchiveIcon from "@mui/icons-material/Archive";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import useAuthStore from "../../store/useAuthStore";
import ItemEditDialog from "../items/ItemEditDialog";
import {
  deletePurchaseOrder,
  fetchItems,
  fetchPurchaseOrderPdf,
  fetchPurchaseOrders,
  addPurchaseOrderLine,
  updatePurchaseOrderLine,
  deletePurchaseOrderLine,
  reorderPurchaseOrderLines,
  type ItemDto,
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

interface SortableLineRowProps {
  line: PurchaseOrderDto["lines"][number];
  isDraft: boolean;
  qty: number;
  lineActionLoading: boolean;
  linesCount: number;
  onQtyChange: (id: string, qty: number) => void;
  onBlur: (id: string) => void;
  onRemove: (id: string) => void;
}

const SortableLineRow: React.FC<SortableLineRowProps> = ({ line, isDraft, qty, lineActionLoading, linesCount, onQtyChange, onBlur, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
  return (
    <TableRow ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      {isDraft && (
        <TableCell sx={{ width: 28, px: 0.5, cursor: "grab", color: "text.disabled" }} {...attributes} {...listeners}>
          <DragIndicatorIcon fontSize="small" />
        </TableCell>
      )}
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{line.item.code}</Typography>
        <Typography variant="caption" color="text.secondary">{line.item.description}</Typography>
      </TableCell>
      <TableCell align="right">
        {isDraft ? (
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => onQtyChange(line.id, Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            onBlur={() => onBlur(line.id)}
            onFocus={(e) => e.target.select()}
            inputProps={{ min: 1 }}
            sx={{ width: 80 }}
            disabled={lineActionLoading}
          />
        ) : (
          line.quantity
        )}
      </TableCell>
      {isDraft && (
        <TableCell>
          <Tooltip title="Position entfernen">
            <span>
              <IconButton size="small" color="error" disabled={lineActionLoading || linesCount <= 1} onClick={() => onRemove(line.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      )}
    </TableRow>
  );
};

const ActiveOrdersTab: React.FC = () => {
  const theme = useTheme();
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const user = useAuthStore((state: any) => state.user);
  const isSuperAdmin = user?.branchId === null || user?.branchId === undefined;
  const canEdit = hasPermission("orders.edit");
  const canDelete = hasPermission("orders.delete");

  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | PurchaseOrderStatus>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PurchaseOrderDto | null>(null);
  const [orderForm, setOrderForm] = useState({
    status: "DRAFT" as PurchaseOrderStatus,
    orderNumber: "",
    note: "",
  });
  const [updating, setUpdating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderDto | null>(null);
  const [itemDialogId, setItemDialogId] = useState<string | null>(null);

  // Positions-Verwaltung im Edit-Dialog
  const [lineQtyMap, setLineQtyMap] = useState<Record<string, number>>({});
  const [lineActionLoading, setLineActionLoading] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemOptions, setAddItemOptions] = useState<ItemDto[]>([]);
  const [addItem, setAddItem] = useState<ItemDto | null>(null);
  const [addQty, setAddQty] = useState(1);

  const loadOrders = async (status?: PurchaseOrderStatus, signal?: { aborted: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const { orders } = await fetchPurchaseOrders(status ? { status } : undefined);
      if (signal?.aborted) return;
      setOrders(orders.filter((order) => order.status !== "ARCHIVED"));
    } catch {
      if (signal?.aborted) return;
      setError("Bestellungen konnten nicht geladen werden.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const signal = { aborted: false };
    setSupplierFilter("ALL");
    setYearFilter("ALL");
    void loadOrders(statusFilter === "ALL" ? undefined : statusFilter, signal);
    return () => { signal.aborted = true; };
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
    const qtys: Record<string, number> = {};
    order.lines.forEach((l) => { qtys[l.id] = l.quantity; });
    setLineQtyMap(qtys);
    setAddItem(null);
    setAddQty(1);
    setAddItemSearch("");
    setAddItemOptions([]);
    setEditDialogOpen(true);
  };

  useEffect(() => {
    if (!addItemSearch || addItemSearch.length < 2) {
      setAddItemOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await fetchItems({ search: addItemSearch, limit: 15 });
        setAddItemOptions(result.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [addItemSearch]);

  const handleUpdateLine = async (lineId: string) => {
    if (!activeOrder || !canEdit) return;
    const qty = lineQtyMap[lineId];
    if (!qty || qty < 1) return;
    const original = activeOrder.lines.find((l) => l.id === lineId)?.quantity;
    if (qty === original) return;
    setLineActionLoading(true);
    try {
      const updated = await updatePurchaseOrderLine(activeOrder.id, lineId, { quantity: qty });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setActiveOrder(updated);
    } catch (err: any) {
      alert(`Fehler: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setLineActionLoading(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!activeOrder || !canEdit) return;
    setLineActionLoading(true);
    try {
      const updated = await deletePurchaseOrderLine(activeOrder.id, lineId);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setActiveOrder(updated);
      setLineQtyMap((prev) => { const next = { ...prev }; delete next[lineId]; return next; });
    } catch (err: any) {
      alert(`Fehler: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setLineActionLoading(false);
    }
  };

  const handleAddLine = async () => {
    if (!activeOrder || !addItem || addQty < 1 || !canEdit) return;
    setLineActionLoading(true);
    try {
      const updated = await addPurchaseOrderLine(activeOrder.id, { itemId: addItem.id, quantity: addQty });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setActiveOrder(updated);
      const qtys: Record<string, number> = {};
      updated.lines.forEach((l) => { qtys[l.id] = l.quantity; });
      setLineQtyMap(qtys);
      setAddItem(null);
      setAddQty(1);
      setAddItemSearch("");
    } catch (err: any) {
      alert(`Fehler: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setLineActionLoading(false);
    }
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeOrder || !canEdit) return;
    const oldIndex = activeOrder.lines.findIndex((l) => l.id === active.id);
    const newIndex = activeOrder.lines.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeOrder.lines, oldIndex, newIndex);
    // Optimistic update
    setActiveOrder({ ...activeOrder, lines: reordered });
    setOrders((prev) => prev.map((o) => (o.id === activeOrder.id ? { ...o, lines: reordered } : o)));
    try {
      const updated = await reorderPurchaseOrderLines(activeOrder.id, reordered.map((l) => l.id));
      setActiveOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err: any) {
      // Revert on error
      setActiveOrder(activeOrder);
      setOrders((prev) => prev.map((o) => (o.id === activeOrder.id ? activeOrder : o)));
      alert(`Reihenfolge konnte nicht gespeichert werden: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
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

  const handleDownloadPdf = async (order: PurchaseOrderDto) => {
    try {
      const blob = await fetchPurchaseOrderPdf(order.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(order.orderNumber || order.id).replace(/[^a-zA-Z0-9_.-]/g, "_")}.pdf`;
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
                <TableCell sx={{ width: 40 }} />
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
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const colSpan = isSuperAdmin ? 10 : 9;
                return (
                  <React.Fragment key={order.id}>
                    <TableRow
                      hover
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ py: 0.5 }}>
                        <IconButton size="small" tabIndex={-1}>
                          {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
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
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                          {canEdit && (
                            <Tooltip title="Bearbeiten">
                              <IconButton size="small" onClick={() => handleEditOpen(order)}>
                                <EditIcon fontSize="small" />
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
                    <TableRow>
                      <TableCell colSpan={colSpan} sx={{ py: 0, border: isExpanded ? undefined : "none" }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1.5, px: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>Artikel</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>Bestellt</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>Geliefert</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {order.lines.map((line) => {
                                  const received = line.receivedQuantity ?? 0;
                                  const isFullyDelivered = received >= line.quantity;
                                  const isPartial = received > 0 && received < line.quantity;
                                  return (
                                    <TableRow key={line.id}>
                                      <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{line.item.code}</Typography>
                                        <Typography variant="caption" color="text.secondary">{line.item.description}</Typography>
                                      </TableCell>
                                      <TableCell align="right">{line.quantity}</TableCell>
                                      <TableCell align="right">{received}</TableCell>
                                      <TableCell>
                                        {isFullyDelivered ? (
                                          <Chip label="Geliefert" color="success" size="small" />
                                        ) : isPartial ? (
                                          <Chip label={`Teilgeliefert (${received}/${line.quantity})`} color="warning" size="small" />
                                        ) : (
                                          <Chip label="Ausstehend" color="error" size="small" />
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
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
              rows={2}
              fullWidth
            />

            {/* Positionen – nur bei DRAFT bearbeitbar */}
            {activeOrder && (
              <>
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Positionen ({activeOrder.lines.length})
                  {activeOrder.status !== "DRAFT" && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (nur bei Entwurf bearbeitbar)
                    </Typography>
                  )}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {activeOrder.status === "DRAFT" && <TableCell sx={{ width: 28, px: 0.5 }} />}
                      <TableCell>Artikel</TableCell>
                      <TableCell align="right">Menge</TableCell>
                      {activeOrder.status === "DRAFT" && <TableCell />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeOrder.status === "DRAFT" ? (
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
                        <SortableContext items={activeOrder.lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                          {activeOrder.lines.map((line) => (
                            <SortableLineRow
                              key={line.id}
                              line={line}
                              isDraft
                              qty={lineQtyMap[line.id] ?? line.quantity}
                              lineActionLoading={lineActionLoading}
                              linesCount={activeOrder.lines.length}
                              onQtyChange={(id, qty) => setLineQtyMap((prev) => ({ ...prev, [id]: qty }))}
                              onBlur={(id) => void handleUpdateLine(id)}
                              onRemove={(id) => void handleRemoveLine(id)}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      activeOrder.lines.map((line) => (
                        <SortableLineRow
                          key={line.id}
                          line={line}
                          isDraft={false}
                          qty={line.quantity}
                          lineActionLoading={false}
                          linesCount={activeOrder.lines.length}
                          onQtyChange={() => {}}
                          onBlur={() => {}}
                          onRemove={() => {}}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Artikel hinzufügen – nur bei DRAFT */}
                {activeOrder.status === "DRAFT" && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Autocomplete
                      options={addItemOptions}
                      value={addItem}
                      onChange={(_, val) => setAddItem(val)}
                      inputValue={addItemSearch}
                      onInputChange={(_, val) => setAddItemSearch(val)}
                      getOptionLabel={(o) => `${o.code} – ${o.description}`}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      filterOptions={(x) => x}
                      noOptionsText={addItemSearch.length < 2 ? "Mindestens 2 Zeichen eingeben" : "Kein Artikel gefunden"}
                      renderInput={(params) => (
                        <TextField {...params} label="Artikel hinzufügen" size="small" placeholder="Code oder Bezeichnung suchen…" />
                      )}
                      sx={{ flex: 1, minWidth: 220 }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Menge"
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ min: 1 }}
                      sx={{ width: 90 }}
                      disabled={lineActionLoading}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!addItem || lineActionLoading}
                      onClick={() => void handleAddLine()}
                      startIcon={lineActionLoading ? <CircularProgress size={14} /> : <AddIcon />}
                    >
                      Hinzufügen
                    </Button>
                  </Stack>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={updating}>
            {updating ? "Speichere..." : "Speichern"}
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

      <ItemEditDialog itemId={itemDialogId} open={!!itemDialogId} onClose={() => setItemDialogId(null)} />
    </Box>
  );
};

export default ActiveOrdersTab;

