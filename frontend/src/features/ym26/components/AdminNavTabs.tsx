// YM26 · Shermi Weerasinghe · Admin operations navigation tabs
// Both Order Operations and Dispatch & Driver Assignment views follow the exact
// mockup designs where navigation is handled directly by the sidebar.

interface AdminNavTabsProps {
  activeTab?: 'orders' | 'dispatch' | 'incidents' | 'disputes';
  onTabChange?: (tab: 'orders' | 'dispatch' | 'incidents' | 'disputes') => void;
}

export function AdminNavTabs(_props?: AdminNavTabsProps) {
  // Returns null to preserve the clean, 1:1 design mock layout
  return null;
}
