import { create, StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { loadApiKeys as loadKeysFromSecureStore } from '~/utils/apiKeyManager';
import { type ApiBibleTranslation } from '~/services/apiBible'; // Assuming interface is exported
import * as db from '~/db/database'; // Import db helpers
import { Platform } from 'react-native'; // Import Platform

const IS_WEB = Platform.OS === 'web';
const SELECTED_TRANSLATION_KEY = 'selectedTranslationId';
const DEFAULT_TRANSLATION_ID = 'de4e12af7f28f599-01'; // KJV as a fallback

// Define the state structure
export interface AppState {
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
  downloadingTranslationId: string | null; // Added: ID of the translation being downloaded
  downloadProgress: number; // e.g., 0-1
  downloadError: string | null;

  // Actions (functions to modify state)
  loadApiKeys: () => Promise<void>;
  setAvailableTranslations: (translations: ApiBibleTranslation[]) => void;
  addDownloadedTranslation: (translationId: string) => void;
  setSelectedTranslation: (translationId: string) => Promise<void>;
  setCurrentLocation: (bookId: string, chapterId: string) => void;
  setDownloadStatus: (isDownloading: boolean, translationId?: string | null, progress?: number, error?: string | null) => void;
  clearDownloadStatus: () => void;
  // Add more actions as needed
}

// Define the creator function with the explicit type
const createAppState: StateCreator<AppState> = (set, get) => ({
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
  downloadingTranslationId: null, // Added initial state
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

  setSelectedTranslation: async (translationId) => {
    set({ selectedTranslationId: translationId });
    try {
      await AsyncStorage.setItem(SELECTED_TRANSLATION_KEY, translationId);
    } catch (error) {
      console.error("Error saving selected translation:", error);
    }
  },

  setCurrentLocation: (bookId, chapterId) => set({ currentBookId: bookId, currentChapterId: chapterId }),

  setDownloadStatus: (isDownloading, translationId = null, progress = 0, error = null) => {
    set({
      isDownloading,
      downloadingTranslationId: isDownloading ? translationId : null,
      downloadProgress: isDownloading ? progress : 0,
      downloadError: isDownloading ? error : null,
    });
  },

  clearDownloadStatus: () => set({
      isDownloading: false,
      downloadingTranslationId: null, // Clear ID as well
      downloadProgress: 0,
      downloadError: null
  }),
});

// Create the Zustand store by invoking the result of create<AppState>()
export const useAppStore = create<AppState>()(createAppState);

// Optional: Function to initialize parts of the store (e.g., loading keys, saved preferences)
// This could be called once when the app loads (e.g., in RootLayout)
export const initializeStore = async () => {
  console.log("Initializing store state...");
  // 1. Load API Keys
  await useAppStore.getState().loadApiKeys();
  
  // 2. Load persisted preferences (selected translation)
  let storedSelectedId: string | null = null;
  try {
      storedSelectedId = await AsyncStorage.getItem(SELECTED_TRANSLATION_KEY);
  } catch (e) {
      console.error("Failed to load selected translation ID from AsyncStorage", e);
  }

  // 3. Load downloaded translations (Native Only)
  let downloadedIds: string[] = [];
  if (!IS_WEB) {
      try {
          const downloaded = await db.all<{ id: string }>(
              "SELECT id FROM translations WHERE downloaded = 1"
          );
          downloadedIds = downloaded.map(t => t.id);
      } catch (e) {
          console.error("Failed to load downloaded translations from DB", e);
          // Proceed without downloaded list if DB fails initially?
      }
  }

  // 4. Set initial state based on loaded data
  useAppStore.setState(state => {
      const initialSelectedId = storedSelectedId ?? 
                               (downloadedIds.length > 0 ? downloadedIds[0] : DEFAULT_TRANSLATION_ID);
      return {
          ...state, // Keep existing state like API keys
          downloadedTranslationIds: downloadedIds,
          selectedTranslationId: initialSelectedId,
      };
  });

  console.log(`Store initialized. Selected ID: ${useAppStore.getState().selectedTranslationId}`);
  console.log(`Downloaded IDs: ${JSON.stringify(useAppStore.getState().downloadedTranslationIds)}`);
  // TODO: Load last location (book/chapter) from AsyncStorage/DB
}; 