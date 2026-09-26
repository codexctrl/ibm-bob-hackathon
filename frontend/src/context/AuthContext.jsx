import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('cropflow_user');
    return stored ? JSON.parse(stored) : null;
  });

  const persistSession = useCallback((token, userData) => {
    localStorage.setItem('cropflow_token', token);
    localStorage.setItem('cropflow_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password }, { auth: false });
    persistSession(data.token, data.user);
    return data.user;
  }, [persistSession]);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload, { auth: false });
    const combinedUser = { ...data.user, farmerId: data.farmer.id };
    persistSession(data.token, combinedUser);
    return combinedUser;
  }, [persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('cropflow_token');
    localStorage.removeItem('cropflow_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
