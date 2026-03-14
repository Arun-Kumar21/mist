import axios from "axios"

import apiClient from "@/lib/api/client"
import { useAuthStore, type AuthUser } from "@/lib/stores/auth-store"

export type AuthResponse = {
  token: string
  type: "bearer"
  user_id: string
  email: string
  username: string
  role: string
}

export type RegisterPayload = {
  email: string
  username: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
}

function persistAuthSession(response: AuthResponse) {
  const user: AuthUser = {
    user_id: response.user_id,
    email: response.email,
    username: response.username,
    role: response.role,
  }

  useAuthStore.getState().setSession({
    token: response.token,
    user,
  })
}

export async function registerWithEmail(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", payload)
  persistAuthSession(data)
  return data
}

export async function loginWithEmail(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload)
  persistAuthSession(data)
  return data
}

export function clearAuthSession() {
  useAuthStore.getState().clearSession()
}

export function getAuthToken() {
  return useAuthStore.getState().token
}

export function getApiErrorMessage(error: unknown, fallbackMessage = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail
    if (detail) {
      return detail
    }

    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}
