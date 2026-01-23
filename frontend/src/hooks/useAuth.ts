import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector, authActions } from '../store';
import { authApi } from '../services/api';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, isLoading, error } = useAppSelector(state => state.auth);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token && !user) {
        try {
          const response = await authApi.me();
          if (response.success && response.data) {
            dispatch(authActions.setUser(response.data));
          } else {
            dispatch(authActions.logout());
          }
        } catch {
          dispatch(authActions.logout());
        }
      } else if (!token) {
        dispatch(authActions.setLoading(false));
      }
    };
    checkAuth();
  }, [token, user, dispatch]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch(authActions.setLoading(true));
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.data) {
        dispatch(authActions.setCredentials(response.data));
        navigate('/');
        return { success: true };
      }
      return { success: false, error: response.error?.message || 'Login failed' };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Login failed';
      dispatch(authActions.setError(message));
      return { success: false, error: message };
    }
  }, [dispatch, navigate]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    dispatch(authActions.logout());
    navigate('/login');
  }, [dispatch, navigate]);

  const updateStatus = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    try {
      await authApi.updateStatus(status);
      dispatch(authActions.updateStatus(status));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [dispatch]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    updateStatus,
  };
};
