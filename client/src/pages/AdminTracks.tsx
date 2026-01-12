import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { tracksApi, adminApi } from '../lib/api';
import type { Track } from '../types';

export default function AdminTracks() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingTrack, setEditingTrack] = useState<Track | null>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        artist: '',
        album: '',
        genre: '',
    });

    // Redirect if not admin
    useEffect(() => {
        if (user?.role !== 'admin') {
            navigate('/');
        }
    }, [user, navigate]);

    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        setLoading(true);
        try {
            const response = await tracksApi.getTracks({ limit: 100 });
            const data: any = response.data;
            if (Array.isArray(data)) {
                setTracks(data);
            } else if (data?.tracks && Array.isArray(data.tracks)) {
                setTracks(data.tracks);
            } else {
                setTracks([]);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load tracks');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (track: Track) => {
        setEditingTrack(track);
        setEditForm({
            title: track.title,
            artist: track.artist_name,
            album: track.album_title || '',
            genre: track.genre_top || '',
        });
    };

    const handleCancelEdit = () => {
        setEditingTrack(null);
        setEditForm({ title: '', artist: '', album: '', genre: '' });
    };

    const handleSaveEdit = async () => {
        if (!editingTrack) return;

        try {
            await adminApi.updateTrack(editingTrack.track_id, editForm);
            await loadTracks();
            handleCancelEdit();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to update track');
        }
    };

    const handleDelete = async (trackId: number, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await adminApi.deleteTrack(trackId);
            await loadTracks();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to delete track');
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading tracks...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-300 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold">Manage Tracks</h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-1 text-sm hover:bg-gray-100"
                        >
                            Home
                        </button>
                        <button
                            onClick={() => navigate('/admin/upload')}
                            className="px-4 py-1 bg-blue-600 text-white hover:bg-blue-700 text-sm"
                        >
                            Upload Track
                        </button>
                        <span className="text-sm">{user?.username}</span>
                        <button
                            onClick={() => {
                                logout();
                                navigate('/login');
                            }}
                            className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white border border-gray-300">
                    <div className="p-4 border-b border-gray-300 flex justify-between items-center">
                        <h2 className="font-bold">All Tracks ({tracks.length})</h2>
                        <button
                            onClick={loadTracks}
                            className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50"
                        >
                            Refresh
                        </button>
                    </div>

                    {tracks.length === 0 ? (
                        <div className="p-8 text-center text-gray-600">
                            No tracks found. Upload your first track!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-300 bg-gray-50">
                                        <th className="text-left p-3 text-sm font-medium">ID</th>
                                        <th className="text-left p-3 text-sm font-medium">Title</th>
                                        <th className="text-left p-3 text-sm font-medium">Artist</th>
                                        <th className="text-left p-3 text-sm font-medium">Album</th>
                                        <th className="text-left p-3 text-sm font-medium">Genre</th>
                                        <th className="text-right p-3 text-sm font-medium">Duration</th>
                                        <th className="text-right p-3 text-sm font-medium">Plays</th>
                                        <th className="text-right p-3 text-sm font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tracks.map((track) => (
                                        <tr key={track.track_id} className="border-b border-gray-200 hover:bg-gray-50">
                                            <td className="p-3 text-sm">{track.track_id}</td>
                                            <td className="p-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.title}
                                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 text-sm"
                                                    />
                                                ) : (
                                                    <span className="font-medium">{track.title}</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.artist}
                                                        onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 text-sm"
                                                    />
                                                ) : (
                                                    track.artist_name
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.album}
                                                        onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 text-sm"
                                                    />
                                                ) : (
                                                    track.album_title || '-'
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.genre}
                                                        onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 text-sm"
                                                    />
                                                ) : (
                                                    track.genre_top || '-'
                                                )}
                                            </td>
                                            <td className="p-3 text-right text-sm">
                                                {formatDuration(Math.floor(track.duration_sec))}
                                            </td>
                                            <td className="p-3 text-right text-sm">{track.listens}</td>
                                            <td className="p-3 text-right">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="px-3 py-1 bg-green-600 text-white hover:bg-green-700 text-sm"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="px-3 py-1 border border-gray-300 hover:bg-gray-50 text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => navigate(`/player/${track.track_id}`)}
                                                            className="px-3 py-1 bg-green-600 text-white hover:bg-green-700 text-sm"
                                                        >
                                                            Play
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(track)}
                                                            className="px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 text-sm"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(track.track_id, track.title)}
                                                            className="px-3 py-1 bg-red-600 text-white hover:bg-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
