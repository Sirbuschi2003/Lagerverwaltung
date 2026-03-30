/**
 * Hook für Network-Status - nutzt GLOBALEN Store
 * 
 * Verhindert Race-Conditions durch zentralen State
 */
import { useEffect } from 'react';
import { useNetworkStore, checkBackendReachability } from '../store/useNetworkStore';

export const useNetworkStatus = () => {
  // Nutze globalen Store - KEIN lokaler State mehr!
  const isOnline = useNetworkStore((state) => state.isOnline);
  const lastCheck = useNetworkStore((state) => state.lastCheck);
  const isChecking = useNetworkStore((state) => state.isChecking);

  // Kein eigener Check mehr - nur Store abonnieren
  // Check wird zentral von useNetworkStore gesteuert

  return {
    isOnline,
    lastCheck,
    isChecking,
    checkNetwork: checkBackendReachability, // Für manuelle Checks
  };
};