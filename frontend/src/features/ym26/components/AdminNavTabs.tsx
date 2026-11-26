import { NavLink } from 'react-router-dom';
import { ClipboardCheck, Truck, TriangleAlert, ShieldAlert } from 'lucide-react';

// YM26 · Shermi Weerasinghe · Admin operations navigation tabs

interface AdminNavTabsProps {
  activeTab: 'orders' | 'dispatch' | 'incidents' | 'disputes';
  onTabChange?: (tab: 'orders' | 'dispatch' | 'incidents' | 'disputes') => void;
}

export function AdminNavTabs({ activeTab, onTabChange }: AdminNavTabsProps) {
  const tabs = [
    { id: 'orders', label: 'Order Operations', path: '/admin/orders', icon: ClipboardCheck },
    { id: 'dispatch', label: 'Dispatch & Assignment', path: '/admin/dispatch', icon: Truck },
    { id: 'incidents', label: 'Incident Review', path: '/admin/incidents', icon: TriangleAlert },
    { id: 'disputes', label: 'Dispute Resolution', path: '/admin/disputes', icon: ShieldAlert },
  ] as const;

  return (
    <div className="ym-admin-subnav mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#dce3db] pb-3 bg-white/70 backdrop-blur-xs p-3 rounded-2xl border border-[#dce3db] shadow-2xs">
      <nav className="flex flex-wrap items-center gap-2" aria-label="Admin Operations Modules">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              onClick={() => onTabChange?.(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#315A42] text-white shadow-xs'
                  : 'bg-white hover:bg-[#eaf2e8] text-[#263A31] border border-[#dce3db]'
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="text-[11px] text-[#596c60] font-semibold flex items-center gap-2 pr-1">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>YM26 · Admin Suite</span>
      </div>
    </div>
  );
}
