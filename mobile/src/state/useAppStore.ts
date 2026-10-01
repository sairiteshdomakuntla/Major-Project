import { create } from 'zustand';

interface AppState {
  /** Last known backend connectivity: 'idle' | 'connecting' | 'connected' | 'failed' */
  connectivity: 'idle' | 'connecting' | 'connected' | 'failed';
  lastHealthResponse: string | null;
  setConnectivity: (s: AppState['connectivity']) => void;
  setLastHealthResponse: (s: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  connectivity: 'idle',
  lastHealthResponse: null,
  setConnectivity: (connectivity) => set({ connectivity }),
  setLastHealthResponse: (lastHealthResponse) => set({ lastHealthResponse }),
}));
