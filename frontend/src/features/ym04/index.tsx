import { Routes, Route, Navigate } from 'react-router-dom';
import ReferenceDataOverview from './ReferenceDataOverview';
import './ym04.css';

// YM04 · Chamasha Saminidi Stuwart · Reference data & audit
// WorkspaceLayout owns the sidebar and topbar; middle content and subpage routes live here.
//
// 5 Assigned Pages for YM04:
// 1. Reference data overview (Implemented - Default Index Page)
// 2. Crop management (Page 2 - Coming next)
// 3. Grade management (Page 3 - Coming next)
// 4. Audit trail (Page 4 - Coming next)
// 5. Audit event details (Page 5 - Coming next)

export default function YM04() {
  return (
    <Routes>
      {/* Page 1: Reference Data Overview (Default index route) */}
      <Route index element={<ReferenceDataOverview />} />
      <Route path="overview" element={<ReferenceDataOverview />} />

      {/* Page 2: Crop Management (Placeholder route for Page 2) */}
      {/* <Route path="crops" element={<CropManagement />} /> */}

      {/* Page 3: Grade Management (Placeholder route for Page 3) */}
      {/* <Route path="grades" element={<GradeManagement />} /> */}

      {/* Page 4: Audit Trail (Placeholder route for Page 4) */}
      {/* <Route path="audit" element={<AuditTrail />} /> */}

      {/* Page 5: Audit Event Details (Placeholder route for Page 5) */}
      {/* <Route path="audit/:id" element={<AuditEventDetails />} /> */}

      {/* Catch-all fallback routes back to Reference Data Overview */}
      <Route path="*" element={<ReferenceDataOverview />} />
    </Routes>
  );
}
