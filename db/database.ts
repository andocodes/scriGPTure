import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Types should be available from the main import
type Database = SQLite.SQLiteDatabase;

const DB_NAME = "scripture.db";
const IS_WEB = Platform.OS === 'web';

let dbInstance: Database | null = null;

async function openDatabase(): Promise<Database | null> {
  if (IS_WEB) {
    console.log('SQLite operations are disabled on the web platform.');
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  try {
    console.log(`Attempting to open database: ${DB_NAME}`);
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    console.log('Database opened successfully.');
    await initializeTables(db);
    dbInstance = db;
    return dbInstance;
  } catch (error) {
    console.error('Failed to open or initialize database:', error);
    throw error;
  }
}

async function initializeTables(database: Database): Promise<void> {
  try {
    const result = await database.getFirstAsync<{ user_version: number }>( 'PRAGMA user_version' );
    let currentVersion = result?.user_version ?? 0;
    console.log(`Current DB version: ${currentVersion}`);

    if (currentVersion < 1) {
      console.log('Initializing database schema (Version 1)...');
      // Use execAsync for multiple non-parameterized statements
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE translations (
          id TEXT PRIMARY KEY NOT NULL,
          abbreviation TEXT NOT NULL,
          name TEXT NOT NULL,
          language TEXT NOT NULL,
          downloaded INTEGER DEFAULT 0 NOT NULL
        );
        CREATE TABLE books (
          id TEXT PRIMARY KEY NOT NULL,
          translation_id TEXT NOT NULL,
          abbreviation TEXT NOT NULL,
          name TEXT NOT NULL,
          name_long TEXT,
          sort_order INTEGER NOT NULL,
          FOREIGN KEY (translation_id) REFERENCES translations(id) ON DELETE CASCADE
        );
        CREATE TABLE chapters (
          id TEXT PRIMARY KEY NOT NULL,
          translation_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          reference TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          FOREIGN KEY (translation_id) REFERENCES translations(id) ON DELETE CASCADE,
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE TABLE verses (
          id TEXT PRIMARY KEY NOT NULL,
          translation_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          verse_number TEXT NOT NULL,
          content TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          FOREIGN KEY (translation_id) REFERENCES translations(id) ON DELETE CASCADE,
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_books_translation ON books(translation_id);
        CREATE INDEX idx_chapters_book ON chapters(book_id);
        CREATE INDEX idx_verses_chapter ON verses(chapter_id);
        PRAGMA user_version = 1;
      `);
      console.log('Schema version 1 initialized.');
    }
    // Add future migrations using `if (currentVersion < X) { ... PRAGMA user_version = X; }`
  } catch (error) {
    console.error('Error during table initialization:', error);
    throw error;
  }
}

// --- Database Operation Helpers ---

/** Gets the singleton database instance, opening it if necessary. */
async function getDb(): Promise<Database | null> {
    if (IS_WEB) return null;
    if (!dbInstance) {
        return await openDatabase();
    }
    return dbInstance;
}

/** Executes a single SQL statement (INSERT, UPDATE, DELETE) */
async function run(sql: string, params: SQLite.SQLiteBindParams = []): Promise<SQLite.SQLiteRunResult> {
    if (IS_WEB) return { changes: 0, lastInsertRowId: 0 };
    const db = await getDb();
    if (!db) return { changes: 0, lastInsertRowId: 0 };
    return await db.runAsync(sql, params);
}

/** Executes a SELECT statement and returns the first row */
async function get<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T | null> {
    if (IS_WEB) return null;
    const db = await getDb();
    if (!db) return null;
    const result = await db.getFirstAsync<T>(sql, params);
    return result ?? null;
}

/** Executes a SELECT statement and returns all rows */
async function all<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T[]> {
    if (IS_WEB) return [];
    const db = await getDb();
    if (!db) return [];
    return await db.getAllAsync<T>(sql, params);
}

/** Executes multiple SQL statements non-transactionally */
async function exec(sql: string): Promise<void> {
    if (IS_WEB) return;
    const db = await getDb();
    if (!db) return;
    await db.execAsync(sql);
}

/** Executes an async function within a database transaction */
async function withTransaction(task: () => Promise<void>): Promise<void> {
    if (IS_WEB) {
        await task();
        return;
    }
    const db = await getDb();
    if (!db) {
        console.warn("Attempted transaction without DB connection");
        await task();
        return;
    }
    await db.withTransactionAsync(task);
}

// Export the core functions needed externally
export { openDatabase, run, get, all, exec, withTransaction }; 