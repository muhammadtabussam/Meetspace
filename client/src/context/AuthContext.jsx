import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function requestAuthentication(path, credentials) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(credentials),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Authentication failed. Please try again.');
  }
  return data.user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async () => {
    setStatus('loading');
    setAuthError('');
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not verify your sign-in.');
      setUser(data.user);
    } catch (error) {
      setUser(null);
      setAuthError(error.message || 'MeetSpace could not verify your sign-in.');
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const authenticatedUser = await requestAuthentication('/api/auth/login', { email, password });
    setAuthError('');
    setUser(authenticatedUser);
    setStatus('ready');
  }, []);

  const signUp = useCallback(async (email, password) => {
    const authenticatedUser = await requestAuthentication('/api/auth/register', { email, password });
    setAuthError('');
    setUser(authenticatedUser);
    setStatus('ready');
  }, []);

  const signOut = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not sign out.');
    } finally {
      setUser(null);
      setStatus('ready');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, authError, refresh, signIn, signUp, signOut }),
    [user, status, authError, refresh, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
