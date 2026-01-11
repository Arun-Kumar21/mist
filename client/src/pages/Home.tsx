import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { tracksApi, listenApi } from '../lib/api';
import type { Track, ListeningQuota } from '../types';

export default function Home() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [quota, setQuota] = useState<ListeningQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tracksRes, quotaRes] = await Promise.all([
        tracksApi.getTracks({ limit: 20 }),
        listenApi.getQuota(),
      ]);
      setTracks(tracksRes.data);
      setQuota(quotaRes.data);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-300 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Mist Music</h1>
          
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <span className="text-sm">
                  {user.username} ({user.role})
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-1 bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {quota && (
          <div className="bg-white border border-gray-300 p-4 mb-6">
            <h2 className="font-bold mb-2">Daily Listening Quota</h2>
            <div className="text-sm">
              <p>Used: {quota.used_quota}s / {quota.total_quota}s</p>
              <p>Remaining: {quota.remaining_quota}s</p>
              <p>Status: {quota.is_authenticated ? 'Authenticated' : 'Anonymous'}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-300 p-4">
          <h2 className="font-bold mb-4">Tracks</h2>
          
          {tracks.length === 0 ? (
            <p className="text-gray-600">No tracks available</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Artist</th>
                  <th className="text-left p-2">Genre</th>
                  <th className="text-right p-2">Duration</th>
                  <th className="text-right p-2">Plays</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-2">{track.title}</td>
                    <td className="p-2">{track.artist}</td>
                    <td className="p-2">{track.genre || '-'}</td>
                    <td className="p-2 text-right">{formatDuration(track.duration_seconds)}</td>
                    <td className="p-2 text-right">{track.play_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
