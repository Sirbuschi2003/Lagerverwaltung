import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import useDashboardData from "../../store/useDashboardData";
import { BelowTargetItemDto, fetchBelowTargetItems } from "../../utils/api";

type SortField = "itemCode" | "itemDescription" | "locationLabel" | "quantity" | "targetQuantity" | "shortage";
type SortDir = "asc" | "desc";

const BelowTargetDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [items, setItems] = useState<BelowTargetItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("shortage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchBelowTargetItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [open]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "shortage" ? "desc" : "asc");
    }
  };

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.itemCode.toLowerCase().includes(q) ||
      item.itemDescription.toLowerCase().includes(q) ||
      item.locationLabel.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    const va = a[sortField];
    const vb = b[sortField];
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });

  const col = (field: SortField, label: string, align?: "right") => (
    <TableCell align={align} sx={{ whiteSpace: "nowrap" }}>
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDir : "asc"}
        onClick={() => handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <span>Artikel unter Sollbestand ({items.length})</span>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Suche nach Artikel, Beschreibung oder Ort…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {loading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} sx={{ mb: 0.5 }} />
            ))}
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {col("itemCode", "Artikelnr.")}
                  {col("itemDescription", "Bezeichnung")}
                  {col("locationLabel", "Ort")}
                  {col("quantity", "Bestand", "right")}
                  {col("targetQuantity", "Sollbestand", "right")}
                  {col("shortage", "Fehlmenge", "right")}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                      Keine Artikel gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((item) => (
                    <TableRow key={item.stockLevelId} hover>
                      <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{item.itemCode}</TableCell>
                      <TableCell>
                        <Tooltip title={item.itemDescription} enterDelay={400}>
                          <span style={{ display: "block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.itemDescription}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{item.locationLabel}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{item.targetQuantity}</TableCell>
                      <TableCell align="right" sx={{ color: "warning.main", fontWeight: 700 }}>
                        -{item.shortage}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
};

const DashboardKpiWidget: React.FC = () => {
  const { summary, loadSummary } = useDashboardData();
  const [loading, setLoading] = useState(false);
  const [belowTargetOpen, setBelowTargetOpen] = useState(false);

  useEffect(() => {
    if (!navigator.onLine) return;
    setLoading(true);
    void loadSummary().finally(() => setLoading(false));
  }, [loadSummary]);

  const tiles = [
    {
      label: "Artikel gesamt",
      value: summary.totalItems,
      icon: <InventoryIcon />,
      color: "primary.main",
      onClick: undefined,
    },
    {
      label: "Unter Sollbestand",
      value: summary.belowTarget,
      icon: <WarningAmberIcon />,
      color: summary.belowTarget > 0 ? "warning.main" : "success.main",
      onClick: () => setBelowTargetOpen(true),
    },
    {
      label: "Offene Inventuren",
      value: summary.openInventorySessions,
      icon: <AssignmentIcon />,
      color: summary.openInventorySessions > 0 ? "info.main" : "success.main",
      onClick: undefined,
    },
  ];

  return (
    <>
      <Grid container spacing={2}>
        {tiles.map((tile) => (
          <Grid item xs={12} sm={4} key={tile.label}>
            <Card sx={tile.onClick ? { cursor: "pointer" } : undefined}>
              {tile.onClick ? (
                <CardActionArea onClick={tile.onClick}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ color: tile.color }}>{tile.icon}</Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {loading ? <Skeleton width={40} /> : tile.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tile.label}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              ) : (
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ color: tile.color }}>{tile.icon}</Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {loading ? <Skeleton width={40} /> : tile.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tile.label}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      <BelowTargetDialog open={belowTargetOpen} onClose={() => setBelowTargetOpen(false)} />
    </>
  );
};

export default DashboardKpiWidget;
