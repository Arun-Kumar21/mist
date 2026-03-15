import apiClient from "@/lib/api/client"
import { getAuthToken } from "@/lib/api/auth"

export type StreamInfo = {
  success: boolean
  trackId: number
  streamUrl: string
  keyEndpoint: string
  duration: number
  encrypted: boolean
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getTrackStreamInfo(trackId: number) {
  const { data } = await apiClient.get<StreamInfo>(`/tracks/${trackId}/stream`, {
    headers: authHeaders(),
  })
  return data
}

export async function startListeningSession(trackId: number) {
  const { data } = await apiClient.post(
    "/listen/start",
    { track_id: trackId },
    { headers: authHeaders() }
  )
  return data
}

export async function sendListeningHeartbeat(sessionId: number, currentTime: number) {
  const { data } = await apiClient.post(
    "/listen/heartbeat",
    { session_id: sessionId, current_time: currentTime },
    { headers: authHeaders() }
  )
  return data
}

export async function completeListeningSession(sessionId: number, totalDuration: number) {
  const { data } = await apiClient.post(
    "/listen/complete",
    { session_id: sessionId, total_duration: totalDuration },
    { headers: authHeaders() }
  )
  return data
}

export async function getTrackLikeStatus(trackId: number) {
  const { data } = await apiClient.get(`/library/likes/${trackId}/status`, {
    headers: authHeaders(),
  })
  return data as { success: boolean; track_id: number; liked: boolean }
}

export async function likeTrack(trackId: number) {
  const { data } = await apiClient.post(`/library/likes/${trackId}`, null, {
    headers: authHeaders(),
  })
  return data
}

export async function unlikeTrack(trackId: number) {
  const { data } = await apiClient.delete(`/library/likes/${trackId}`, {
    headers: authHeaders(),
  })
  return data
}
