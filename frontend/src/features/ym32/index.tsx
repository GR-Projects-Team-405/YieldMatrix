import { Navigate, Route, Routes } from 'react-router-dom';
import MyProfile from './MyProfile';
import EditProfile from './EditProfile';

// YM32 · Sewmini Wijesiri · Profile Management
// Module-local router handling My Profile and Edit Profile under each workspace role
export default function YM32() {
  return (
    <Routes>
      <Route index element={<MyProfile />} />
      <Route path="edit" element={<EditProfile />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
