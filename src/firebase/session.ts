import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Whether the user chose to use the app without an account on this device. */
export const useSession = create<{ localMode: boolean; setLocalMode: (v: boolean) => void }>()(
  persist((set) => ({ localMode: false, setLocalMode: (localMode) => set({ localMode }) }), { name: 'micenae:session' }),
);
