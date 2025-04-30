import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { getLocalDbPath, checkDbExists } from '../services/fileDownloader'; // Import helpers
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

interface ScrollmapperBook {
    id: number; // Integer ID from DB
    name: string;
}

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

// Note: `run`, `exec`, `withTransaction` are removed for now as this focuses on reads from pre-built DBs.
// If write operations are needed later (e.g., for user notes), they would need careful re-implementation 
// possibly using a separate database file to avoid modifying the downloaded translation dbs.

// Export the public API
export {
    // switchActiveDatabase, // Removed: Already exported at definition
    getBooksInternal as getBooks,
    getChaptersInternal as getChapters,
    getVersesInternal as getVerses,
    // Types are exported at definition
}; 