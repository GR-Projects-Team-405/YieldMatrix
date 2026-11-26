import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import PeopleAndAccess from './PeopleAndAccess';
import SuspendedAccounts from './SuspendedAccounts';
import AccountDetails from './AccountDetails';
import ApprovalRequests from './ApprovalRequests';
import './ym30.css';

// YM30 · Yugen Suresh · People & access
// App.tsx maps:
//   /admin/overview/* -> YM30 (Admin Dashboard)
//   /admin/people/*   -> YM30 (People & Access Module Pages)
//
// 04 Pages under People & access:
//   1. People and access     -> /admin/people (Main Member Directory - Image 1)
//   2. Account details       -> /admin/people/account (or /admin/people/:accountId)
//   3. Approval requests     -> /admin/people/approvals (Registration Approvals)
//   4. Suspended accounts    -> /admin/people/suspended (Suspended Accounts - Image 2)
//
// Overview page:
//   Admin Dashboard          -> /admin/overview (Overview - Dashboard UI)

export default function YM30() {
  const location = useLocation();

  // Overview displays the Admin Dashboard according to the provided UI
  if (location.pathname.startsWith('/admin/overview')) {
    return <AdminDashboard />;
  }

  // People & access sub pages:
  return (
    <Routes>
      {/* 4. Suspended Accounts Page (Image 2) */}
      <Route path="suspended" element={<SuspendedAccounts />} />
      <Route path="suspended-accounts" element={<SuspendedAccounts />} />

      {/* 3. Approval Requests Page */}
      <Route path="approvals" element={<ApprovalRequests />} />
      <Route path="approval-requests" element={<ApprovalRequests />} />

      {/* 2. Account Details Page */}
      <Route path="account" element={<AccountDetails />} />
      <Route path="account-details" element={<AccountDetails />} />
      <Route path="account/:accountId" element={<AccountDetails />} />

      {/* 1. Main People & Access Member Directory Page (Image 1) */}
      <Route index element={<PeopleAndAccess />} />

      {/* Direct member ID route */}
      <Route path=":accountId" element={<AccountDetails />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/admin/people" replace />} />
    </Routes>
  );
}
