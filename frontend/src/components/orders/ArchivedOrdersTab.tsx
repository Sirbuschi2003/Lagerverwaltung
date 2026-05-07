import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  deletePurchaseOrder,
  fetchPurchaseOrderPdf,
  fetchPurchaseOrders,
  type PurchaseOrderDto,
  updatePurchaseOrder,
} from "../../utils/api";
import useAuthStore from "../../store/useAuthStore";

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

interface GroupedOrders {
  year: number;
  orders: PurchaseOrderDto[];
}

const ArchivedOrdersTab: React.FC = () => {
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
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const loadArchivedOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders({ status: "ARCHIVED" });
      setOrders(data);
    } catch {
      setError("Archivierte Bestellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArchivedOrders();
  }, []);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      if (order.supplier?.id) {
        map.set(order.supplier.id, order.supplier.name || "Unbekannt");
      }
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

  const groupedByYear: GroupedOrders[] = useMemo(() => {
    const groups = new Map<number, PurchaseOrderDto[]>();

    filteredOrders.forEach((order) => {
      const year = getOrderYear(order);
      if (!groups.has(year)) {
        groups.set(year, []);
      }
      groups.get(year)?.push(order);
    });

    return [...groups.entries()]
      .map(([year, yearOrders]) => ({ year, orders: yearOrders }))
      .sort((a, b) => b.year - a.year);
  }, [filteredOrders]);

  const handleDelete = async (order: PurchaseOrderDto) => {
    if (!window.confirm(`Bestellung ${order.orderNumber || order.id} wirklich endgültig löschen? Das PDF bleibt auf dem Server erhalten.`)) return;
    try {
      await deletePurchaseOrder(order.id);
      setSuccessMessage("Bestellung gelöscht.");
      await loadArchivedOrders();
    } catch (err: any) {
      alert(`Fehler beim Löschen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  const handleUnarchive = async (order: PurchaseOrderDto) => {
    if (!window.confirm("Bestellung wirklich aus Archiv wiederherstellen?")) return;
    try {
      await updatePurchaseOrder(order.id, { status: "RECEIVED" });
      setSuccessMessage("Bestellung wiederhergestellt.");
      await loadArchivedOrders();
    } catch (err: any) {
      alert(`Fehler beim Wiederherstellen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  const handleDownloadPdf = async (order: PurchaseOrderDto) => {
    try {
      const blob = await fetchPurchaseOrderPdf(order.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(order.orderNumber || order.id).replace(/[^a-zA-Z0-9_.-]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF-Download fehlgeschlagen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    }
  };

  const handleViewPdf = async (order: PurchaseOrderDto) => {
    try {
      const blob = await fetchPurchaseOrderPdf(order.id);
      const url = window.URL.createObjectURL(blob);
      const tab = window.open(url, "_blank");
      // Blob-URL freigeben sobald der neue Tab geladen ist
      if (tab) tab.addEventListener("load", () => window.URL.revokeObjectURL(url), { once: true });
      else window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF konnte nicht geöffnet werden: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
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
            Archivierte Bestellungen ({filteredOrders.length})
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

            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadArchivedOrders}>
              Aktualisieren
            </Button>
          </Box>
        </Box>
      </Paper>

      {groupedByYear.length === 0 ? (
        <Alert severity="info">Keine archivierten Bestellungen vorhanden.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {groupedByYear.map(({ year, orders: yearOrders }) => (
            <Accordion
              key={year}
              expanded={expandedYear === year}
              onChange={() => setExpandedYear(expandedYear === year ? null : year)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{year}</Typography>
                  <Chip label={`${yearOrders.length} Bestellung(en)`} size="small" color="primary" variant="outlined" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bestellnummer</TableCell>
                        <TableCell>Lieferant</TableCell>
                        {isSuperAdmin && <TableCell>Niederlassung</TableCell>}
                        <TableCell>Artikel</TableCell>
                        <TableCell>Erstellt</TableCell>
                        <TableCell>Bestellt</TableCell>
                        <TableCell>Empfangen</TableCell>
                        <TableCell align="right">Aktionen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {yearOrders.map((order) => (
                        <TableRow key={order.id}>
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
                          <TableCell>{order.lines.length} Artikel</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>{formatDate(order.orderedAt)}</TableCell>
                          <TableCell>{formatDate(order.receivedAt)}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <Tooltip title="PDF im Browser anzeigen">
                                <IconButton size="small" onClick={() => handleViewPdf(order)}>
                                  <OpenInNewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="PDF herunterladen">
                                <IconButton size="small" onClick={() => handleDownloadPdf(order)}>
                                  <PictureAsPdfIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {canEdit && (
                                <Tooltip title="Wiederherstellen">
                                  <IconButton size="small" color="primary" onClick={() => handleUnarchive(order)}>
                                    <UnarchiveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip title="Endgültig löschen">
                                  <IconButton size="small" color="error" onClick={() => handleDelete(order)}>
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
                </Paper>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ArchivedOrdersTab;

