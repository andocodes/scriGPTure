import axios from 'axios';
import { loadApiKeys } from '~/utils/apiKeyManager';
import * as db from '~/db/database'; // Import database helpers
import { useAppStore } from '~/store/store'; // Import store for progress updates

const API_BASE_URL = 'https://api.scripture.api.bible/v1';

// Helper function to get the API key
async function getApiKey(): Promise<string> {
  const { apiBibleKey } = await loadApiKeys();
  if (!apiBibleKey) {
    throw new Error('API.Bible API key not found in secure storage.');
  }
  return apiBibleKey;
}

// --- Interfaces for API Responses ---
// Based on https://scripture.api.bible/livedocs

interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      // ... pagination details if needed
    };
  };
}

interface ApiVerseResponse {
    data: ApiBibleVerse[];
    meta: any; // Include meta if needed, define more strictly if possible
}

export interface ApiBibleTranslation {
  id: string;
  name: string;
  nameLocal: string;
  abbreviation: string;
  abbreviationLocal: string;
  description: string;
  descriptionLocal: string;
  language: {
    id: string;
    name: string;
    nameLocal: string;
    script: string;
    scriptDirection: string;
  };
  countries: {
    id: string;
    name: string;
    nameLocal: string;
  }[];
  type: string;
  updatedAt: string;
  // Add audio information if present/needed
}

export interface ApiBibleBook {
  id: string; // e.g., GEN
  bibleId: string;
  abbreviation: string; // e.g., Gen
  name: string; // e.g., Genesis
  nameLong: string; // e.g., The First Book of Moses called Genesis
  chapters?: ApiBibleChapter[]; // Chapters might be included depending on the endpoint
}

export interface ApiBibleChapter {
    id: string; // e.g., GEN.1
    bibleId: string;
    bookId: string; // e.g., GEN
    number: string; // e.g., 1
    reference: string; // e.g., Genesis 1
    content?: string; // May contain verse content depending on endpoint/params
    verseCount?: number;
    next?: { id: string, bookId: string, number: string };
    previous?: { id: string, bookId: string, number: string };
}

export interface ApiBibleVerse {
    id: string; // e.g., GEN.1.1
    orgId: string;
    bibleId: string;
    bookId: string;
    chapterId: string;
    content: string; // HTML content
    reference: string; // e.g., Genesis 1:1
    verseCount: number;
    copyright: string;
    next?: { id: string, number: string };
    previous?: { id: string, number: string };
}

// --- API Service Functions ---

/** Fetches the list of available Bible translations/versions. */
export async function fetchAvailableTranslations(): Promise<ApiBibleTranslation[]> {
  const apiKey = await getApiKey();
  try {
    const response = await axios.get<ApiResponse<ApiBibleTranslation[]>>(
      `${API_BASE_URL}/bibles`,
      {
        headers: { 'api-key': apiKey },
      },
    );
    // TODO: Handle potential pagination if needed
    return response.data.data;
  } catch (error) {
    console.error('Error fetching available translations:', error);
    // Consider more specific error handling (e.g., check error.response)
    throw error;
  }
}

/** Fetches all books for a specific Bible translation ID. */
export async function fetchBooksForTranslation(translationId: string): Promise<ApiBibleBook[]> {
  const apiKey = await getApiKey();
  try {
    // The `include-chapters` param could be added but might make the response huge.
    // Fetching only books first is safer.
    const response = await axios.get<ApiResponse<ApiBibleBook[]>>(
      `${API_BASE_URL}/bibles/${translationId}/books`,
      {
        headers: { 'api-key': apiKey },
        params: { 'include-chapters': 'false' } // Explicitly exclude chapters for now
      }
    );
    // TODO: Handle potential pagination if needed
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching books for translation ${translationId}:`, error);
    throw error;
  }
}

/** Fetches all chapters for a specific book within a translation. */
export async function fetchChaptersForBook(translationId: string, bookId: string): Promise<ApiBibleChapter[]> {
  const apiKey = await getApiKey();
  try {
    const response = await axios.get<ApiResponse<ApiBibleChapter[]>>(
      `${API_BASE_URL}/bibles/${translationId}/books/${bookId}/chapters`,
      {
        headers: { 'api-key': apiKey },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching chapters for book ${bookId} in translation ${translationId}:`, error);
    throw error;
  }
}

/** Fetches all verses for a specific chapter. */
export async function fetchVersesForChapter(translationId: string, chapterId: string): Promise<ApiBibleVerse[]> {
    const apiKey = await getApiKey();
    try {
        const params = {
            'content-type': 'html',
            'include-notes': 'false',
            'include-titles': 'true',
            'include-chapter-numbers': 'false',
            'include-verse-numbers': 'true',
            'include-verse-spans': 'false',
        };

        const response = await axios.get<ApiVerseResponse>(
            `${API_BASE_URL}/bibles/${translationId}/chapters/${chapterId}/verses`,
            {
                headers: { 'api-key': apiKey },
                params: params,
            }
        );
        return response.data.data;
    } catch (error) {
        console.error(`Error fetching verses for chapter ${chapterId} in translation ${translationId}:`, error);
        throw error;
    }
}

// --- Download and Store Function ---

// Helper to chunk arrays for batch processing
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Downloads all content for a specific translation and stores it in the SQLite database.
 * Reports progress via the Zustand store.
 */
export async function downloadAndStoreTranslation(
    translation: Pick<ApiBibleTranslation, 'id' | 'abbreviation' | 'name' | 'language'>
): Promise<void> {
    const { setDownloadStatus, addDownloadedTranslation, setSelectedTranslation } = useAppStore.getState();
    const translationId = translation.id;
    let booksProcessed = 0;
    let chaptersProcessed = 0;
    let totalEstimatedChapters = 0;
    const VERSE_BATCH_SIZE = 100; // Insert verses in chunks of 100

    console.log(`Starting download for ${translation.name} (${translationId})...`);
    setDownloadStatus(true, translationId, 0, null);

    try {
        // 1. Fetch Books
        setDownloadStatus(true, translationId, 0.01, null);
        const books = await fetchBooksForTranslation(translationId);
        if (!books || books.length === 0) throw new Error('No books found');
        totalEstimatedChapters = books.length * 20; // Still an estimate

        await db.withTransaction(async () => {
            console.log('Starting DB transaction for download...');

            // 2. Clear existing data
            console.log(`Clearing existing data for ${translationId}...`);
            await db.run("DELETE FROM verses WHERE translation_id = ?", [translationId]);
            await db.run("DELETE FROM chapters WHERE translation_id = ?", [translationId]);
            await db.run("DELETE FROM books WHERE translation_id = ?", [translationId]);
            await db.run("DELETE FROM translations WHERE id = ?", [translationId]);

            // 3. Insert Translation Info
            console.log(`Inserting translation info...`);
            await db.run(
                "INSERT INTO translations (id, abbreviation, name, language, downloaded) VALUES (?, ?, ?, ?, 0)",
                [translationId, translation.abbreviation, translation.name, translation.language?.id ?? 'unknown']
            );

            // 4. Batch Insert Books
            console.log(`Batch inserting ${books.length} books...`);
            if (books.length > 0) {
                const bookValues: any[] = [];
                const placeholders = books.map((book, i) => {
                    bookValues.push(book.id, translationId, book.abbreviation, book.name, book.nameLong, i + 1);
                    return "(?, ?, ?, ?, ?, ?)";
                }).join(', ');
                const bookSql = `INSERT INTO books (id, translation_id, abbreviation, name, name_long, sort_order) VALUES ${placeholders}`;
                await db.run(bookSql, bookValues);
            }
            booksProcessed = books.length;
            setDownloadStatus(true, translationId, 0.1 + (booksProcessed / books.length) * 0.1, null);

            // 5. Fetch and Batch Insert Chapters and Verses
            let overallChapterIndex = 0;
            for (const book of books) {
                console.log(`Processing book: ${book.id}`);
                const chapters = await fetchChaptersForBook(translationId, book.id);
                if (!chapters || chapters.length === 0) continue; // Skip book if no chapters

                // Batch insert chapters for this book
                const chapterValues: any[] = [];
                const chapterPlaceholders = chapters.map((chapter, j) => {
                    chapterValues.push(chapter.id, translationId, book.id, chapter.reference, j + 1);
                    return "(?, ?, ?, ?, ?)";
                }).join(', ');
                const chapterSql = `INSERT INTO chapters (id, translation_id, book_id, reference, sort_order) VALUES ${chapterPlaceholders}`;
                await db.run(chapterSql, chapterValues);

                // Fetch and batch insert verses for each chapter
                for (const chapter of chapters) {
                    overallChapterIndex++;
                    const verses = await fetchVersesForChapter(translationId, chapter.id);
                    if (!verses || verses.length === 0) continue; // Skip chapter if no verses

                    // Batch insert verses in chunks
                    const verseChunks = chunkArray(verses, VERSE_BATCH_SIZE);
                    for (const chunk of verseChunks) {
                        const verseValues: any[] = [];
                        const versePlaceholders = chunk.map((verse, k) => {
                            const verseNum = verse.reference.split(':')[1] ?? '0';
                            // Ensure content is not null before pushing
                            const verseContent = verse.content ?? ''; 
                            verseValues.push(verse.id, translationId, book.id, chapter.id, verseNum, verseContent, overallChapterIndex * 1000 + k + 1); // Use verseContent
                            return "(?, ?, ?, ?, ?, ?, ?)";
                        }).join(', ');
                        const verseSql = `INSERT INTO verses (id, translation_id, book_id, chapter_id, verse_number, content, sort_order) VALUES ${versePlaceholders}`;
                        await db.run(verseSql, verseValues);
                    }
                    chaptersProcessed++;
                    const progress = 0.2 + (chaptersProcessed / totalEstimatedChapters) * 0.7;
                    setDownloadStatus(true, translationId, Math.min(progress, 0.95), null);
                }
                 console.log(`Finished processing book ${book.id}`);
            }

            // 6. Mark Translation as Downloaded
            console.log(`Marking translation ${translationId} as downloaded...`);
            await db.run("UPDATE translations SET downloaded = 1 WHERE id = ?", [translationId]);
            
            console.log('DB transaction committed.');
        });

        console.log(`Successfully downloaded ${translation.name}`);
        addDownloadedTranslation(translationId);
        setSelectedTranslation(translationId); // Auto-select after download
        setDownloadStatus(false, null, 1, null);

    } catch (error) {
        console.error(`Error downloading translation ${translationId}:`, error);
        setDownloadStatus(false, translationId, useAppStore.getState().downloadProgress, error instanceof Error ? error.message : "Download failed");
    }
} 