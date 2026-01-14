import { Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore';

interface PublicRouteProps {
    children: React.ReactNode;
}

export default function PublicRoute({ children }: PublicRouteProps) {
    const { user } = useAuthStore();

    // If user is logged in, redirect to home
    if (user) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
