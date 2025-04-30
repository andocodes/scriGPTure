import { create, StateCreator } from 'zustand';
import { loadApiKeys as loadKeysFromSecureStore } from '~/utils/apiKeyManager';
import { Platform } from 'react-native';
import { listDownloadedDbs } from '~/utils/fileDownloader';
import { scrollmapperTranslationMap, type ScrollmapperTranslationInfo } from '~/config/translationMap'; // Import our map
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
// Use the scrollmapper abbr as default ID now
const DEFAULT_TRANSLATION_ID = 'KJV';

// Define the state structure
export interface AppState {
  // API Keys
  openRouterApiKey: string | null;
  // Keep apiBibleApiKey for potential web use or future re-integration
  apiBibleApiKey: string | null; 
  apiKeysLoaded: boolean;
  apiKeysError: string | null;

  // Bible Data & Navigation
  availableTranslations: ScrollmapperTranslationInfo[]; 
  downloadedTranslationIds: string[]; // IDs (abbr) of translations with downloaded .db files
  selectedTranslationId: string | null; // ID (abbr) of the currently active translation
  currentBookId: string | null; // e.g., 'GEN'
  // Chapter ID will likely become chapter number based on DB refactor
  currentChapterNumber: number | null; // e.g., 1 
  // Add more navigation state as needed (e.g., currentVerseId, scroll position)

  // Status
  isDownloading: boolean;
  downloadingTranslationId: string | null; // ID (abbr) of the translation being downloaded
  downloadProgress: number; // e.g., 0-1
  downloadError: string | null;
  // --- Add DB Status ---
  isDbReady: boolean; // Flag to indicate if the active DB matches the selected ID and is ready

  // --- Favourites State ---
  favourites: FavouriteVerse[];
  favouritesLoading: boolean;
  favouritesError: string | null;

  // Actions (functions to modify state)
  loadApiKeys: () => Promise<void>;
  // Update type for setting available translations
  setAvailableTranslations: (translations: ScrollmapperTranslationInfo[]) => void; 
  addDownloadedTranslation: (translationId: string) => void;
  // Add action to remove a downloaded translation
  removeDownloadedTranslation: (translationId: string) => void;
  setSelectedTranslation: (translationId: string | null) => Promise<void>; // Allow setting to null
  // Update location setting
  setCurrentLocation: (bookId: string, chapterNumber: number | null) => void; 
  setDownloadStatus: (isDownloading: boolean, translationId?: string | null, progress?: number, error?: string | null) => void;
  clearDownloadStatus: () => void;
  initializeStore: () => Promise<void>; // Add initializeStore to actions

  // --- Favourites Actions ---
  loadFavourites: () => Promise<void>;
  addFavourite: (favourite: Omit<FavouriteVerse, 'id' | 'created_at'>) => Promise<void>;
  removeFavourite: (id: number) => Promise<void>; // Use DB id
}

// Define the creator function with the explicit type
const createAppState: StateCreator<AppState> = (set, get) => ({
  // Initial State
  openRouterApiKey: null,
  apiBibleApiKey: null,
  apiKeysLoaded: false,
  apiKeysError: null,
  // Initialize with the map from config
  availableTranslations: scrollmapperTranslationMap, 
  downloadedTranslationIds: [], // Will be loaded by initializeStore
  selectedTranslationId: null, // Will be loaded by initializeStore
  currentBookId: null,
  currentChapterNumber: null, // Changed from chapterId
  isDownloading: false,
  downloadingTranslationId: null,
  downloadProgress: 0,
  downloadError: null,
  // --- Init DB Status ---
  isDbReady: false, // Start as not ready

  // --- Init Favourites State ---
  favourites: [],
  favouritesLoading: false,
  favouritesError: null,

  // Actions Implementation
  loadApiKeys: async () => {
    console.log("[Store loadApiKeys] Attempting to load keys...");
    try {
      set({ apiKeysLoaded: false, apiKeysError: null });
      const keys = await loadKeysFromSecureStore();
      console.log(`[Store loadApiKeys] Loaded keys: ${Object.keys(keys).join(', ')}`);
      
      // Set the OpenRouter API key in state
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
        // If the removed one was selected, reset selection
        selectedTranslationId: state.selectedTranslationId === translationId ? null : state.selectedTranslationId,
      }));
      // Persist the new potentially null selection
      const newSelectedId = get().selectedTranslationId;
      setSettingInDb(SELECTED_TRANSLATION_KEY, newSelectedId ?? '')
        .catch(e => console.error("Error saving cleared selected translation:", e));
  },

  // Allow setting null, store empty string if null
  setSelectedTranslation: async (translationId) => { 
    const currentId = get().selectedTranslationId;
    if (currentId !== translationId) {
        console.log(`[Store] Setting selected translation ID: ${translationId}`);
        // Set ID immediately, but mark DB as not ready until switch completes
        set({ selectedTranslationId: translationId, isDbReady: false }); 
        let success = false;
        try {
            await setSettingInDb(SELECTED_TRANSLATION_KEY, translationId ?? '');

            // --- Switch active database ---
            const state = get(); // Get updated state
            let dbFileName: string | null = null;
            if (translationId) {
                dbFileName = state.availableTranslations.find(t => t.id === translationId)?.dbFileName ?? null;
                if (!dbFileName) {
                    console.warn(`[Store] Could not find dbFileName for selected translation ID: ${translationId}`);
                    // Cannot switch if no filename, so DB is not ready
                }
            }
            console.log(`[Store] Switching active database to: ${dbFileName ?? 'none'}`);
            success = await switchActiveDatabase(dbFileName); // Pass null if translationId is null
            console.log(`[Store] switchActiveDatabase result: ${success}`);
            // --- End switch active database ---

        } catch (error) {
            // Catch errors from both setting storage and switchActiveDatabase
            console.error(`[Store] Error during setSelectedTranslation for ID ${translationId}:`, error);
            success = false; // Ensure success is false on error
        } finally {
            // Update db readiness based on the final success status
            set({ isDbReady: success });
            console.log(`[Store] Final DB readiness set to: ${success}`);
        }
    }
  },

  setCurrentLocation: (bookId, chapterNumber) => set({ currentBookId: bookId, currentChapterNumber: chapterNumber }),

  setDownloadStatus: (isDownloading, translationId = null, progress = 0, error = null) => {
    // Prevent setting progress to 1 unless download is finishing
    const effectiveProgress = (isDownloading && progress < 1) ? progress : (isDownloading ? get().downloadProgress : progress); 
    set({
      isDownloading,
      // Keep ID if finishing with error, clear otherwise if not downloading
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

  // --- Favourites Actions Implementation ---
  loadFavourites: async () => {
    if (IS_WEB) return; // Favourites only stored in native DB for now
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
    if (IS_WEB) return; // Favourites only stored in native DB
    console.log(`[Store Favourites] Adding favourite: ${favourite.book_id} ${favourite.chapter}:${favourite.verse} (${favourite.translation_id})`);
    try {
        const newId = await addFavouriteToDb(favourite);
        if (newId) {
            // Optimistically add to state or reload?
            // Let's reload for consistency and to get the ID/timestamp
             await get().loadFavourites(); 
            // Alternatively, add manually:
            // const newFavourite = { ...favourite, id: newId, created_at: new Date().toISOString() };
            // set(state => ({ favourites: [...state.favourites, newFavourite] }));
             console.log(`[Store Favourites] Favourite added successfully (ID: ${newId}). Reloaded list.`);
        } else {
             console.warn("[Store Favourites] addFavouriteToDb did not return a new ID (likely duplicate).");
        }
    } catch (error) {
        console.error("[Store Favourites] Error adding favourite:", error);
        // Optionally set favouritesError here
        Alert.alert("Error", "Could not save favourite."); // Provide feedback
    }
  },

  removeFavourite: async (favouriteId) => {
    if (IS_WEB) return; // Favourites only stored in native DB
    console.log(`[Store Favourites] Removing favourite with ID: ${favouriteId}`);
    try {
        await removeFavouriteFromDb(favouriteId);
        // Update state by filtering locally (more efficient than reload)
        set(state => ({ 
            favourites: state.favourites.filter(fav => fav.id !== favouriteId) 
        }));
        console.log(`[Store Favourites] Favourite removed successfully.`);
    } catch (error) {
        console.error("[Store Favourites] Error removing favourite:", error);
        // Optionally set favouritesError here
         Alert.alert("Error", "Could not remove favourite."); // Provide feedback
    }
  },

  // --- Refactored initializeStore ---
  initializeStore: async () => {
    console.log("[Store Initialize] Starting..."); // Changed prefix for consistency
    // Reset DB ready status at the beginning
    set({ isDbReady: false });
    
    // 1. Load API Keys (still needed for OpenRouter)
    try {
      console.log("[Store Initialize] Attempting to load API keys...");
      await get().loadApiKeys(); 
      console.log("[Store Initialize] API keys loaded successfully (or already loaded).");
    } catch (error) {
      console.error("[Store Initialize] CRITICAL: Error during loadApiKeys! Initialization might be incomplete.", error);
      // Decide if we should stop initialization here? For now, continue...
      // Optionally set an error state in the store?
    }

    // 2. Load persisted selected translation ID
    console.log("[Store Initialize] Loading selectedTranslationId...");
    let storedSelectedId: string | null = null;
    try {
        storedSelectedId = await getSettingFromDb(SELECTED_TRANSLATION_KEY, '');
        // Handle empty string case from previous save
        if (storedSelectedId === '') storedSelectedId = null; 
        console.log(`[Store Initialize] Loaded storedSelectedId from DB: '${storedSelectedId}'`);
    } catch (e) {
        console.error("[Store Initialize] Failed to load selected translation ID from DB", e);
    }

    // 3. Load downloaded translations from File System (Native Only)
    let actualDownloadedIds: string[] = [];
    const availableTranslations = get().availableTranslations; // Get map early for use
    if (!IS_WEB) {
        try {
            const downloadedFiles = await listDownloadedDbs(); // e.g., ["KJV.db", "ASV.db"]
            console.log("[Store] Found downloaded DB files:", downloadedFiles);
            // Map filenames back to translation IDs (abbr)
            const fileAbbrMap = new Map(availableTranslations.map(t => [t.dbFileName, t.id]));
            actualDownloadedIds = downloadedFiles
                .map(filename => fileAbbrMap.get(filename))
                .filter((id): id is string => !!id); // Filter out undefined/null IDs
        } catch (e) {
            console.error("[Store Initialize] Failed to list downloaded translations from file system", e);
        }
    }
    console.log(`[Store Initialize] Determined actualDownloadedIds: [${actualDownloadedIds.join(', ')}]`);

    // 4. Validate selected ID and determine initial selection
    let validatedSelectedId: string | null = null;
    const availableIds = availableTranslations.map(t => t.id);

    // 1. Check stored ID validity against actual downloads (native) or availability (web)
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
            // Clear invalid stored ID
            setSettingInDb(SELECTED_TRANSLATION_KEY, '')
                .catch(e => console.error("Error removing invalid selected translation:", e));
        }
    }

    // 2. Fallback to first downloaded (Native only) if no valid stored ID
    if (!validatedSelectedId && !IS_WEB && actualDownloadedIds.length > 0) {
        validatedSelectedId = actualDownloadedIds[0];
        console.log(`[Store] No valid stored ID, falling back to first downloaded: ${validatedSelectedId}`);
        // Persist this fallback selection
        setSettingInDb(SELECTED_TRANSLATION_KEY, validatedSelectedId)
            .catch(e => console.error("Error saving fallback selected translation:", e));
    }
    
    // 3. Fallback to default (KJV) if available (Web or Native) and still no selection
    if (!validatedSelectedId && availableIds.includes(DEFAULT_TRANSLATION_ID)) {
         // On native, only select KJV if it's actually downloaded
        const kjvIsAvailable = IS_WEB || actualDownloadedIds.includes(DEFAULT_TRANSLATION_ID);
        if (kjvIsAvailable) {
            validatedSelectedId = DEFAULT_TRANSLATION_ID;
            console.log(`[Store] No valid stored/downloaded ID, falling back to default ${DEFAULT_TRANSLATION_ID}`);
            // Persist this fallback selection
            setSettingInDb(SELECTED_TRANSLATION_KEY, validatedSelectedId)
                .catch(e => console.error("Error saving default selected translation:", e));
        } else {
             console.log(`[Store] Default ${DEFAULT_TRANSLATION_ID} is available but not downloaded, cannot select.`);
        }
    }

    console.log(`[Store Initialize] Final validatedSelectedId before setting state: '${validatedSelectedId}'`);

    // 5. Set final initial state
    console.log(`[Store Initialize] Setting final initial state - Selected ID: ${validatedSelectedId}, Downloaded IDs: ${actualDownloadedIds.join(', ')}`);
    set({
      selectedTranslationId: validatedSelectedId,
      downloadedTranslationIds: actualDownloadedIds,
      // Reset any potential leftover download state
      isDownloading: false, 
      downloadingTranslationId: null,
      downloadProgress: 0,
      downloadError: null,
    });

    // 6. Switch to the initially selected database
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
      success = await switchActiveDatabase(initialDbFileName); // Pass null if validatedSelectedId is null
      console.log(`[Store] Initial switchActiveDatabase result: ${success}`);
    } catch (error) {
        console.error(`[Store] Error initializing active database for ID ${validatedSelectedId}:`, error);
        success = false;
        // Handle error - perhaps clear selection?
        set({ selectedTranslationId: null }); 
        setSettingInDb(SELECTED_TRANSLATION_KEY, '')
            .catch(e => console.error("Error clearing selected translation after DB init failure:", e));
        // Attempt to switch to null to ensure connection is closed
        try {
            await switchActiveDatabase(null); 
        } catch (closeError) {
            console.error("[Store] Error trying to close DB after init failure:", closeError);
        }
    } finally {
        // Update db readiness based on the final success status
        set({ isDbReady: success });
        console.log(`[Store] Initial DB readiness set to: ${success}`);
    }

    // --- Load Favourites during Initialization ---
    if (!IS_WEB) {
      console.log("[Store Initialize] Triggering initial favourites load...");
      get().loadFavourites(); // Load favourites after DB is ready
    }

    console.log("[Store] Initialization complete.");
  },
});

// Create the Zustand store by invoking the result of create<AppState>()
export const useAppStore = create<AppState>(createAppState);

// Export initializeStore separately if called from RootLayout
// export const initializeStore = useAppStore.getState().initializeStore; 