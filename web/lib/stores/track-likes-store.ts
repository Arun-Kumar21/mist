import { create } from "zustand"

type TrackLikesState = {
  likes: Record<number, boolean>
  setLikeStatus: (trackId: number, liked: boolean) => void
  setManyLikeStatuses: (entries: Array<[number, boolean]>) => void
  clearLikes: () => void
}

export const useTrackLikesStore = create<TrackLikesState>((set) => ({
  likes: {},
  setLikeStatus: (trackId, liked) =>
    set((state) => ({
      likes: {
        ...state.likes,
        [trackId]: liked,
      },
    })),
  setManyLikeStatuses: (entries) =>
    set((state) => ({
      likes: {
        ...state.likes,
        ...Object.fromEntries(entries),
      },
    })),
  clearLikes: () => set({ likes: {} }),
}))
