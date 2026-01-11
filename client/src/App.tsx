import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminUpload from './pages/AdminUpload';
import AdminTracks from './pages/AdminTracks';
import { useAuthStore } from './store/authStore';
import { authApi } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    // Fetch user data on app initialization if token exists
    const initializeUser = async () => {
      if (token && !useAuthStore.getState().user) {
        try {
          const userResponse = await authApi.getMe();
          const userData = userResponse.data;
          
          const user = {
            id: parseInt(userData.user_id) || 0,
            username: userData.username,
            email: userData.email || '',
            role: userData.role as 'user' | 'admin',
            daily_listen_quota: userData.daily_listen_quota || 0,
            created_at: userData.created_at || new Date().toISOString(),
          };
          setAuth(user, token);
        } catch (error) {
          console.error('Failed to fetch user data:', error);
          // Token might be invalid, logout
          logout();
        }
      }
    };

    initializeUser();
  }, [token, setAuth, logout]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/upload" element={<AdminUpload />} />
      <Route path="/admin/tracks" element={<AdminTracks />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
