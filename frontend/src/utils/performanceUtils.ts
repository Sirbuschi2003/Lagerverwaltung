import { memo, useMemo, useCallback, createElement } from 'react';

/**
 * Erweiterte Memo-Funktion mit Deep Comparison für komplexe Props
 */
export const deepMemo = <P extends object>(
  Component: React.ComponentType<P>,
  compare?: (prevProps: P, nextProps: P) => boolean
) => {
  return memo(Component, compare || deepEqual);
};

/**
 * Deep Equal Comparison für komplexe Objekte
 */
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }
  
  return true;
}

/**
 * Optimierter useMemo Hook
 */
export const useOptimizedMemo = <T>(
  factory: () => T,
  deps: React.DependencyList
) => {
  return useMemo(() => {
    return factory();
  }, deps);
};

/**
 * Optimierter useCallback Hook
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return useCallback((...args: Parameters<T>) => {
    return callback(...args);
  }, deps) as T;
};

/**
 * Memoized Component HOC
 */
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return memo<P>((props) => {
    const result = useMemo(() => {
      return createElement(Component, props);
    }, [props]);
    
    return result;
  });
};

/**
 * Utility für Objekt-Vergleiche in useEffect Dependencies
 */
export const useShallowMemo = <T extends object>(obj: T): T => {
  return useMemo(() => obj, Object.values(obj));
};

/**
 * Performance-optimierte Liste mit virtueller Scrolling-Vorbereitung
 */
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
    const totalHeight = items.length * itemHeight;
    
    return {
      visibleCount,
      totalHeight,
      getVisibleItems: (scrollTop: number) => {
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleCount, items.length);
        
        return {
          items: items.slice(startIndex, endIndex),
          startIndex,
          endIndex,
          offsetY: startIndex * itemHeight
        };
      }
    };
  }, [items, itemHeight, containerHeight]);
};

/**
 * Optimized state for large datasets
 */
export const useMemoizedFilter = <T>(
  items: T[],
  filterFn: (item: T) => boolean,
  deps: React.DependencyList = []
) => {
  return useMemo(() => {
    return items.filter(filterFn);
  }, [items, ...deps]);
};

/**
 * Performance-optimierte Sortierung
 */
export const useMemoizedSort = <T>(
  items: T[],
  sortFn: (a: T, b: T) => number,
  deps: React.DependencyList = []
) => {
  return useMemo(() => {
    return [...items].sort(sortFn);
  }, [items, ...deps]);
};
