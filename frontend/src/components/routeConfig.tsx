import type { ComponentType } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Dashboard,
  Inventory,
  QrCodeScanner,
  Storefront,
  Inventory2,
  LocalShipping,
  TableChart,
  DirectionsCar,
  Assignment,
  Build,
  Sync,
  Settings as SettingsIcon,
  MarkEmailRead,
  Warehouse,
  CloudDownload,
  Analytics,
  AdminPanelSettings,
  CorporateFare,
  HelpOutline,
} from '@mui/icons-material';

export interface RouteConfig {
  path: string;
  label: string;
  Icon: SvgIconComponent;
  component: ComponentType;
}

// Lazy imports um den initialen Bundle nicht zu vergrößern
const pages = {
  Dashboard: () => import('../pages/DashboardPage').then((m) => ({ default: m.default })),
  Items: () => import('../pages/ItemsPage').then((m) => ({ default: m.default })),
  QuickBooking: () => import('../pages/QuickBookingPage').then((m) => ({ default: m.default })),
  Suppliers: () => import('../pages/SuppliersPage').then((m) => ({ default: m.default })),
  Locations: () => import('../pages/LocationsPage').then((m) => ({ default: m.default })),
  Orders: () => import('../pages/OrdersPage').then((m) => ({ default: m.default })),
  Movements: () => import('../pages/MovementHistoryPage').then((m) => ({ default: m.default })),
  Fleet: () => import('../pages/FleetOverviewPage').then((m) => ({ default: m.default })),
  Inventory: () => import('../pages/InventoryPage').then((m) => ({ default: m.default })),
  MyVehicle: () => import('../pages/MyVehiclePage').then((m) => ({ default: m.default })),
  Sync: () => import('../pages/SyncPage').then((m) => ({ default: m.default })),
  Settings: () => import('../pages/SettingsPage').then((m) => ({ default: m.default })),
  EmailSettings: () => import('../pages/EmailSettingsPage').then((m) => ({ default: m.default })),
  WarehouseSettings: () => import('../pages/WarehouseSettingsPage').then((m) => ({ default: m.default })),
  Backup: () => import('../pages/BackupPage').then((m) => ({ default: m.default })),
  Logs: () => import('../pages/LogsManagementPage').then((m) => ({ default: m.default })),
  LiveLogs: () => import('../pages/LiveLogsPage').then((m) => ({ default: m.default })),
  AccessControl: () => import('../pages/AccessControlPage').then((m) => ({ default: m.default })),
  Branches: () => import('../pages/BranchesPage').then((m) => ({ default: m.default })),
  Maintenance: () => import('../pages/AdminMaintenancePage').then((m) => ({ default: m.default })),
  Help: () => import('../pages/HelpPage').then((m) => ({ default: m.default })),
};

// React.lazy equivalents – werden beim ersten Rendern geladen
import React from 'react';
const DashboardPage = React.lazy(pages.Dashboard);
const ItemsPage = React.lazy(pages.Items);
const QuickBookingPage = React.lazy(pages.QuickBooking);
const SuppliersPage = React.lazy(pages.Suppliers);
const LocationsPage = React.lazy(pages.Locations);
const OrdersPage = React.lazy(pages.Orders);
const MovementHistoryPage = React.lazy(pages.Movements);
const FleetOverviewPage = React.lazy(pages.Fleet);
const InventoryPage = React.lazy(pages.Inventory);
const MyVehiclePage = React.lazy(pages.MyVehicle);
const SyncPage = React.lazy(pages.Sync);
const SettingsPage = React.lazy(pages.Settings);
const EmailSettingsPage = React.lazy(pages.EmailSettings);
const WarehouseSettingsPage = React.lazy(pages.WarehouseSettings);
const BackupPage = React.lazy(pages.Backup);
const LogsManagementPage = React.lazy(pages.Logs);
const LiveLogsPage = React.lazy(pages.LiveLogs);
const AccessControlPage = React.lazy(pages.AccessControl);
const BranchesPage = React.lazy(pages.Branches);
const AdminMaintenancePage = React.lazy(pages.Maintenance);
const HelpPage = React.lazy(pages.Help);

export const ROUTE_CONFIGS: RouteConfig[] = [
  { path: '/dashboard',          label: 'Dashboard',              Icon: Dashboard,          component: DashboardPage },
  { path: '/items',              label: 'Artikel',                Icon: Inventory,          component: ItemsPage },
  { path: '/quick-booking',      label: 'Schnellbuchung',         Icon: QrCodeScanner,      component: QuickBookingPage },
  { path: '/suppliers',          label: 'Lieferanten',            Icon: Storefront,         component: SuppliersPage },
  { path: '/locations',          label: 'Lagerorte',              Icon: Inventory2,         component: LocationsPage },
  { path: '/orders',             label: 'Bestellungen',           Icon: LocalShipping,      component: OrdersPage },
  { path: '/movements',          label: 'Bewegungen & Berichte',  Icon: TableChart,         component: MovementHistoryPage },
  { path: '/fleet',              label: 'Fahrzeugbestände',       Icon: DirectionsCar,      component: FleetOverviewPage },
  { path: '/inventory',          label: 'Inventur',               Icon: Assignment,         component: InventoryPage },
  { path: '/my-vehicle',         label: 'Mein Fahrzeug',          Icon: Build,              component: MyVehiclePage },
  { path: '/sync',               label: 'Synchronisierung',       Icon: Sync,               component: SyncPage },
  { path: '/settings',           label: 'Firmendaten',            Icon: SettingsIcon,       component: SettingsPage },
  { path: '/settings/email',     label: 'E-Mail Einstellungen',   Icon: MarkEmailRead,      component: EmailSettingsPage },
  { path: '/settings/warehouse', label: 'Lagereinstellungen',     Icon: Warehouse,          component: WarehouseSettingsPage },
  { path: '/backup',             label: 'Datensicherung',         Icon: CloudDownload,      component: BackupPage },
  { path: '/logs',               label: 'Systemprotokolle',       Icon: Analytics,          component: LogsManagementPage },
  { path: '/settings/logs',      label: 'Live-Protokolle',        Icon: Analytics,          component: LiveLogsPage },
  { path: '/access-control',     label: 'Benutzer & Fahrzeuge',   Icon: AdminPanelSettings, component: AccessControlPage },
  { path: '/branches',           label: 'Niederlassungen',        Icon: CorporateFare,      component: BranchesPage },
  { path: '/settings/maintenance', label: 'Wartung & Update',     Icon: Build,              component: AdminMaintenancePage },
  { path: '/help',                 label: 'Benutzerhandbuch',      Icon: HelpOutline,        component: HelpPage },
];

export const ROUTE_CONFIG_MAP: Record<string, RouteConfig> = Object.fromEntries(
  ROUTE_CONFIGS.map((r) => [r.path, r])
);
