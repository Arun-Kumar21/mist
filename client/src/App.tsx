import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminUpload from './pages/AdminUpload';
import AdminTracks from './pages/AdminTracks';
import Player from './pages/Player';
import Library from './pages/Library';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { useAuthStore } from './store/authStore';
import { authApi } from './lib/api';
import Layout from './components/Layout';
import PublicRoute from './components/PublicRoute';
import SearchPage from './pages/Search';

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
                        role: userData.role as 'user' | 'admin',
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
            {/* Public routes without nav - redirect to home if logged in */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            
            {/* Routes with nav */}
            <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/library" element={<Library />} />
                <Route path="/player/:id" element={<ProtectedRoute><Player /></ProtectedRoute>} />
                <Route path="/admin/upload" element={<AdminRoute><AdminUpload /></AdminRoute>} />
                <Route path="/admin/tracks" element={<AdminRoute><AdminTracks /></AdminRoute>} />
            </Route>
            
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
