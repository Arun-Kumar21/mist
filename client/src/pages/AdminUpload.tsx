import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { uploadApi } from '../lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, RotateCcw, ArrowLeft } from 'lucide-react';

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
        <div className="max-w-lg space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/admin/tracks')} className="text-neutral-400 hover:text-black transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Upload Track</h1>
                    <p className="text-sm text-neutral-500">Add a new track to the library</p>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            {success && (
                <div className="p-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm">{success}</div>
            )}

            {uploading && jobStatus && (
                <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-700 font-medium">{getStatusMessage()}</span>
                        {uploadProgress > 0 && <span className="text-neutral-400">{uploadProgress}%</span>}
                    </div>
                    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-black rounded-full transition-all duration-300"
                            style={{ width: jobStatus === 'processing' ? '100%' : `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
                {/* File picker */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Audio File <span className="text-red-400">*</span></label>
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                        file ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                    } ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                        <Upload className="w-5 h-5 text-neutral-400" />
                        {file ? (
                            <span className="text-sm text-black font-medium text-center">
                                {file.name}
                                <span className="block text-xs text-neutral-400 font-normal">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </span>
                        ) : (
                            <span className="text-sm text-neutral-500">Click to select an audio file</span>
                        )}
                        <input type="file" accept="audio/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Title <span className="text-red-400">*</span></label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={uploading} placeholder="Track title" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Artist <span className="text-red-400">*</span></label>
                        <Input value={artist} onChange={(e) => setArtist(e.target.value)} required disabled={uploading} placeholder="Artist name" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Album</label>
                        <Input value={album} onChange={(e) => setAlbum(e.target.value)} disabled={uploading} placeholder="Album title" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Genre</label>
                        <Input value={genre} onChange={(e) => setGenre(e.target.value)} disabled={uploading} placeholder="e.g. Jazz, Rock" />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={uploading || !file} className="flex-1">
                        {uploading ? 'Uploading…' : 'Upload Track'}
                    </Button>
                    {!uploading && (file || title || artist || album || genre) && (
                        <Button type="button" variant="outline" onClick={resetForm}>
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
