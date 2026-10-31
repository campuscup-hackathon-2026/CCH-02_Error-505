import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, me } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sentinel_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    me(token)
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('sentinel_token');
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginUser: (token, profile) => {
        localStorage.setItem('sentinel_token', token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        setUser(profile || null);
      },
      logout: () => {
        localStorage.removeItem('sentinel_token');
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      },
      setUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
