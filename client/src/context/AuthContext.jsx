import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  apiFetch,
  clearTemplatePreviewCache,
  getStoredToken,
  onUnauthorized,
  setStoredToken,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()));

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      clearTemplatePreviewCache();
    });

    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    apiFetch('/auth/me')
      .then((res) => {
        if (active) setUser(res.data?.user || null);
      })
      .catch(() => {
        setStoredToken('');
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      auth: false,
      body: { username, password },
    });
    const { token, user: loggedUser } = res.data;
    setStoredToken(token);
    clearTemplatePreviewCache();
    setUser(loggedUser);
    return loggedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Stateless JWT logout succeeds locally even if server is unreachable
    } finally {
      setStoredToken('');
      clearTemplatePreviewCache();
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await apiFetch('/auth/change-password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    });
    if (res.data?.token) {
      setStoredToken(res.data.token);
    }
    return res;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isOfficer: user?.role === 'officer' || user?.role === 'admin',
      login,
      logout,
      changePassword,
    }),
    [user, loading, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
