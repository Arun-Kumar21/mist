import apiClient from "@/lib/api/client"
import { useAuthStore } from "@/lib/stores/auth-store"

function authHeaders() {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Track types ──────────────────────────────────────────────────────────────

export type AdminTrack = {
  track_id: number
  title: string | null
  artist_name: string | null
  album_title: string | null
  genre_top: string | null
  cover_image_url: string | null
  cdn_url: string | null
  duration_sec: number | null
  listens: number | null
  interest: number | null
  is_featured_home: boolean
  home_feature_score: number
  processing_status: string | null
  created_at: string | null
}

export type TracksResponse = {
  success: boolean
  count: number
  tracks: AdminTrack[]
}

export type UpdateTrackPayload = {
  title?: string
  artist_name?: string
  album_title?: string
  genre_top?: string
  cover_image_url?: string
  is_featured_home?: boolean
  home_feature_score?: number
}

// ─── Track endpoints ──────────────────────────────────────────────────────────

export async function adminGetTracks(limit = 100, skip = 0): Promise<TracksResponse> {
  const { data } = await apiClient.get<TracksResponse>("/tracks", {
    params: { limit, skip },
    headers: authHeaders(),
  })
  return data
}

export async function adminUpdateTrack(trackId: number, payload: UpdateTrackPayload): Promise<AdminTrack> {
  const { data } = await apiClient.put<{ success: boolean; track: AdminTrack }>(
    `/tracks/${trackId}`,
    payload,
    { headers: authHeaders() }
  )
  return data.track
}

export async function adminDeleteTrack(trackId: number): Promise<void> {
  await apiClient.delete(`/tracks/${trackId}`, { headers: authHeaders() })
}

export async function adminUpdateTrackCover(trackId: number, image: File): Promise<AdminTrack> {
  const form = new FormData()
  form.append("image", image)
  const { data } = await apiClient.put<{ success: boolean; track: AdminTrack }>(
    `/tracks/${trackId}/cover-image`,
    form,
    { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } }
  )
  return data.track
}

// ─── Curation types ───────────────────────────────────────────────────────────

export type CurationEntry = {
  track_id: number
  display_order: number
  is_active: boolean
  title: string | null
  artist_name: string | null
  cover_image_url: string | null
  genre_top: string | null
}

type RawCurationRow = {
  curation?: {
    track_id?: number
    display_order?: number
    is_active?: boolean
  }
  track?: {
    track_id?: number
    title?: string | null
    artist_name?: string | null
    cover_image_url?: string | null
    genre_top?: string | null
  }
  track_id?: number
  display_order?: number
  is_active?: boolean
  title?: string | null
  artist_name?: string | null
  cover_image_url?: string | null
  genre_top?: string | null
}

function normalizeCurationEntry(row: RawCurationRow): CurationEntry {
  const trackId = row.curation?.track_id ?? row.track?.track_id ?? row.track_id ?? 0

  return {
    track_id: Number(trackId),
    display_order: row.curation?.display_order ?? row.display_order ?? 0,
    is_active: row.curation?.is_active ?? row.is_active ?? true,
    title: row.track?.title ?? row.title ?? null,
    artist_name: row.track?.artist_name ?? row.artist_name ?? null,
    cover_image_url: row.track?.cover_image_url ?? row.cover_image_url ?? null,
    genre_top: row.track?.genre_top ?? row.genre_top ?? null,
  }
}

// ─── Curation endpoints ───────────────────────────────────────────────────────

export async function getCurationTopPicks(activeOnly = false): Promise<CurationEntry[]> {
  const { data } = await apiClient.get<{ success: boolean; tracks: RawCurationRow[] }>(
    "/curation/top-picks",
    { params: { active_only: activeOnly }, headers: authHeaders() }
  )
  return data.tracks
    .map(normalizeCurationEntry)
    .filter((entry) => Number.isFinite(entry.track_id) && entry.track_id > 0)
}

export async function addTopPick(trackId: number, displayOrder = 0, isActive = true): Promise<CurationEntry> {
  const { data } = await apiClient.post<{ success: boolean; curation: CurationEntry }>(
    "/curation/top-picks",
    { track_id: trackId, display_order: displayOrder, is_active: isActive },
    { headers: authHeaders() }
  )
  return data.curation
}

export async function updateTopPick(trackId: number, displayOrder: number, isActive: boolean): Promise<CurationEntry> {
  const { data } = await apiClient.put<{ success: boolean; curation: CurationEntry }>(
    `/curation/top-picks/${trackId}`,
    { display_order: displayOrder, is_active: isActive },
    { headers: authHeaders() }
  )
  return data.curation
}

export async function removeTopPick(trackId: number): Promise<void> {
  await apiClient.delete(`/curation/top-picks/${trackId}`, { headers: authHeaders() })
}

// ─── Upload flow (admin) ──────────────────────────────────────────────────────

export type UploadRequestResponse = {
  success: boolean
  jobId: string
  uploadUrl: string
  fields: Record<string, string>
  s3Key: string
  expiresIn: number
}

export async function requestUpload(payload: {
  filename: string
  filesize: number
  contentType: string
  metadata?: Record<string, unknown>
}): Promise<UploadRequestResponse> {
  const { data } = await apiClient.post<UploadRequestResponse>(
    "/upload/request",
    payload,
    { headers: authHeaders() }
  )
  return data
}

export async function completeUpload(jobId: string, metadata: Record<string, unknown>): Promise<void> {
  await apiClient.post(
    "/upload/complete",
    { jobId, metadata },
    { headers: authHeaders() }
  )
}

export type UploadJobResponse = {
  jobId: string
  status: string
  createdAt?: string | null
  completedAt?: string | null
  error?: string
  track?: AdminTrack
}

export async function getUploadJob(jobId: string): Promise<UploadJobResponse> {
  const { data } = await apiClient.get<UploadJobResponse>(`/upload/job/${jobId}`, { headers: authHeaders() })
  return data
}
