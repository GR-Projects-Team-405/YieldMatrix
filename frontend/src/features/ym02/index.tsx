import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLoginPage from './AdminLoginPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';

// YM02 · Ashen Ranasingha · Login & account access
// Routes are relative to /account/* (see App.tsx). Do not add another BrowserRouter here.
export default function YM02() {
  return (
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}