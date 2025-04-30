import { create, StateCreator } from 'zustand';
import { loadApiKeys as loadKeysFromSecureStore } from '~/utils/apiKeyManager';
import { Platform } from 'react-native';
import { listDownloadedDbs } from '~/utils/fileDownloader';
import { scrollmapperTranslationMap, type ScrollmapperTranslationInfo } from '~/config/translationMap';
import { 
  switchActiveDatabase, 
  loadFavouritesFromDb, 
  addFavouriteToDb, 
  removeFavouriteFromDb, 
  type FavouriteVerse,
  getSettingFromDb,
  setSettingInDb,
} from '~/db/database';
import { Alert } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const SELECTED_TRANSLATION_KEY = 'selectedTranslationId';
const DEFAULT_TRANSLATION_ID = 'KJV';

export interface AppState {
  // API Keys
  openRouterApiKey: string | null;
  apiBibleApiKey: string | null; 
  apiKeysLoaded: boolean;
  apiKeysError: string | null;

  // Bible Data & Navigation
  availableTranslations: ScrollmapperTranslationInfo[]; 
  downloadedTranslationIds: string[];
  selectedTranslationId: string | null;
  currentBookId: string | null;
  currentChapterNumber: number | null;

  // Status
  isDownloading: boolean;
  downloadingTranslationId: string | null;
  downloadProgress: number;
  downloadError: string | null;
  isDbReady: boolean;

  // Favourites State
  favourites: FavouriteVerse[];
  favouritesLoading: boolean;
  favouritesError: string | null;

  // Actions
  loadApiKeys: () => Promise<void>;
  setAvailableTranslations: (translations: ScrollmapperTranslationInfo[]) => void; 
  addDownloadedTranslation: (translationId: string) => void;
  removeDownloadedTranslation: (translationId: string) => void;
  setSelectedTranslation: (translationId: string | null) => Promise<void>;
  setCurrentLocation: (bookId: string, chapterNumber: number | null) => void; 
  setDownloadStatus: (isDownloading: boolean, translationId?: string | null, progress?: number, error?: string | null) => void;
  clearDownloadStatus: () => void;
  initializeStore: () => Promise<void>;

  // Favourites Actions
  loadFavourites: () => Promise<void>;
  addFavourite: (favourite: Omit<FavouriteVerse, 'id' | 'created_at'>) => Promise<void>;
  removeFavourite: (id: number) => Promise<void>;
}

const createAppState: StateCreator<AppState> = (set, get) => ({
  // Initial State
  openRouterApiKey: null,
  apiBibleApiKey: null,
  apiKeysLoaded: false,
  apiKeysError: null,
  availableTranslations: scrollmapperTranslationMap, 
  downloadedTranslationIds: [],
  selectedTranslationId: null,
  currentBookId: null,
  currentChapterNumber: null,
  isDownloading: false,
  downloadingTranslationId: null,
  downloadProgress: 0,
  downloadError: null,
  isDbReady: false,

  favourites: [],
  favouritesLoading: false,
  favouritesError: null,

  loadApiKeys: async () => {
    console.log("[Store loadApiKeys] Attempting to load keys...");
    try {
      set({ apiKeysLoaded: false, apiKeysError: null });
      const keys = await loadKeysFromSecureStore();
      console.log(`[Store loadApiKeys] Loaded keys: ${Object.keys(keys).join(', ')}`);
      
      set({ 
        openRouterApiKey: keys.OPENROUTER || null,
        apiKeysLoaded: true 
      });
      
      console.log("[Store loadApiKeys] State updated successfully.");
    } catch (error) {
      console.error("[Store loadApiKeys] Error loading API keys into store:", error);
      set({ apiKeysError: error instanceof Error ? error.message : String(error), apiKeysLoaded: false });
    }
  },

  setAvailableTranslations: (translations) => set({ availableTranslations: translations }),

  addDownloadedTranslation: (translationId) => {
    if (!get().downloadedTranslationIds.includes(translationId)) {
      console.log(`[Store] Adding downloaded translation ID: ${translationId}`);
      set(state => ({
        downloadedTranslationIds: [...state.downloadedTranslationIds, translationId],
      }));
    } else {
      console.log(`[Store] Translation ID ${translationId} already in downloaded list.`);
    }
  },
  
  removeDownloadedTranslation: (translationId) => {
      console.log(`[Store] Removing downloaded translation ID: ${translationId}`);
      set(state => ({
        downloadedTranslationIds: state.downloadedTranslationIds.filter(id => id !== translationId),
        selectedTranslationId: state.selectedTranslationId === translationId ? null : state.selectedTranslationId,
      }));
      const newSelectedId = get().selectedTranslationId;
      setSettingInDb(SELECTED_TRANSLATION_KEY, newSelectedId ?? '')
        .catch(e => console.error("Error saving cleared selected translation:", e));
  },

  setSelectedTranslation: async (translationId) => { 
    const currentId = get().selectedTranslationId;
    if (currentId !== translationId) {
        console.log(`[Store] Setting selected translation ID: ${translationId}`);
        set({ selectedTranslationId: translationId, isDbReady: false }); 
        let success = false;
        try {
            await setSettingInDb(SELECTED_TRANSLATION_KEY, translationId ?? '');

            const state = get();
            let dbFileName: string | null = null;
            if (translationId) {
                dbFileName = state.availableTranslations.find(t => t.id === translationId)?.dbFileName ?? null;
                if (!dbFileName) {
                    console.warn(`[Store] Could not find dbFileName for selected translation ID: ${translationId}`);
                }
            }
            console.log(`[Store] Switching active database to: ${dbFileName ?? 'none'}`);
            success = await switchActiveDatabase(dbFileName);
            console.log(`[Store] switchActiveDatabase result: ${success}`);

        } catch (error) {
            console.error(`[Store] Error during setSelectedTranslation for ID ${translationId}:`, error);
            success = false;
        } finally {
            set({ isDbReady: success });
            console.log(`[Store] Final DB readiness set to: ${success}`);
        }
    }
  },

  setCurrentLocation: (bookId, chapterNumber) => set({ currentBookId: bookId, currentChapterNumber: chapterNumber }),

  setDownloadStatus: (isDownloading, translationId = null, progress = 0, error = null) => {
    const effectiveProgress = (isDownloading && progress < 1) ? progress : (isDownloading ? get().downloadProgress : progress); 
    set({
      isDownloading,
      downloadingTranslationId: isDownloading ? translationId : (error ? translationId : null), 
      downloadProgress: effectiveProgress,
      downloadError: error,
    });
  },

  clearDownloadStatus: () => set({
      isDownloading: false,
      downloadingTranslationId: null,
      downloadProgress: 0,
      downloadError: null
  }),

  loadFavourites: async () => {
    if (IS_WEB) return;
    console.log("[Store Favourites] Loading favourites...");
    set({ favouritesLoading: true, favouritesError: null });
    try {
        const loadedFavourites = await loadFavouritesFromDb();
        console.log(`[Store Favourites] Loaded ${loadedFavourites.length} favourites from DB.`);
        set({ favourites: loadedFavourites, favouritesLoading: false });
    } catch (error) {
        console.error("[Store Favourites] Error loading favourites:", error);
        set({ favouritesError: error instanceof Error ? error.message : String(error), favouritesLoading: false });
    }
  },

  addFavourite: async (favourite: Omit<FavouriteVerse, 'id' | 'created_at'>) => {
    if (IS_WEB) return;
    console.log(`[Store Favourites] Adding favourite: ${favourite.book_id} ${favourite.chapter}:${favourite.verse} (${favourite.translation_id})`);
    try {
        const newId = await addFavouriteToDb(favourite);
        if (newId) {
             await get().loadFavourites(); 
             console.log(`[Store Favourites] Favourite added successfully (ID: ${newId}). Reloaded list.`);
        } else {
             console.warn("[Store Favourites] addFavouriteToDb did not return a new ID (likely duplicate).");
        }
    } catch (error) {
        console.error("[Store Favourites] Error adding favourite:", error);
        Alert.alert("Error", "Could not save favourite.");
    }
  },

  removeFavourite: async (favouriteId) => {
    if (IS_WEB) return;
    console.log(`[Store Favourites] Removing favourite with ID: ${favouriteId}`);
    try {
        await removeFavouriteFromDb(favouriteId);
        set(state => ({ 
            favourites: state.favourites.filter(fav => fav.id !== favouriteId) 
        }));
        console.log(`[Store Favourites] Favourite removed successfully.`);
    } catch (error) {
        console.error("[Store Favourites] Error removing favourite:", error);
         Alert.alert("Error", "Could not remove favourite.");
    }
  },

  initializeStore: async () => {
    console.log("[Store Initialize] Starting...");
    set({ isDbReady: false });
    
    try {
      console.log("[Store Initialize] Attempting to load API keys...");
      await get().loadApiKeys(); 
      console.log("[Store Initialize] API keys loaded successfully (or already loaded).");
    } catch (error) {
      console.error("[Store Initialize] CRITICAL: Error during loadApiKeys! Initialization might be incomplete.", error);
    }

    console.log("[Store Initialize] Loading selectedTranslationId...");
    let storedSelectedId: string | null = null;
    try {
        storedSelectedId = await getSettingFromDb(SELECTED_TRANSLATION_KEY, '');
        if (storedSelectedId === '') storedSelectedId = null; 
        console.log(`[Store Initialize] Loaded storedSelectedId from DB: '${storedSelectedId}'`);
    } catch (e) {
        console.error("[Store Initialize] Failed to load selected translation ID from DB", e);
    }

    let actualDownloadedIds: string[] = [];
    const availableTranslations = get().availableTranslations;
    if (!IS_WEB) {
        try {
            const downloadedFiles = await listDownloadedDbs();
            console.log("[Store] Found downloaded DB files:", downloadedFiles);
            const fileAbbrMap = new Map(availableTranslations.map(t => [t.dbFileName, t.id]));
            actualDownloadedIds = downloadedFiles
                .map(filename => fileAbbrMap.get(filename))
                .filter((id): id is string => !!id);
        } catch (e) {
            console.error("[Store Initialize] Failed to list downloaded translations from file system", e);
        }
    }
    console.log(`[Store Initialize] Determined actualDownloadedIds: [${actualDownloadedIds.join(', ')}]`);

    let validatedSelectedId: string | null = null;
    const availableIds = availableTranslations.map(t => t.id);

    if (storedSelectedId) {
        const isValid = IS_WEB 
            ? availableIds.includes(storedSelectedId) 
            : actualDownloadedIds.includes(storedSelectedId);
        console.log(`[Store Initialize] Checking validity of stored ID '${storedSelectedId}': ${isValid}`);
            
        if (isValid) {
            validatedSelectedId = storedSelectedId;
            console.log(`[Store] Using valid stored selected ID: ${validatedSelectedId}`);
        } else {
            console.warn(`[Store] Stored selected ID '${storedSelectedId}' is no longer valid (not downloaded/available). Resetting.`);
            setSettingInDb(SELECTED_TRANSLATION_KEY, '')
                .catch(e => console.error("Error removing invalid selected translation:", e));
        }
    }

    if (!validatedSelectedId && !IS_WEB && actualDownloadedIds.length > 0) {
        validatedSelectedId = actualDownloadedIds[0];
        console.log(`[Store] No valid stored ID, falling back to first downloaded: ${validatedSelectedId}`);
        setSettingInDb(SELECTED_TRANSLATION_KEY, validatedSelectedId)
            .catch(e => console.error("Error saving fallback selected translation:", e));
    }
    
    if (!validatedSelectedId && availableIds.includes(DEFAULT_TRANSLATION_ID)) {
        const kjvIsAvailable = IS_WEB || actualDownloadedIds.includes(DEFAULT_TRANSLATION_ID);
        if (kjvIsAvailable) {
            validatedSelectedId = DEFAULT_TRANSLATION_ID;
            console.log(`[Store] No valid stored/downloaded ID, falling back to default ${DEFAULT_TRANSLATION_ID}`);
            setSettingInDb(SELECTED_TRANSLATION_KEY, validatedSelectedId)
                .catch(e => console.error("Error saving default selected translation:", e));
        } else {
             console.log(`[Store] Default ${DEFAULT_TRANSLATION_ID} is available but not downloaded, cannot select.`);
        }
    }

    console.log(`[Store Initialize] Final validatedSelectedId before setting state: '${validatedSelectedId}'`);

    console.log(`[Store Initialize] Setting final initial state - Selected ID: ${validatedSelectedId}, Downloaded IDs: ${actualDownloadedIds.join(', ')}`);
    set({
      selectedTranslationId: validatedSelectedId,
      downloadedTranslationIds: actualDownloadedIds,
      isDownloading: false, 
      downloadingTranslationId: null,
      downloadProgress: 0,
      downloadError: null,
    });

    let success = false;
    try {
      let initialDbFileName: string | null = null;
      if (validatedSelectedId) {
          initialDbFileName = availableTranslations.find(t => t.id === validatedSelectedId)?.dbFileName ?? null;
          if (!initialDbFileName) {
              console.warn(`[Store Initialize] Could not find dbFileName for initial selected translation ID: ${validatedSelectedId}`);
          }
      }
      console.log(`[Store Initialize] Initializing active database with filename: ${initialDbFileName ?? 'none'}`);
      success = await switchActiveDatabase(initialDbFileName);
      console.log(`[Store] Initial switchActiveDatabase result: ${success}`);
    } catch (error) {
        console.error(`[Store] Error initializing active database for ID ${validatedSelectedId}:`, error);
        success = false;
        set({ selectedTranslationId: null }); 
        setSettingInDb(SELECTED_TRANSLATION_KEY, '')
            .catch(e => console.error("Error clearing selected translation after DB init failure:", e));
        try {
            await switchActiveDatabase(null); 
        } catch (closeError) {
            console.error("[Store] Error trying to close DB after init failure:", closeError);
        }
    } finally {
        set({ isDbReady: success });
        console.log(`[Store] Initial DB readiness set to: ${success}`);
    }

    if (!IS_WEB) {
      console.log("[Store Initialize] Triggering initial favourites load...");
      get().loadFavourites();
    }

    console.log("[Store] Initialization complete.");
  },
});

export const useAppStore = create<AppState>(createAppState);