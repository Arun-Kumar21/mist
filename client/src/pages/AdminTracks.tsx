import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { tracksApi, adminApi } from '../lib/api';
import type { Track } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getGradient } from '@/lib/gradient';
import { Play, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';

export default function AdminTracks() {
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
            <div className="flex items-center justify-center py-32">
                <div className="flex items-center gap-2 text-neutral-400">
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-200 border-t-black animate-spin" />
                    <span className="text-sm">Loading tracks…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Manage Tracks</h1>
                    <p className="text-sm text-neutral-500">{tracks.length} track{tracks.length !== 1 ? 's' : ''} in library</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadTracks}>
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => navigate('/admin/upload')}>Upload Track</Button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
            )}

            {tracks.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 p-12 text-center text-neutral-500 text-sm">
                    No tracks yet. <button onClick={() => navigate('/admin/upload')} className="underline">Upload your first track</button>.
                </div>
            ) : (
                <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/70">
                                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide w-10"></th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Title</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Artist</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Album</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Genre</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Dur.</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Plays</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                    {tracks.map((track) => (
                                        <tr key={track.track_id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: getGradient(track.track_id) }} />
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <Input
                                                        value={editForm.title}
                                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                        className="h-7 text-xs min-w-30"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">{track.title}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <Input
                                                        value={editForm.artist}
                                                        onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                                                        className="h-7 text-xs min-w-25"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-neutral-600">{track.artist_name}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <Input
                                                        value={editForm.album}
                                                        onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                                                        className="h-7 text-xs min-w-25"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-neutral-500">{track.album_title || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <Input
                                                        value={editForm.genre}
                                                        onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                                                        className="h-7 text-xs min-w-20"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-neutral-500">{track.genre_top || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-neutral-500">
                                                {formatDuration(Math.floor(track.duration_sec))}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-neutral-500">{track.listens}</td>
                                            <td className="px-4 py-3">
                                                {editingTrack?.track_id === track.track_id ? (
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button size="sm" onClick={handleSaveEdit} className="h-7 px-2.5">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 px-2.5">
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button size="sm" variant="ghost" onClick={() => navigate(`/player/${track.track_id}`)} className="h-7 px-2.5">
                                                            <Play className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(track)} className="h-7 px-2.5">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(track.track_id, track.title)} className="h-7 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                    </div>
                </div>
            )}
        </div>
    );
}
