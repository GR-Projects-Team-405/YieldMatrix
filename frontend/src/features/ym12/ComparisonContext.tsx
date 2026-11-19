import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
/** Prompt default; confirm this four-listing limit with the YM12 lead. */
export const MAX_COMPARE = 4;
interface ComparisonContextValue {
  listingIds: string[]; isCompared: (id: string) => boolean;
  canAdd: (id: string) => boolean; toggle: (id: string) => boolean;
}
const ComparisonContext = createContext<ComparisonContextValue | null>(null);
function readSavedIds(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('yieldmatrix_ym12_comparison') || '[]');
    return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_COMPARE) : [];
  } catch { return []; }
}
function saveIds(ids: string[]) {
  try { localStorage.setItem('yieldmatrix_ym12_comparison', JSON.stringify(ids)); } catch { /* Keep comparison usable when storage is unavailable. */ }
}
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [listingIds, setListingIds] = useState<string[]>(readSavedIds);
  const value = useMemo<ComparisonContextValue>(() => ({
    listingIds,
    isCompared: (id) => listingIds.includes(id),
    canAdd: (id) => listingIds.includes(id) || listingIds.length < MAX_COMPARE,
    toggle: (id) => {
      if (listingIds.includes(id)) {
        const next = listingIds.filter((item) => item !== id);
        setListingIds(next); saveIds(next); return false;
      }
      if (listingIds.length >= MAX_COMPARE) return false;
      const next = [...listingIds, id];
      setListingIds(next); saveIds(next); return true;
    },
  }), [listingIds]);
  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}
export function useComparison() {
  const value = useContext(ComparisonContext);
  if (!value) throw new Error('useComparison must be used inside ComparisonProvider');
  return value;
}
