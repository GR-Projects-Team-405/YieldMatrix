import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api, { TOKEN_KEY } from '../services/api';
export type Role = 'farmer' | 'buyer' | 'driver' | 'admin';
export interface User { id: string; name: string; role: Role }
interface AuthState {
  user: User | null;
  loading: boolean;
  demoLogin: (role: Role) => Promise<void>;
  completePasswordLogin: (
    token: string,
    authenticatedUser: User,
    expectedRole: Role
  ) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthState | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }, []);
  const completePasswordLogin = useCallback(
    (
      token: string,
      authenticatedUser: User,
      expectedRole: Role
    ) => {
      if (
        typeof token !== 'string' ||
        token.trim().length === 0 ||
        !authenticatedUser ||
        typeof authenticatedUser.id !== 'string' ||
        !authenticatedUser.id.trim() ||
        typeof authenticatedUser.name !== 'string' ||
        !authenticatedUser.name.trim() ||
        authenticatedUser.role !== expectedRole
      ) {
        throw new Error(
          'The authenticated account does not match the selected role.'
        );
      }

      localStorage.setItem(TOKEN_KEY, token);
      setUser(authenticatedUser);
      setLoading(false);
    },
    []
  );
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    // Reloaded sessions are verified by the server, never trusted from a stored role.
    api.get<{ user: User }>('/auth/me').then(({ data }) => { if (active) setUser(data.user); })
      .catch(() => { if (active) logout(); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [logout]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY && !event.newValue) {
        logout();
      } else if (event.key === TOKEN_KEY && event.newValue) {
        api.get<{ user: User }>('/auth/me').then(({ data }) => setUser(data.user)).catch(logout);
      }
    };
    window.addEventListener('yieldmatrix:unauthorized', logout);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('yieldmatrix:unauthorized', logout); window.removeEventListener('storage', sync); };
  }, [logout]);
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, 30 * 60 * 1000); };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset); };
  }, [user, logout]);
  async function demoLogin(role: Role) {
    const { data } = await api.post<{ token: string; user: User }>('/auth/demo-login', { role });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoLogin,
        completePasswordLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
