import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';

export default function Home() {
    const { user, isAuthenticated} = useAuthStore();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-6xl mx-auto p-4">
                <div className="bg-white border border-gray-300 p-4">
                    <h2 className="font-bold mb-4">Welcome to Mist Music</h2>
                    <p className="text-gray-600 mb-4">
                        {isAuthenticated && user
                            ? `Hello, ${user.username}! You are logged in as ${user.role}.`
                            : 'Please log in to access the application.'}
                    </p>

                    {isAuthenticated && user?.role === 'admin' && (
                        <div className="mt-6 pt-4 border-t border-gray-300">
                            <h3 className="font-bold mb-3">Admin Panel</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => navigate('/admin/upload')}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Upload Track
                                </button>
                                <button
                                    onClick={() => navigate('/admin/tracks')}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Manage Tracks
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
