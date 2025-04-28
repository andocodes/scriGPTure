import axios from 'axios';
import { loadApiKeys } from '~/utils/apiKeyManager';

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

// TODO: Implement function to download and store an entire translation
// This will involve calling the above functions iteratively and writing to SQLite.
// export async function downloadAndStoreTranslation(translationId: string): Promise<void> { ... } 