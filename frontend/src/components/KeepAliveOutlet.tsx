import React, { useEffect, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import useTabStore from '../store/useTabStore';
import { ROUTE_CONFIG_MAP } from './routeConfig';

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
    <CircularProgress size={32} />
  </Box>
);

const KeepAliveOutlet: React.FC = () => {
  const location = useLocation();
  const { tabs, openTab } = useTabStore();

  const activePath = location.pathname === '/' ? '/dashboard' : location.pathname;

  // Bei Pfadwechsel: Tab öffnen falls die Route im Config-Map registriert ist
  useEffect(() => {
    const config = ROUTE_CONFIG_MAP[activePath];
    if (config) {
      openTab({ path: activePath, label: config.label });
    }
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRegisteredRoute = Boolean(ROUTE_CONFIG_MAP[activePath]);

  return (
    <>
      {/* Fallback für nicht-registrierte Routen (z.B. NoAccessPage, Redirects) */}
      {!isRegisteredRoute && <Outlet />}

      {/* Keep-Alive: alle geöffneten Seiten im DOM halten, nur aktive sichtbar */}
      {tabs.map((tab) => {
        const config = ROUTE_CONFIG_MAP[tab.path];
        if (!config) return null;
        const Component = config.component;
        const isActive = activePath === tab.path;

        return (
          <Box
            key={tab.path}
            sx={{ display: isActive ? 'block' : 'none' }}
            aria-hidden={!isActive}
          >
            <Suspense fallback={<PageLoader />}>
              <Component />
            </Suspense>
          </Box>
        );
      })}
    </>
  );
};

export default KeepAliveOutlet;
