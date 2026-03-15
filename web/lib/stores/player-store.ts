import { create } from "zustand"

export type PlayerTrack = {
  track_id: number
  title: string | null
  artist_name: string | null
  cover_image_url: string | null
}

type PlayerState = {
  queue: PlayerTrack[]
  currentIndex: number
  isVisible: boolean
  playVersion: number
  setQueueAndPlay: (tracks: PlayerTrack[], startIndex: number) => void
  playSingle: (track: PlayerTrack) => void
  nextTrack: () => void
  previousTrack: () => void
  closePlayer: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isVisible: false,
  playVersion: 0,

  setQueueAndPlay: (tracks, startIndex) => {
    if (!tracks.length) return
    const safeIndex = Math.max(0, Math.min(startIndex, tracks.length - 1))
    set((state) => ({
      queue: tracks,
      currentIndex: safeIndex,
      isVisible: true,
      playVersion: state.playVersion + 1,
    }))
  },

  playSingle: (track) => {
    set((state) => ({
      queue: [track],
      currentIndex: 0,
      isVisible: true,
      playVersion: state.playVersion + 1,
    }))
  },

  nextTrack: () => {
    const { queue, currentIndex } = get()
    if (!queue.length) return
    set((state) => ({
      currentIndex: (currentIndex + 1) % queue.length,
      playVersion: state.playVersion + 1,
    }))
  },

  previousTrack: () => {
    const { queue, currentIndex } = get()
    if (!queue.length) return
    set((state) => ({
      currentIndex: currentIndex === 0 ? queue.length - 1 : currentIndex - 1,
      playVersion: state.playVersion + 1,
    }))
  },

  closePlayer: () => {
    set({ isVisible: false })
  },
}))
