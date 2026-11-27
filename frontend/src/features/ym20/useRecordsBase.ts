import { useLocation } from 'react-router-dom';

/** Returns "/buyer/records" or "/farmer/records" depending on where the module is mounted. */
export function useRecordsBase(): string {
  const { pathname } = useLocation();
  const i = pathname.indexOf('/records');
  return i >= 0 ? pathname.slice(0, i + '/records'.length) : '/buyer/records';
}
