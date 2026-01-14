import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { uploadApi } from '../lib/api';

export default function AdminUpload() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [genre, setGenre] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Redirect if not admin
    useEffect(() => {
        if (user?.role !== 'admin') {
            navigate('/');
        }
    }, [user, navigate]);

    // Poll job status when we have a jobId
    useEffect(() => {
        if (!jobId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await uploadApi.getJobStatus(jobId);
                setJobStatus(response.data.status);

                if (response.data.status === 'completed') {
                    setSuccess('Upload completed successfully!');
                    clearInterval(pollInterval);
                    setJobId(null); // Clear jobId to stop polling
                    // Reset form
                    setTimeout(() => {
                        resetForm();
                    }, 2000);
                } else if (response.data.status === 'failed') {
                    setError(response.data.error || 'Upload failed');
                    clearInterval(pollInterval);
                    setJobId(null); // Clear jobId to stop polling
                    setUploading(false);
                }
            } catch (err) {
                console.error('Error polling job status:', err);
            }
        }, 2000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [jobId]);

    const resetForm = () => {
        setFile(null);
        setTitle('');
        setArtist('');
        setAlbum('');
        setGenre('');
        setUploading(false);
        setUploadProgress(0);
        setJobId(null);
        setJobStatus(null);
        setError('');
        setSuccess('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Validate file type
            if (!selectedFile.type.startsWith('audio/')) {
                setError('Please select a valid audio file');
                return;
            }
            setFile(selectedFile);
            setError('');

            // Auto-fill title from filename if empty
            if (!title && selectedFile.name) {
                const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
                setTitle(nameWithoutExt);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file');
            return;
        }

        if (!title || !artist) {
            setError('Title and artist are required');
            return;
        }

        setError('');
        setSuccess('');
        setUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: Request upload URL
            const uploadRequest = await uploadApi.requestUpload({
                filename: file.name,
                filesize: file.size,
                contentType: file.type,
                metadata: {
                    title,
                    artist,
                    album,
                    genre,
                },
            });

            const { jobId: newJobId, uploadUrl, fields } = uploadRequest.data;
            setJobId(newJobId);
            setJobStatus('pending_upload');

            // Step 2: Upload to S3 using presigned URL
            const formData = new FormData();

            // Add all fields from presigned post
            Object.entries(fields).forEach(([key, value]) => {
                formData.append(key, value as string);
            });

            // File must be last
            formData.append('file', file);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error('S3 upload failed');
            }

            setUploadProgress(100);
            setJobStatus('uploaded');

            // Step 3: Notify server that upload is complete
            await uploadApi.completeUpload({
                jobId: newJobId,
                metadata: {
                    title,
                    artist,
                    album,
                    genre,
                },
            });

            setJobStatus('processing');
            // Job status polling will take over from here

        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.response?.data?.detail || err.message || 'Upload failed');
            setUploading(false);
        }
    };

    const getStatusMessage = () => {
        switch (jobStatus) {
            case 'pending_upload':
                return 'Preparing upload...';
            case 'uploaded':
                return 'File uploaded, starting processing...';
            case 'processing':
                return 'Processing audio file...';
            case 'completed':
                return 'Upload completed successfully!';
            case 'failed':
                return 'Upload failed';
            default:
                return '';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-300 p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold">Upload Track</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                <div className="bg-white border border-gray-300 p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 text-sm">
                            {success}
                        </div>
                    )}

                    {uploading && jobStatus && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-300">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{getStatusMessage()}</span>
                                <span className="text-sm">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 h-2">
                                <div
                                    className="bg-blue-600 h-2 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Audio File <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={handleFileChange}
                                disabled={uploading}
                                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
                            />
                            {file && (
                                <p className="text-xs text-gray-600 mt-1">
                                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                disabled={uploading}
                                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Artist <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                required
                                disabled={uploading}
                                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Album</label>
                            <input
                                type="text"
                                value={album}
                                onChange={(e) => setAlbum(e.target.value)}
                                disabled={uploading}
                                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Genre</label>
                            <input
                                type="text"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                disabled={uploading}
                                placeholder="e.g., Pop, Rock, Jazz"
                                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={uploading || !file}
                                className="flex-1 py-2 px-4 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                {uploading ? 'Uploading...' : 'Upload Track'}
                            </button>

                            {!uploading && (file || title || artist || album || genre) && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 border border-gray-300 hover:bg-gray-50"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
