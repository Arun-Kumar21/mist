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
    const verifyAuth = async () => {
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await authApi.getMe();
        const userData = response.data;
        setUser({
          id: parseInt(userData.user_id),
          username: userData.username,
          role: userData.role as 'user' | 'admin'
        });
      } catch (err) {
        logout();
        navigate('/login');
      }
    };

    if (isAuthenticated) {
      verifyAuth();
    }
  }, [token, isAuthenticated, navigate, setUser, logout]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
