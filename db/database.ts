import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { getLocalDbPath, checkDbExists } from '../utils/fileDownloader'; // Import helpers
import { bookStringToIntId, bookIntToStringId } from '~/config/bookMap'; // Import book ID mappers

// Types should be available from the main import
type Database = SQLite.SQLiteDatabase;

const IS_WEB = Platform.OS === 'web';
const ATTACH_ALIAS = 'translation'; // Alias for the attached database

// --- Singleton Main DB Connection (Native Only) ---
let mainDb: Database | null = null;
let isMainDbOpen = false;
let currentlyAttachedDb: string | null = null; // Track the *filename* of the attached DB

/**
 * Opens the main (in-memory) database connection if not already open.
 * This is the connection used for ATTACH/DETACH operations.
 */
async function openMainDatabase(): Promise<void> {
  if (IS_WEB || isMainDbOpen) {
    return;
  }
  const mainDbName = "main.db"; // Use a persistent file name
  try {
    console.log(`[Database] Initializing main persistent database connection (${mainDbName})...`);
    // Using a named in-memory db can sometimes help with debugging, but :memory: is standard
    // mainDb = await SQLite.openDatabaseAsync(':memory:'); 
    mainDb = await SQLite.openDatabaseAsync(mainDbName); // Open the persistent file
    isMainDbOpen = true;
    currentlyAttachedDb = null; // Ensure tracker is reset on open
    console.log(`[Database] Main persistent database (${mainDbName}) opened successfully.`);

    // --- Initialize Favourites Table --- 
    // Ensure the favourites table exists in the main DB
    await mainDb.execAsync(`
        PRAGMA journal_mode = WAL; -- Optional: Improve write performance
        CREATE TABLE IF NOT EXISTS favourites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            translation_id TEXT NOT NULL,
            book_id TEXT NOT NULL, 
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL, -- Store the verse text for display
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            -- Add a unique constraint to prevent duplicates
            UNIQUE(translation_id, book_id, chapter, verse)
        );
        
        -- Initialize chats table for LLM chat history
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        
        -- Initialize messages table for chat messages
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY NOT NULL,
            chat_id TEXT NOT NULL,
            content TEXT NOT NULL,
            is_user INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            context TEXT, -- JSON string containing verse references
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        );
        
        -- Initialize app_settings table for app configuration
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);
    console.log("[Database] Favourites and chat tables initialized (or already exist).");
    // --- End Tables Init ---

  } catch (error) {
    console.error(`[Database] Failed to open main persistent database (${mainDbName}):`, error);
    mainDb = null;
    isMainDbOpen = false;
    // Potentially throw or handle this critical error
    throw new Error("Failed to initialize main database connection.");
  }
}

// Initialize main DB on module load (async, non-blocking)
if (!IS_WEB) {
    openMainDatabase().catch(error => {
        console.error("[Database] Background initialization of main DB failed:", error);
        // App might be in a bad state here if this fails
    });
}

/**
 * Switches the active database by DETACHing the old one (if any)
 * and ATTACHing the new one using the main connection.
 * @param dbFileName - The name of the database file to activate, or null to detach.
 */
export async function switchActiveDatabase(dbFileName: string | null): Promise<boolean> {
    if (IS_WEB) {
        console.warn("[Database] switchActiveDatabase called on web, returning false.");
        return false; // ATTACH/DETACH not supported on web
    }
    
    // Ensure main DB is open (should be quick if already open)
    await openMainDatabase(); 
    if (!mainDb) {
        console.error("[Database] Cannot switch, main DB connection failed to open.");
        return false;
    }

    // 1. Detach currently attached DB if necessary
    if (currentlyAttachedDb) {
        console.log(`[Database] Detaching currently attached DB: ${currentlyAttachedDb} (Alias: ${ATTACH_ALIAS})`);
        try {
            await mainDb.execAsync(`DETACH DATABASE ${ATTACH_ALIAS};`);
            console.log(`[Database] Detach successful for alias ${ATTACH_ALIAS}.`);
            currentlyAttachedDb = null;
        } catch (detachError) {
            console.error(`[Database] Error detaching database ${ATTACH_ALIAS}:`, detachError);
            // Don't necessarily stop here, maybe the attach will still work if detach failed weirdly?
            // Or should we return false? For now, log and continue.
            currentlyAttachedDb = null; // Assume detached even on error to allow attach attempt
        }
    }

    // 2. Attach new DB if a filename is provided
    if (dbFileName) {
        const localPathUri = getLocalDbPath(dbFileName); // Path with file:// prefix
        // For the native ATTACH command, try using the path without the file:// prefix
        const absolutePosixPath = localPathUri.replace(/^file:\/\//, ''); 
        
        console.log(`[Database] Attaching DB: ${absolutePosixPath} AS ${ATTACH_ALIAS} (using POSIX path)`);
        // Check if file exists before attempting attach
        if (!(await checkDbExists(dbFileName))) {
            console.error(`[Database] Cannot attach, file does not exist: ${localPathUri}`);
            return false; // Cannot attach non-existent file
        }

        try {
            // NOTE: File paths in ATTACH need to be properly quoted/escaped if they contain special chars.
            // Using the path without file:// prefix
            await mainDb.execAsync(`ATTACH DATABASE '${absolutePosixPath}' AS ${ATTACH_ALIAS};`);
            currentlyAttachedDb = dbFileName; // Track the filename
            console.log(`[Database] Attach successful: ${dbFileName} AS ${ATTACH_ALIAS}`);
            // Optional: Verify attachment
            // const dbs = await mainDb.getAllAsync('PRAGMA database_list;');
            // console.log('[Database] PRAGMA database_list:', dbs);
            return true; // Successfully attached
        } catch (attachError) {
            console.error(`[Database] Error attaching database ${absolutePosixPath} AS ${ATTACH_ALIAS}:`, attachError);
            currentlyAttachedDb = null; // Ensure tracker is null on failure
            return false; // Attach failed
        }
    }

    // If dbFileName was null, we only needed to detach, which we did (or attempted).
    // Return true indicating the desired state (nothing attached) is achieved.
    return true; 
}

// --- Refactored Read Operation Helpers (Use mainDb) ---

async function performGetAll<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T[]> {
    // Remove expectedDbName parameter and check
    if (IS_WEB || !mainDb) {
        console.warn(`[Database] performGetAll called but no active DB connection.`);
        return [];
    }
    // Add check: Ensure a translation DB is actually attached before querying
    if (!currentlyAttachedDb) {
        console.warn(`[Database] performGetAll called but no translation DB is attached.`);
        // Throw an error instead of returning empty? This indicates a logic error.
        throw new Error("Query attempted while no translation database was attached.");
        // return []; 
    }
    
    try {
        // Log without DB name, as it's always the main connection now
        // console.log(`[Database] performGetAll: Executing query: ${sql.substring(0, 100)}...`);
        return await mainDb.getAllAsync<T>(sql, params);
    } catch (error) {
        console.error(`[Database] Error in performGetAll():`, error);
        throw error;
    } 
}

// performGet would be similar if needed

// --- Specific Query Functions (Rely on activeDb) ---

export interface AppBook {
    id: string; // Standard string ID (e.g., 'GEN')
    name: string;
}

/** Fetches books for the currently active translation */
async function getBooksInternal(abbr: string): Promise<AppBook[]> {
    // Removed !mainDb check, performGetAll handles it
    // Construct table name based on convention
    const booksTable = `${abbr}_books`; 
    // Add alias prefix to table name in query, using standard SQL quoting
    const sql = `SELECT id, name FROM "${ATTACH_ALIAS}"."${booksTable}" ORDER BY id ASC`;
    console.log(`[Database] Executing getBooksInternal SQL: ${sql}`); // Log the generated SQL
    const results = await performGetAll<{id: number, name: string}>(sql); 
    
    return results.map(book => ({
        id: bookIntToStringId[book.id] ?? `UNKNOWN_${book.id}`, 
        name: book.name
    }));
}

/** Fetches distinct chapter numbers for the active translation's book */
async function getChaptersInternal(abbr: string, bookStringId: string): Promise<number[]> {
    // Removed !mainDb check
    // Construct table name based on convention
    const versesTable = `${abbr}_verses`; 
    const bookIntId = bookStringToIntId[bookStringId];
    if (bookIntId === undefined) {
        console.error(`[Database] Invalid book string ID: ${bookStringId}`);
        return [];
    }
    // Add alias prefix to table name in query, using standard SQL quoting
    const sql = `SELECT DISTINCT chapter FROM "${ATTACH_ALIAS}"."${versesTable}" WHERE book_id = ? ORDER BY chapter ASC`;
    console.log(`[Database] Executing getChaptersInternal SQL: ${sql}`); // Log the generated SQL
    const results = await performGetAll<{ chapter: number }>(sql, [bookIntId]);
    return results.map(row => row.chapter);
}

export interface Verse {
    verse: number;
    text: string;
}

/** Fetches verses for the active translation's book/chapter */
async function getVersesInternal(abbr: string, bookStringId: string, chapter: number): Promise<Verse[]> {
     // Removed !mainDb check
     // Construct table name based on convention
     const versesTable = `${abbr}_verses`; 
    const bookIntId = bookStringToIntId[bookStringId];
    if (bookIntId === undefined) {
        console.error(`[Database] Invalid book string ID: ${bookStringId}`);
        return [];
    }
    // Add alias prefix to table name in query, using standard SQL quoting
    const sql = `SELECT verse, text FROM "${ATTACH_ALIAS}"."${versesTable}" WHERE book_id = ? AND chapter = ? ORDER BY verse ASC`;
    console.log(`[Database] Executing getVersesInternal SQL: ${sql}`); // Log the generated SQL
    return await performGetAll<Verse>(sql, [bookIntId, chapter]);
}

// --- Favourites CRUD Functions ---

// Define FavouriteVerse Type (matches table schema)
export interface FavouriteVerse {
    id: number; // From DB
    translation_id: string;
    book_id: string;
    chapter: number;
    verse: number;
    text: string;
    created_at: string; // ISO Date string
}

// Function to load all favourites
export async function loadFavouritesFromDb(): Promise<FavouriteVerse[]> {
    if (IS_WEB || !mainDb) {
        console.warn("[Database Favourites] Cannot load, no main DB connection.");
        return [];
    }
    try {
        const results = await mainDb.getAllAsync<FavouriteVerse>(
            'SELECT id, translation_id, book_id, chapter, verse, text, created_at FROM favourites ORDER BY created_at DESC'
        );
        return results;
    } catch (error) {
        console.error("[Database Favourites] Error loading favourites from DB:", error);
        throw error; // Re-throw for store to handle
    }
}

// Function to add a favourite
// Input type omits id and created_at, as they are auto-generated
export async function addFavouriteToDb(fav: Omit<FavouriteVerse, 'id' | 'created_at'>): Promise<number | null> {
    if (IS_WEB || !mainDb) {
        console.warn("[Database Favourites] Cannot add, no main DB connection.");
        return null;
    }
    const sql = `
        INSERT INTO favourites (translation_id, book_id, chapter, verse, text)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(translation_id, book_id, chapter, verse) DO NOTHING;
    `;
    try {
        const result = await mainDb.runAsync(sql, [
            fav.translation_id,
            fav.book_id,
            fav.chapter,
            fav.verse,
            fav.text
        ]);
        // Return the ID of the inserted row, or null if conflict occurred
        return result.lastInsertRowId > 0 ? result.lastInsertRowId : null; 
    } catch (error) {
        console.error("[Database Favourites] Error adding favourite to DB:", error);
        throw error; // Re-throw for store to handle
    }
}

// Function to remove a favourite by its DB ID
export async function removeFavouriteFromDb(id: number): Promise<void> {
    if (IS_WEB || !mainDb) {
        console.warn("[Database Favourites] Cannot remove, no main DB connection.");
        return;
    }
    try {
        await mainDb.runAsync('DELETE FROM favourites WHERE id = ?', [id]);
    } catch (error) {
        console.error(`[Database Favourites] Error removing favourite (ID: ${id}) from DB:`, error);
        throw error; // Re-throw for store to handle
    }
}

// --- Export Types ---
// Add Message type at the top with other type definitions
export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  context?: {
    verses: Array<{
      reference: string;
      text: string;
    }>
  }
}

export interface ChatMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// --- Chat CRUD Functions ---

// Save a chat with its title and timestamps
export async function saveChatToDb(chatId: string, title: string): Promise<void> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot save chat, no main DB connection.");
    return;
  }
  
  const now = Date.now();
  try {
    await mainDb.runAsync(
      `INSERT OR REPLACE INTO chats (id, title, created_at, updated_at) 
       VALUES (?, ?, ?, ?)`,
      [chatId, title, now, now]
    );
    console.log(`[Database Chat] Saved/updated chat: ${chatId}`);
  } catch (error) {
    console.error(`[Database Chat] Error saving chat ${chatId}:`, error);
    throw error;
  }
}

// Update a chat's title and updated_at timestamp
export async function updateChatTitleInDb(chatId: string, title: string): Promise<void> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot update chat title, no main DB connection.");
    return;
  }
  
  const now = Date.now();
  try {
    const result = await mainDb.runAsync(
      `UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`,
      [title, now, chatId]
    );
    
    if (result.changes === 0) {
      throw new Error(`No chat found with ID: ${chatId}`);
    }
    
    console.log(`[Database Chat] Updated title for chat ${chatId}`);
  } catch (error) {
    console.error(`[Database Chat] Error updating chat title for ${chatId}:`, error);
    throw error;
  }
}

// Save a message to the database
export async function saveMessageToDb(message: Message, chatId: string): Promise<void> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot save message, no main DB connection.");
    return;
  }
  
  // Safety check for empty content (should never happen but just in case)
  if (!message.content) {
    console.warn(`[Database Chat] Attempted to save message with empty content for chat ${chatId}`);
    // We'll still save it, but log the warning
  }
  
  const contextJSON = message.context ? JSON.stringify(message.context) : null;
  
  try {
    // Log the exact data being saved for debugging
    console.log(`[Database Chat] Saving message ${message.id} for chat ${chatId}:
      - isUser: ${message.isUser}
      - timestamp: ${message.timestamp}
      - content length: ${message.content.length}
      - content snippet: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`);
    
    // Insert/update the message without explicit transaction
    await mainDb.runAsync(
      `INSERT OR REPLACE INTO messages (id, chat_id, content, is_user, timestamp, context)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.id, chatId, message.content, message.isUser ? 1 : 0, message.timestamp, contextJSON]
    );
    
    // Update the chat's updated_at timestamp
    await mainDb.runAsync(
      `UPDATE chats SET updated_at = ? WHERE id = ?`,
      [Date.now(), chatId]
    );
    
    console.log(`[Database Chat] Successfully saved message ${message.id} for chat ${chatId}`);
  } catch (error) {
    console.error(`[Database Chat] Error saving message:`, error);
    throw error;
  }
}

// Get all messages for a specific chat
export async function getChatMessagesFromDb(chatId: string): Promise<Message[]> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot get messages, no main DB connection.");
    return [];
  }
  
  try {
    console.log(`[Database Chat] Retrieving messages for chat ${chatId}`);
    
    const results = await mainDb.getAllAsync<{
      id: string,
      content: string,
      is_user: number,
      timestamp: string,
      context: string | null
    }>(
      `SELECT id, content, is_user, timestamp, context FROM messages 
       WHERE chat_id = ? ORDER BY timestamp ASC`,
      [chatId]
    );
    
    // Log the raw query results for debugging
    console.log(`[Database Chat] Raw query returned ${results.length} messages`);
    
    if (results.length > 0) {
      // Log a sample of the first and last message (if available)
      const firstMsg = results[0];
      const lastMsg = results[results.length - 1];
      
      console.log(`[Database Chat] First message: 
        - id: ${firstMsg.id}
        - is_user: ${firstMsg.is_user}
        - content length: ${firstMsg.content.length}
        - content snippet: "${firstMsg.content.substring(0, 50)}${firstMsg.content.length > 50 ? '...' : ''}"`);
      
      if (results.length > 1) {
        console.log(`[Database Chat] Last message: 
          - id: ${lastMsg.id}
          - is_user: ${lastMsg.is_user}
          - content length: ${lastMsg.content.length}
          - content snippet: "${lastMsg.content.substring(0, 50)}${lastMsg.content.length > 50 ? '...' : ''}"`);
      }
    }
    
    const messages: Message[] = results.map(row => ({
      id: row.id,
      content: row.content,
      isUser: row.is_user === 1,
      timestamp: row.timestamp,
      context: row.context ? JSON.parse(row.context) : undefined
    }));
    
    console.log(`[Database Chat] Retrieved and converted ${messages.length} messages for chat ${chatId}`);
    return messages;
  } catch (error) {
    console.error(`[Database Chat] Error getting messages for chat ${chatId}:`, error);
    throw error;
  }
}

// Get a chat's metadata
export async function getChatMetadataFromDb(chatId: string): Promise<ChatMetadata | null> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot get chat metadata, no main DB connection.");
    return null;
  }
  
  try {
    const results = await mainDb.getAllAsync<{
      id: string,
      title: string,
      created_at: number,
      updated_at: number
    }>(
      `SELECT id, title, created_at, updated_at FROM chats WHERE id = ? LIMIT 1`,
      [chatId]
    );
    
    if (results.length === 0) {
      return null;
    }
    
    const chat = results[0];
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at
    };
  } catch (error) {
    console.error(`[Database Chat] Error getting chat metadata for ${chatId}:`, error);
    throw error;
  }
}

// Get all chats
export async function getAllChatsFromDb(): Promise<ChatMetadata[]> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot get chats, no main DB connection.");
    return [];
  }
  
  try {
    const results = await mainDb.getAllAsync<{
      id: string,
      title: string,
      created_at: number,
      updated_at: number
    }>(
      `SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC`
    );
    
    const chats: ChatMetadata[] = results.map(chat => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at
    }));
    
    console.log(`[Database Chat] Retrieved ${chats.length} chats`);
    return chats;
  } catch (error) {
    console.error('[Database Chat] Error getting all chats:', error);
    throw error;
  }
}

// Delete a chat and all its messages
export async function deleteChatFromDb(chatId: string): Promise<boolean> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot delete chat, no main DB connection.");
    return false;
  }
  
  try {
    // With CASCADE, this should also delete all messages
    const result = await mainDb.runAsync(
      `DELETE FROM chats WHERE id = ?`,
      [chatId]
    );
    
    if (result.changes > 0) {
      console.log(`[Database Chat] Deleted chat ${chatId} and its messages`);
      return true;
    } else {
      console.log(`[Database Chat] No chat found with ID ${chatId}`);
      return false;
    }
  } catch (error) {
    console.error(`[Database Chat] Error deleting chat ${chatId}:`, error);
    throw error;
  }
}

// Get a preview of messages in each chat
export async function getChatPreviewsFromDb(): Promise<Array<{ 
  chatId: string; 
  userPreview: string | null;
  aiPreview: string | null;
}>> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Chat] Cannot get chat previews, no main DB connection.");
    return [];
  }
  
  try {
    // Get the first user message and first AI message for each chat
    console.log('[Database Chat] Fetching user and AI message previews');
    
    // First, get the first user message for each chat
    const userMessages = await mainDb.getAllAsync<{
      chat_id: string,
      content: string
    }>(
      `SELECT m1.chat_id, m1.content
       FROM messages m1
       WHERE m1.is_user = 1
       AND m1.timestamp = (
         SELECT MIN(m2.timestamp)
         FROM messages m2
         WHERE m2.chat_id = m1.chat_id AND m2.is_user = 1
       )`
    );
    
    // Then, get the first AI message for each chat
    const aiMessages = await mainDb.getAllAsync<{
      chat_id: string,
      content: string
    }>(
      `SELECT m1.chat_id, m1.content
       FROM messages m1
       WHERE m1.is_user = 0
       AND m1.timestamp = (
         SELECT MIN(m2.timestamp)
         FROM messages m2
         WHERE m2.chat_id = m1.chat_id AND m2.is_user = 0
       )`
    );
    
    // Create a map of chat IDs to their messages
    const chatMap = new Map<string, {
      userPreview: string | null,
      aiPreview: string | null
    }>();
    
    // Add user messages to the map
    userMessages.forEach(msg => {
      const maxPreviewLength = 100;
      const preview = msg.content.length > maxPreviewLength
        ? `${msg.content.substring(0, maxPreviewLength)}...`
        : msg.content;
        
      chatMap.set(msg.chat_id, {
        userPreview: preview,
        aiPreview: null
      });
    });
    
    // Add AI messages to the map
    aiMessages.forEach(msg => {
      const maxPreviewLength = 100;
      const preview = msg.content.length > maxPreviewLength
        ? `${msg.content.substring(0, maxPreviewLength)}...`
        : msg.content;
        
      const existing = chatMap.get(msg.chat_id);
      if (existing) {
        existing.aiPreview = preview;
      } else {
        chatMap.set(msg.chat_id, {
          userPreview: null,
          aiPreview: preview
        });
      }
    });
    
    // Convert the map to an array of results
    const previews = Array.from(chatMap.entries()).map(([chatId, previews]) => ({
      chatId,
      userPreview: previews.userPreview,
      aiPreview: previews.aiPreview
    }));
    
    console.log(`[Database Chat] Retrieved previews for ${previews.length} chats`);
    return previews;
  } catch (error) {
    console.error('[Database Chat] Error getting chat previews:', error);
    throw error;
  }
}

// --- App Settings CRUD Functions ---

/**
 * Gets a setting value from the database
 * @param key The setting key
 * @param defaultValue Optional default value if setting doesn't exist
 * @returns The setting value or defaultValue if not found
 */
export async function getSettingFromDb(key: string, defaultValue?: string): Promise<string | null> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Settings] Cannot get setting, no main DB connection.");
    return defaultValue ?? null;
  }
  
  try {
    const results = await mainDb.getAllAsync<{value: string}>(
      'SELECT value FROM app_settings WHERE key = ?', 
      [key]
    );
    
    return results.length > 0 ? results[0].value : (defaultValue ?? null);
  } catch (error) {
    console.error(`[Database Settings] Error getting setting for key ${key}:`, error);
    return defaultValue ?? null;
  }
}

/**
 * Saves a setting to the database
 * @param key The setting key
 * @param value The setting value
 */
export async function setSettingInDb(key: string, value: string): Promise<void> {
  if (IS_WEB || !mainDb) {
    console.warn("[Database Settings] Cannot save setting, no main DB connection.");
    return;
  }
  
  try {
    await mainDb.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [key, value, Date.now()]
    );
    console.log(`[Database Settings] Saved setting: ${key}`);
  } catch (error) {
    console.error(`[Database Settings] Error saving setting for key ${key}:`, error);
    throw error;
  }
}

/**
 * Gets multiple settings at once from the database
 * @param keys Array of setting keys
 * @returns Object mapping keys to their values (or null if not found)
 */
export async function getBatchSettingsFromDb(keys: string[]): Promise<Record<string, string | null>> {
  if (IS_WEB || !mainDb || keys.length === 0) {
    console.warn("[Database Settings] Cannot get batch settings, no main DB connection or empty keys array.");
    return {};
  }
  
  try {
    // Create parameterized query with placeholders for each key
    const placeholders = keys.map(() => '?').join(',');
    const results = await mainDb.getAllAsync<{key: string, value: string}>(
      `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`,
      keys
    );
    
    // Initialize return object with null values for all requested keys
    const settingsMap: Record<string, string | null> = {};
    keys.forEach(key => { settingsMap[key] = null; });
    
    // Fill in values from results
    results.forEach(row => {
      settingsMap[row.key] = row.value;
    });
    
    return settingsMap;
  } catch (error) {
    console.error(`[Database Settings] Error getting batch settings:`, error);
    return {};
  }
}

export {
    getBooksInternal as getBooks,
    getChaptersInternal as getChapters,
    getVersesInternal as getVerses,
}; 