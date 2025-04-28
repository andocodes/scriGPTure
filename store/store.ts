import { create } from 'zustand';
import { loadApiKeys as loadKeysFromSecureStore } from '~/utils/apiKeyManager';
import { type ApiBibleTranslation } from '~/services/apiBible'; // Assuming interface is exported

// Define the state structure
interface AppState {
  // API Keys
  openRouterApiKey: string | null;
  apiBibleApiKey: string | null;
  apiKeysLoaded: boolean;
  apiKeysError: string | null;

  // Bible Data & Navigation
  availableTranslations: ApiBibleTranslation[]; // Translations available from API
  downloadedTranslationIds: string[]; // IDs of translations stored locally
  selectedTranslationId: string | null; // ID of the currently active translation
  currentBookId: string | null; // e.g., 'GEN'
  currentChapterId: string | null; // e.g., 'GEN.1'
  // Add more navigation state as needed (e.g., currentVerseId, scroll position)

  // Status
  isDownloading: boolean;
  downloadProgress: number; // e.g., 0-1
  downloadError: string | null;

  // Actions (functions to modify state)
  loadApiKeys: () => Promise<void>;
  setAvailableTranslations: (translations: ApiBibleTranslation[]) => void;
  addDownloadedTranslation: (translationId: string) => void;
  setSelectedTranslation: (translationId: string) => void;
  setCurrentLocation: (bookId: string, chapterId: string) => void;
  setDownloadStatus: (isDownloading: boolean, progress?: number, error?: string | null) => void;
  clearDownloadStatus: () => void;
  // Add more actions as needed
}

// Create the Zustand store
export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  openRouterApiKey: null,
  apiBibleApiKey: null,
  apiKeysLoaded: false,
  apiKeysError: null,
  availableTranslations: [],
  downloadedTranslationIds: [], // Should potentially be loaded from DB on init
  selectedTranslationId: null, // Should be loaded from DB/settings or default
  currentBookId: null, // Default to Genesis?
  currentChapterId: null, // Default to Gen 1?
  isDownloading: false,
  downloadProgress: 0,
  downloadError: null,

  // Actions Implementation
  loadApiKeys: async () => {
    try {
      set({ apiKeysLoaded: false, apiKeysError: null });
      const { openRouterKey, apiBibleKey } = await loadKeysFromSecureStore();
      set({ openRouterApiKey: openRouterKey, apiBibleApiKey: apiBibleKey, apiKeysLoaded: true });
    } catch (error) {
      console.error("Error loading API keys into store:", error);
      set({ apiKeysError: error instanceof Error ? error.message : String(error), apiKeysLoaded: false });
    }
  },

  setAvailableTranslations: (translations) => set({ availableTranslations: translations }),

  addDownloadedTranslation: (translationId) => {
    if (!get().downloadedTranslationIds.includes(translationId)) {
      set(state => ({
        downloadedTranslationIds: [...state.downloadedTranslationIds, translationId],
      }));
    }
  },

  setSelectedTranslation: (translationId) => set({ selectedTranslationId: translationId }),

  setCurrentLocation: (bookId, chapterId) => set({ currentBookId: bookId, currentChapterId: chapterId }),

  setDownloadStatus: (isDownloading, progress = 0, error = null) => {
    set({
      isDownloading,
      downloadProgress: isDownloading ? progress : 0,
      downloadError: isDownloading ? error : null, // Clear error if starting download
    });
  },

  clearDownloadStatus: () => set({ isDownloading: false, downloadProgress: 0, downloadError: null }),
}));

// Optional: Function to initialize parts of the store (e.g., loading keys, saved preferences)
// This could be called once when the app loads (e.g., in RootLayout)
export const initializeStore = async () => {
  await useAppStore.getState().loadApiKeys();
  // TODO: Load downloadedTranslationIds from DB
  // TODO: Load selectedTranslationId from AsyncStorage/DB
  // TODO: Load last location (book/chapter) from AsyncStorage/DB
}; 