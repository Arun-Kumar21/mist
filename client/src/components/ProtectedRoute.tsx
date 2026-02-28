import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token, setUser, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    authApi.getMe()
      .then((response) => {
        const userData = response.data;
        setUser({
          id: parseInt(userData.user_id),
          username: userData.username,
          role: userData.role as 'user' | 'admin',
        });
      })
      .catch(() => {
        logout();
        navigate('/login');
      });
  }, [token, isAuthenticated, navigate, setUser, logout]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
