import apiClient from "@/lib/api/client"
import { useAuthStore } from "@/lib/stores/auth-store"

export type Banner = {
  banner_id: number
  title: string | null
  subtitle: string | null
  image_url: string | null
  link_url: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type BannerListResponse = {
  success: boolean
  count: number
  banners: Banner[]
}

function authHeaders() {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getActiveBanners(): Promise<Banner[]> {
  const { data } = await apiClient.get<BannerListResponse>("/banners")
  return data.banners
}

export async function getAllBanners(): Promise<Banner[]> {
  const { data } = await apiClient.get<BannerListResponse>("/banners/all", {
    headers: authHeaders(),
  })
  return data.banners
}

export async function createBanner(payload: {
  image: File
  title?: string
  subtitle?: string
  link_url?: string
  display_order?: number
  is_active?: boolean
}): Promise<Banner> {
  const form = new FormData()
  form.append("image", payload.image)
  if (payload.title !== undefined) form.append("title", payload.title)
  if (payload.subtitle !== undefined) form.append("subtitle", payload.subtitle)
  if (payload.link_url !== undefined) form.append("link_url", payload.link_url)
  if (payload.display_order !== undefined) form.append("display_order", String(payload.display_order))
  if (payload.is_active !== undefined) form.append("is_active", String(payload.is_active))

  const { data } = await apiClient.post<{ success: boolean; banner: Banner }>("/banners", form, {
    headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
  })
  return data.banner
}

export async function updateBanner(
  bannerId: number,
  payload: Partial<Pick<Banner, "title" | "subtitle" | "link_url" | "display_order" | "is_active">>
): Promise<Banner> {
  const { data } = await apiClient.put<{ success: boolean; banner: Banner }>(
    `/banners/${bannerId}`,
    payload,
    { headers: authHeaders() }
  )
  return data.banner
}

export async function replaceBannerImage(bannerId: number, image: File): Promise<Banner> {
  const form = new FormData()
  form.append("image", image)
  const { data } = await apiClient.put<{ success: boolean; banner: Banner }>(
    `/banners/${bannerId}/image`,
    form,
    { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } }
  )
  return data.banner
}

export async function deleteBanner(bannerId: number): Promise<void> {
  await apiClient.delete(`/banners/${bannerId}`, { headers: authHeaders() })
}
