import { Routes, Route, useLocation } from 'react-router-dom';
import ReferenceDataOverview from './ReferenceDataOverview';
import CropManagement from './CropManagement';
import GradeManagement from './GradeManagement';
import AuditTrail from './AuditTrail';
import AuditEventDetails from './AuditEventDetails';
import './ym04.css';

// YM04 · Chamasha Saminidi Stuwart · Reference data & audit
// WorkspaceLayout owns the sidebar and topbar; middle content and subpage routes live here.
//
// 5 Assigned Pages for YM04:
// 1. Reference data overview (Implemented - Default Index Page for /admin/reference-data)
// 2. Crop management (Implemented - Page 2)
// 3. Grade management (Implemented - Page 3)
// 4. Audit trail (Implemented - Page 4 - Active at /admin/audit-trail & /admin/reference-data/audit-trail)
// 5. Audit event details (Implemented - Page 5 - Active at /admin/audit-trail/:eventId & /admin/reference-data/audit-trail/:eventId)

export default function YM04() {
  const location = useLocation();

  // If user navigated via sidebar or direct link to /admin/audit-trail
  if (location.pathname.startsWith('/admin/audit-trail')) {
    return (
      <Routes>
        {/* Page 4: Audit Trail (Default index route for /admin/audit-trail) */}
        <Route index element={<AuditTrail />} />
        <Route path="audit-trail" element={<AuditTrail />} />

        {/* Page 5: Audit Event Details */}
        <Route path=":eventId" element={<AuditEventDetails />} />
        <Route path="audit-trail/:eventId" element={<AuditEventDetails />} />

        {/* Fallback to Audit Trail within the audit-trail workspace route */}
        <Route path="*" element={<AuditTrail />} />
      </Routes>
    );
  }

  // Default: Routed via /admin/reference-data/*
  return (
    <Routes>
      {/* Page 1: Reference Data Overview (Default index route for /admin/reference-data) */}
      <Route index element={<ReferenceDataOverview />} />
      <Route path="overview" element={<ReferenceDataOverview />} />

      {/* Page 2: Crop Management */}
      <Route path="crops" element={<CropManagement />} />

      {/* Page 3: Grade Management */}
      <Route path="grades" element={<GradeManagement />} />

      {/* Page 4: Audit Trail (Alternative nested route under /admin/reference-data) */}
      <Route path="audit-trail" element={<AuditTrail />} />
      <Route path="audit" element={<AuditTrail />} />

      {/* Page 5: Audit Event Details (Nested route under /admin/reference-data) */}
      <Route path="audit-trail/:eventId" element={<AuditEventDetails />} />
      <Route path="audit/:eventId" element={<AuditEventDetails />} />

      {/* Catch-all fallback routes back to Reference Data Overview */}
      <Route path="*" element={<ReferenceDataOverview />} />
    </Routes>
  );
}
