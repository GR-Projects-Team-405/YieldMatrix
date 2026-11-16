import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import WorkspaceLayout from './layouts/WorkspaceLayout';
import LoginPage from './features/auth/LoginPage';
import YM01 from './features/ym01';
import YM02 from './features/ym02';
import YM03 from './features/ym03';
import YM04 from './features/ym04';
import YM05 from './features/ym05';
import YM06 from './features/ym06';
import YM07 from './features/ym07';
import YM08 from './features/ym08';
import YM09 from './features/ym09';
import YM10 from './features/ym10';
import YM11 from './features/ym11';
import YM12 from './features/ym12';
import YM13 from './features/ym13';
import YM14 from './features/ym14';
import YM15 from './features/ym15';
import YM16 from './features/ym16';
import YM17 from './features/ym17';
import YM18 from './features/ym18';
import YM19 from './features/ym19';
import YM20 from './features/ym20';
import YM21 from './features/ym21';
import YM22 from './features/ym22';
import YM23 from './features/ym23';
import YM24 from './features/ym24';
import YM25 from './features/ym25';
import YM26 from './features/ym26';
import YM27 from './features/ym27';
import YM28 from './features/ym28';
import YM29 from './features/ym29';
import YM30 from './features/ym30';
import YM31 from './features/ym31';
import YM32 from './features/ym32';
// Route ownership follows the UI assignment. Each wildcard delegates subpages to its module.
export default function App() {
  return <Routes>
    <Route path="/" element={<YM01 />} />
    <Route path="/catalogue/*" element={<YM01 />} />
    <Route path="/roles/*" element={<YM01 />} />
    <Route path="/account/*" element={<YM02 />} />
    <Route path="/signup/*" element={<YM03 />} />
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute role="farmer" />}>
      <Route path="/farmer" element={<WorkspaceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview/*" element={<YM06 />} />
        <Route path="farms/*" element={<YM07 />} />
        <Route path="produce/*" element={<YM09 />} />
        <Route path="harvest-calendar/*" element={<YM08 />} />
        <Route path="buyer-requests/*" element={<YM10 />} />
        <Route path="allocations/*" element={<YM17 />} />
        <Route path="wallet/*" element={<YM27 />} />
        <Route path="market-insights/*" element={<YM29 />} />
        <Route path="offers/*" element={<YM10 />} />
        <Route path="commitments/*" element={<YM14 />} />
        <Route path="records/*" element={<YM20 />} />
        <Route path="trace/*" element={<YM25 />} />
        <Route path="notifications/*" element={<YM05 />} />
        <Route path="help/*" element={<YM31 />} />
        <Route path="profile/*" element={<YM32 />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute role="buyer" />}>
      <Route path="/buyer" element={<WorkspaceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview/*" element={<YM11 />} />
        <Route path="marketplace/*" element={<YM11 />} />
        <Route path="bulk-matching/*" element={<YM15 />} />
        <Route path="demands/*" element={<YM13 />} />
        <Route path="orders/*" element={<YM18 />} />
        <Route path="commitments/*" element={<YM14 />} />
        <Route path="wallet/*" element={<YM28 />} />
        <Route path="market-insights/*" element={<YM29 />} />
        <Route path="produce/*" element={<YM12 />} />
        <Route path="suppliers/*" element={<YM12 />} />
        <Route path="offers/*" element={<YM14 />} />
        <Route path="reservations/*" element={<YM16 />} />
        <Route path="acceptance/*" element={<YM19 />} />
        <Route path="disputes/*" element={<YM19 />} />
        <Route path="records/*" element={<YM20 />} />
        <Route path="trace/*" element={<YM25 />} />
        <Route path="notifications/*" element={<YM05 />} />
        <Route path="help/*" element={<YM31 />} />
        <Route path="profile/*" element={<YM32 />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute role="driver" />}>
      <Route path="/driver" element={<WorkspaceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview/*" element={<YM21 />} />
        <Route path="trips/*" element={<YM22 />} />
        <Route path="pickups/*" element={<YM23 />} />
        <Route path="vehicle/*" element={<YM21 />} />
        <Route path="history/*" element={<YM24 />} />
        <Route path="incidents/*" element={<YM24 />} />
        <Route path="trace/*" element={<YM25 />} />
        <Route path="handover/*" element={<YM24 />} />
        <Route path="notifications/*" element={<YM05 />} />
        <Route path="help/*" element={<YM31 />} />
        <Route path="profile/*" element={<YM32 />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute role="admin" />}>
      <Route path="/admin" element={<WorkspaceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview/*" element={<YM30 />} />
        <Route path="people/*" element={<YM30 />} />
        <Route path="orders/*" element={<YM26 />} />
        <Route path="dispatch/*" element={<YM26 />} />
        <Route path="reconciliation/*" element={<YM28 />} />
        <Route path="market-data/*" element={<YM29 />} />
        <Route path="reference-data/*" element={<YM04 />} />
        <Route path="audit-trail/*" element={<YM04 />} />
        <Route path="incidents/*" element={<YM26 />} />
        <Route path="disputes/*" element={<YM26 />} />
        <Route path="notifications/*" element={<YM05 />} />
        <Route path="help/*" element={<YM31 />} />
        <Route path="profile/*" element={<YM32 />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
