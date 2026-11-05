import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  notificationsOpen: boolean
  setSidebar: (open: boolean) => void
  setNotifications: (open: boolean) => void
  toggleNotifications: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  notificationsOpen: false,
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  setNotifications: (notificationsOpen) => set({ notificationsOpen }),
  toggleNotifications: () =>
    set((state) => ({ notificationsOpen: !state.notificationsOpen, sidebarOpen: false })),
}))
