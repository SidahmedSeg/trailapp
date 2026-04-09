import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { post } from '../lib/api.js';
import { setTokens, clearTokens, getUserFromToken } from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // On mount, restore user from stored token
  useEffect(() => {
    const stored = getUserFromToken();
    if (stored) {
      setUser(stored);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await post('/admin/login', { username, password });
    setTokens(data.accessToken, data.refreshToken);
    const decoded = getUserFromToken();
    setUser(decoded);
    return decoded;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  }
  return context;
}
