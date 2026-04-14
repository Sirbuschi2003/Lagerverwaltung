import React, { useMemo } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Typography,
  Box,
  Avatar,
  IconButton,
  Collapse,
  useTheme,
} from "@mui/material";
import {
  Dashboard,
  Inventory,
  DirectionsCar,
  Assignment,
  Sync,
  Logout,
  Build,
  Warehouse,
  AdminPanelSettings,
  Close,
  CloudDownload,
  Analytics,
  ExpandLess,
  ExpandMore,
  Settings as SettingsIcon,
  TableChart,
  MarkEmailRead,
  Storefront,
  LocalShipping,
  Inventory2,
  QrCodeScanner,
  CorporateFare,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { getNavigationDrawerStyles } from "../styles/componentStyles";

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  width?: number;
}

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactElement;
  roles: string[];
  permissions?: string[];
  superAdminOnly?: boolean;
}

// Statische Menu-Definitionen ausserhalb der Komponente (werden nur einmal erstellt)
const MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: <Dashboard />, roles: ["MANAGER", "WAREHOUSE", "TECHNICIAN"], permissions: ["dashboard.view"] },
];

const INVENTORY_MENU_ITEMS: MenuItem[] = [
  { id: "quick-booking", label: "Schnellbuchung", path: "/quick-booking", icon: <QrCodeScanner />, roles: ["MANAGER", "WAREHOUSE"], permissions: ["quick-booking.use"] },
  { id: "suppliers", label: "Lieferanten", path: "/suppliers", icon: <Storefront />, roles: ["MANAGER", "WAREHOUSE"], permissions: ["suppliers.view"] },
  { id: "locations", label: "Lagerorte", path: "/locations", icon: <Inventory2 />, roles: ["MANAGER", "WAREHOUSE"], permissions: ["locations.view"] },
  { id: "items", label: "Artikel", path: "/items", icon: <Inventory />, roles: ["MANAGER", "WAREHOUSE", "TECHNICIAN"], permissions: ["items.view"] },
  { id: "orders", label: "Bestellungen", path: "/orders", icon: <LocalShipping />, roles: ["MANAGER", "WAREHOUSE"], permissions: ["orders.view"] },
  { id: "movements", label: "Bewegungen & Berichte", path: "/movements", icon: <TableChart />, roles: ["MANAGER"], permissions: ["movements.view"] },
];

const OTHER_MENU_ITEMS: MenuItem[] = [
  { id: "fleet-overview", label: "Fahrzeugbestaende", path: "/fleet", icon: <DirectionsCar />, roles: ["MANAGER", "WAREHOUSE"], permissions: ["fleet.view"] },
  { id: "inventory", label: "Inventur", path: "/inventory", icon: <Assignment />, roles: ["MANAGER", "TECHNICIAN"], permissions: ["inventory.view", "inventory.manage", "inventory.execute"] },
  { id: "my-vehicle", label: "Mein Fahrzeug", path: "/my-vehicle", icon: <Build />, roles: ["TECHNICIAN"], permissions: ["myvehicle.view"] },
  { id: "sync", label: "Synchronisierung", path: "/sync", icon: <Sync />, roles: ["MANAGER", "TECHNICIAN"], permissions: ["sync.use"] },
];

const SETTINGS_ITEMS: MenuItem[] = [
  { id: "settings-general", label: "Firmendaten", path: "/settings", icon: <SettingsIcon />, roles: ["MANAGER"], permissions: ["settings.company"] },
  { id: "settings-email", label: "E-Mail Einstellungen", path: "/settings/email", icon: <MarkEmailRead />, roles: ["MANAGER"], permissions: ["settings.email"] },
  { id: "settings-warehouse", label: "Lagereinstellungen", path: "/settings/warehouse", icon: <Warehouse />, roles: ["MANAGER"], permissions: ["settings.company"] },
  { id: "settings-backup", label: "Datensicherung", path: "/backup", icon: <CloudDownload />, roles: ["MANAGER"], permissions: ["backup.access"], superAdminOnly: true },
  { id: "settings-logs", label: "Systemprotokolle", path: "/logs", icon: <Analytics />, roles: ["MANAGER"], permissions: ["logs.view"] },
  { id: "settings-access", label: "Benutzer & Fahrzeuge", path: "/access-control", icon: <AdminPanelSettings />, roles: ["MANAGER"], permissions: ["access.manage"] },
  { id: "settings-branches", label: "Niederlassungen", path: "/branches", icon: <CorporateFare />, roles: ["MANAGER"], permissions: ["branches.manage"], superAdminOnly: true },
  { id: "settings-warehouses", label: "Lager", path: "/warehouses", icon: <Warehouse />, roles: ["MANAGER"], permissions: ["branches.manage"] },
  { id: "settings-maintenance", label: "Wartung & Update", path: "/settings/maintenance", icon: <Build />, roles: ["MANAGER"], permissions: ["settings.company"], superAdminOnly: true },
];

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ open, onClose, width = 280 }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const drawerStyles = getNavigationDrawerStyles(theme, width);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);

  if (!user) return null;

  // DESIGN-ENTSCHEIDUNG Berechtigungen:
  // Wenn 'permissions' definiert → Berechtigungs-Check (MANAGER hat via hasPermission() Vollzugriff).
  // Andernfalls Fallback auf Rollen-Check. Dies ist konsistentes Verhalten fuer alle Menu-Eintraege.
  const isSuperAdmin = user.role === "MANAGER" && user.branchId === null;

  const canAccess = (item: MenuItem) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permissions && item.permissions.length > 0) {
      return hasPermission(item.permissions);
    }
    return item.roles.includes(user.role);
  };

  // useMemo: Menu-Filterung nur neu berechnen wenn sich User/Permissions aendern
  const visibleMenuItems = useMemo(() => MENU_ITEMS.filter(canAccess), [user, hasPermission]);
  const visibleInventoryItems = useMemo(() => INVENTORY_MENU_ITEMS.filter(canAccess), [user, hasPermission]);
  const visibleOtherItems = useMemo(() => OTHER_MENU_ITEMS.filter(canAccess), [user, hasPermission]);
  const visibleSettingsItems = useMemo(() => SETTINGS_ITEMS.filter(canAccess), [user, hasPermission]);
  const hasSettingsSection = visibleSettingsItems.length > 0;
  const hasInventorySection = visibleInventoryItems.length > 0;
  const settingsActive = visibleSettingsItems.some((item) => location.pathname.startsWith(item.path));
  const inventoryActive = visibleInventoryItems.some((item) => location.pathname.startsWith(item.path));

  React.useEffect(() => {
    if (settingsActive) {
      setSettingsOpen(true);
    }
    if (inventoryActive) {
      setInventoryOpen(true);
    }
  }, [settingsActive, inventoryActive]);

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "MANAGER":
        return <AdminPanelSettings />;
      case "WAREHOUSE":
        return <Warehouse />;
      case "TECHNICIAN":
        return <Build />;
      default:
        return <Warehouse />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "MANAGER":
        return "Administrator";
      case "WAREHOUSE":
        return "Lager-Mitarbeiter";
      case "TECHNICIAN":
        return "Techniker";
      default:
        return role;
    }
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          ...drawerStyles.drawerPaper,
        },
      }}
    >
      <Box sx={{ width, display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={drawerStyles.topBar}>
          <Typography variant="h6" component="div" sx={{ fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 700 }}>
            Lagerverwaltung
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        <Box sx={drawerStyles.roleBanner}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "primary.dark" }}>{getRoleIcon(user.role)}</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                {user.username}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {getRoleLabel(user.role)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto" }}>
          <List>
            {visibleMenuItems.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => handleNavigation(item.path)}
                  sx={drawerStyles.selectedItem}
                >
                  <ListItemIcon sx={{ color: "text.secondary" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
            
            {/* Lagerverwaltungs-Untermenü: für Techniker flach, sonst eingeklappt */}
            {hasInventorySection && (
              user.role === "TECHNICIAN" ? (
                visibleInventoryItems.map((item) => {
                  const isSelected =
                    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                  return (
                    <ListItem key={item.id} disablePadding>
                      <ListItemButton
                        selected={isSelected}
                        onClick={() => handleNavigation(item.path)}
                        sx={drawerStyles.selectedItem}
                      >
                        <ListItemIcon sx={{ color: "text.secondary" }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    </ListItem>
                  );
                })
              ) : (
                <>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => setInventoryOpen((prev) => !prev)}
                      selected={inventoryActive}
                      sx={drawerStyles.selectedItem}
                    >
                      <ListItemIcon sx={{ color: "text.secondary" }}>
                        <Warehouse />
                      </ListItemIcon>
                      <ListItemText primary="Lagerverwaltung" />
                      {inventoryOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={inventoryOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {visibleInventoryItems.map((item) => {
                        const isSelected =
                          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                        return (
                          <ListItem key={item.id} disablePadding>
                            <ListItemButton
                              selected={isSelected}
                              onClick={() => handleNavigation(item.path)}
                              sx={{ ...drawerStyles.selectedItem, pl: 4 }}
                            >
                              <ListItemIcon sx={{ color: "text.secondary" }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText primary={item.label} />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </>
              )
            )}

            {/* Weitere Menüeinträge */}
            {visibleOtherItems.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => handleNavigation(item.path)}
                  sx={drawerStyles.selectedItem}
                >
                  <ListItemIcon sx={{ color: "text.secondary" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}

            {/* Einstellungs-Untermenü */}
            {hasSettingsSection && (
              <>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => setSettingsOpen((prev) => !prev)}
                    selected={settingsActive}
                    sx={drawerStyles.selectedItem}
                  >
                    <ListItemIcon sx={{ color: "text.secondary" }}>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Einstellungen" />
                    {settingsOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {visibleSettingsItems.map((item) => {
                      const isSelected =
                        location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                      return (
                        <ListItem key={item.id} disablePadding>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => handleNavigation(item.path)}
                            sx={{ ...drawerStyles.selectedItem, pl: 4 }}
                          >
                            <ListItemIcon sx={{ color: "text.secondary" }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.label} />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </>
            )}
          </List>
        </Box>

        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleLogout}
                sx={drawerStyles.logoutButton}
              >
                <ListItemIcon sx={{ color: "error.main" }}>
                  <Logout color="error" />
                </ListItemIcon>
                <ListItemText primary="Abmelden" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Box>
    </Drawer>
  );
};

export default NavigationDrawer;
