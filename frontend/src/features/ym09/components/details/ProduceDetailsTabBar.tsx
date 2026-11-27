import { useRef, type ReactNode } from 'react';
import { Eye, Network, TrendingUp, Clock } from 'lucide-react';
import type { ListingDetailsTabId } from '../../types/produce';

interface ProduceDetailsTabBarProps {
  activeTab: ListingDetailsTabId;
  onTabChange: (tab: ListingDetailsTabId) => void;
}

const TABS: Array<{ id: ListingDetailsTabId; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Eye size={16} aria-hidden="true" /> },
  { id: 'allocations', label: 'Allocation & Orders', icon: <Network size={16} aria-hidden="true" /> },
  { id: 'price-history', label: 'Price History', icon: <TrendingUp size={16} aria-hidden="true" /> },
  { id: 'activity', label: 'Activity', icon: <Clock size={16} aria-hidden="true" /> },
];

export function ProduceDetailsTabBar({ activeTab, onTabChange }: ProduceDetailsTabBarProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const targetTab = TABS[nextIndex];
      onTabChange(targetTab.id);
      tabRefs.current[targetTab.id]?.focus();
    }
  };

  return (
    <div
      className="ym09-tab-bar"
      role="tablist"
      aria-label="Produce listing sections"
      aria-orientation="horizontal"
    >
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            id={`ym09-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="ym09-tab-content-panel"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`ym09-tab-pill ${isActive ? 'ym09-tab-pill--active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
