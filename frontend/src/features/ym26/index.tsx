import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OrderOperationsView } from './pages/OrderOperationsView';
import { DispatchAssignmentView } from './pages/DispatchAssignmentView';
import { IncidentReviewView } from './pages/IncidentReviewView';
import { DisputeResolutionView } from './pages/DisputeResolutionView';

// YM26 · Shermi Weerasinghe · Admin operations
// Displays the exact admin operational views (Order Operations, Dispatch, Incident Review, Dispute Resolution)
// matching design mocks 1:1, while seamlessly syncing navigation.

export default function YM26() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active view based on route
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

  // Synchronize sidebar links so "Incident review" and "Dispute resolution" appear matching the design mocks
  useEffect(() => {
    const nav = document.querySelector('.workspace-navigation');
    if (!nav) return;

    // 1. Incident review (under Dispatch)
    let incidentLink = document.getElementById('ym26-sidebar-incidents') as HTMLAnchorElement | null;
    const isIncidentsActive = activeTab === 'incidents';

    if (!incidentLink) {
      incidentLink = document.createElement('a');
      incidentLink.id = 'ym26-sidebar-incidents';
      incidentLink.href = '/admin/incidents';
      incidentLink.className = `sidebar-link ${isIncidentsActive ? 'active' : ''}`;
      incidentLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg><span>Incident review</span>`;
      incidentLink.onclick = (e) => {
        e.preventDefault();
        navigate('/admin/incidents');
      };

      const dispatchLink = Array.from(nav.querySelectorAll('a.sidebar-link')).find((el) =>
        el.getAttribute('href')?.includes('/dispatch')
      );
      if (dispatchLink && dispatchLink.nextSibling) {
        nav.insertBefore(incidentLink, dispatchLink.nextSibling);
      } else {
        nav.appendChild(incidentLink);
      }
    } else {
      if (isIncidentsActive) {
        incidentLink.classList.add('active');
      } else {
        incidentLink.classList.remove('active');
      }
    }

    // 2. Dispute resolution (under Reconciliation)
    let disputeLink = document.getElementById('ym26-sidebar-disputes') as HTMLAnchorElement | null;
    const isDisputesActive = activeTab === 'disputes';

    if (!disputeLink) {
      disputeLink = document.createElement('a');
      disputeLink.id = 'ym26-sidebar-disputes';
      disputeLink.href = '/admin/disputes';
      disputeLink.className = `sidebar-link ${isDisputesActive ? 'active' : ''}`;
      disputeLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Dispute resolution</span>`;
      disputeLink.onclick = (e) => {
        e.preventDefault();
        navigate('/admin/disputes');
      };

      const reconLink = Array.from(nav.querySelectorAll('a.sidebar-link')).find((el) =>
        el.getAttribute('href')?.includes('/reconciliation')
      );
      if (reconLink && reconLink.nextSibling) {
        nav.insertBefore(disputeLink, reconLink.nextSibling);
      } else {
        nav.appendChild(disputeLink);
      }
    } else {
      if (isDisputesActive) {
        disputeLink.classList.add('active');
      } else {
        disputeLink.classList.remove('active');
      }
    }

    // Active state coordination
    if (isIncidentsActive || isDisputesActive) {
      nav.querySelectorAll('a.sidebar-link').forEach((el) => {
        if (isIncidentsActive && el.id !== 'ym26-sidebar-incidents') el.classList.remove('active');
        if (isDisputesActive && el.id !== 'ym26-sidebar-disputes') el.classList.remove('active');
      });
    }
  }, [activeTab, navigate, location.pathname]);

  return (
    <div className="ym26-admin-module w-full">
      {/* Render the active operational view according to route */}
      {activeTab === 'dispatch' ? (
        <DispatchAssignmentView />
      ) : activeTab === 'incidents' ? (
        <IncidentReviewView />
      ) : activeTab === 'disputes' ? (
        <DisputeResolutionView />
      ) : (
        <OrderOperationsView />
      )}
    </div>
  );
}

