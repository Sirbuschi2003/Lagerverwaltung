import { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';

// Loading Component für bessere UX
const LoadingSpinner = () => (
  <Box 
    display="flex" 
    justifyContent="center" 
    alignItems="center" 
    minHeight="60vh"
  >
    <CircularProgress size={48} />
  </Box>
);

// Lazy-loaded Pages mit optimaler Bundle-Aufteilung
export const LazyDashboardPage = lazy(() => 
  import('../pages/DashboardPage')
);

export const LazyFleetOverviewPage = lazy(() => 
  import('../pages/FleetOverviewPage')
);

export const LazyMyVehiclePage = lazy(() => 
  import('../pages/MyVehiclePage')
);

export const LazyInventoryPage = lazy(() => 
  import('../pages/InventoryPage')
);

export const LazyItemsPage = lazy(() => 
  import('../pages/ItemsPage')
);

export const LazyLoginPage = lazy(() => 
  import('../pages/LoginPage')
);

export const LazyUsersPage = lazy(() => 
  import('../pages/UsersPage')
);

export const LazyVehiclesPage = lazy(() => 
  import('../pages/VehiclesPage')
);

export const LazyScannerPage = lazy(() => 
  import('../pages/ScannerPage')
);

export const LazySetupPage = lazy(() => 
  import('../pages/SetupPage')
);

export const LazySyncPage = lazy(() => 
  import('../pages/SyncPage')
);

export const LazySettingsPage = lazy(() => 
  import('../pages/SettingsPage')
);

// HOC für Lazy Loading mit Error Boundary
export const withLazyLoading = (Component: React.LazyExoticComponent<React.ComponentType>) => {
  return () => (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
};

// Utility für Router-Integration
export const createLazyRoute = (Component: React.LazyExoticComponent<React.ComponentType>) => 
  withLazyLoading(Component);
