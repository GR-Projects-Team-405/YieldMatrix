import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminNavTabs } from './components/AdminNavTabs';
import { OrderOperationsView } from './pages/OrderOperationsView';
import { DispatchAssignmentView } from './pages/DispatchAssignmentView';
import { IncidentReviewView } from './pages/IncidentReviewView';
import { DisputeResolutionView } from './pages/DisputeResolutionView';

// YM26 · Shermi Weerasinghe · Admin operations
// Entry point connecting Order operations, Dispatch, Incident review, and Dispute resolution

export default function YM26() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on route
  const getTabFromPath = (): 'orders' | 'dispatch' | 'incidents' | 'disputes' => {
    const path = location.pathname;
    if (path.includes('/admin/dispatch')) return 'dispatch';
    if (path.includes('/admin/incidents')) return 'incidents';
    if (path.includes('/admin/disputes')) return 'disputes';
    return 'orders';
  };

  const [activeTab, setActiveTab] = useState<'orders' | 'dispatch' | 'incidents' | 'disputes'>(getTabFromPath);

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const handleTabChange = (tab: 'orders' | 'dispatch' | 'incidents' | 'disputes') => {
    setActiveTab(tab);
    navigate(`/admin/${tab}`);
  };

  // Dynamically inject Incident Review and Dispute Resolution into the sidebar navigation
  useEffect(() => {
    const nav = document.querySelector('.workspace-navigation');
    if (!nav) return;

    // Helper to insert or update sidebar links
    const setupSidebarLink = (
      id: string,
      targetPath: string,
      tab: 'orders' | 'dispatch' | 'incidents' | 'disputes',
      label: string,
      svgIcon: string,
      insertAfterHrefSub: string
    ) => {
      let link = document.getElementById(id) as HTMLAnchorElement | null;
      const isCurrentActive = activeTab === tab;

      if (!link) {
        link = document.createElement('a');
        link.id = id;
        link.href = targetPath;
        link.className = `sidebar-link ${isCurrentActive ? 'active' : ''}`;
        link.innerHTML = `${svgIcon}<span>${label}</span>`;
        link.onclick = (e) => {
          e.preventDefault();
          navigate(targetPath);
        };

        const existingLinks = Array.from(nav.querySelectorAll('a.sidebar-link'));
        const refLink = existingLinks.find((el) => el.getAttribute('href')?.includes(insertAfterHrefSub));
        if (refLink && refLink.nextSibling) {
          nav.insertBefore(link, refLink.nextSibling);
        } else {
          nav.appendChild(link);
        }
      } else {
        if (isCurrentActive) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    };

    // 1. Incident review (under Dispatch)
    setupSidebarLink(
      'ym26-sidebar-incidents',
      '/admin/incidents',
      'incidents',
      'Incident review',
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      '/dispatch'
    );

    // 2. Dispute resolution (under Reconciliation)
    setupSidebarLink(
      'ym26-sidebar-disputes',
      '/admin/disputes',
      'disputes',
      'Dispute resolution',
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      '/reconciliation'
    );

    // Sync active classes on standard sidebar links
    const standardLinks = nav.querySelectorAll('a.sidebar-link:not(#ym26-sidebar-incidents):not(#ym26-sidebar-disputes)');
    standardLinks.forEach((el) => {
      const href = el.getAttribute('href') || '';
      if (activeTab === 'incidents' || activeTab === 'disputes') {
        el.classList.remove('active');
      } else if (activeTab === 'orders' && href.endsWith('/orders')) {
        el.classList.add('active');
      } else if (activeTab === 'dispatch' && href.endsWith('/dispatch')) {
        el.classList.add('active');
      }
    });
  }, [activeTab, navigate, location.pathname]);

  return (
    <div className="ym26-admin-module w-full">
      {/* Top Quick Navigation Bar across YM26 operational modules */}
      <AdminNavTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Render the active operational view */}
      {activeTab === 'orders' && <OrderOperationsView />}
      {activeTab === 'dispatch' && <DispatchAssignmentView />}
      {activeTab === 'incidents' && <IncidentReviewView />}
      {activeTab === 'disputes' && <DisputeResolutionView />}
    </div>
  );
}
