// lib/azureVisemeStore.ts

import { create } from 'zustand';
import { VisemeData } from './types';

interface AzureVisemeState {
  visemes: VisemeData[];
  addViseme: (viseme: VisemeData) => void;
  clearVisemes: () => void;
}

export const useAzureVisemeStore = create<AzureVisemeState>((set) => ({
  visemes: [],
  addViseme: (viseme) =>
    set((state) => ({
      visemes: [...state.visemes, viseme],
    })),
  clearVisemes: () => set({ visemes: [] }),
}));
