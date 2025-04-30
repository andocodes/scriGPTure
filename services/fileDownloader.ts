import * as FileSystem from 'expo-file-system';
import { useAppStore } from '~/store/store'; // For updating download status

// --- Configuration ---
const GITHUB_REPO_OWNER = 'scrollmapper';
const GITHUB_REPO_NAME = 'bible_databases';
// Use the specific commit hash we decided on
const GITHUB_COMMIT_HASH = 'a228a19a29099a41c196c2a310cd93e50a390e30';
const GITHUB_SQLITE_PATH = 'formats/sqlite';

// Base URL for raw content
const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_COMMIT_HASH}`;

// Local storage configuration
// Revert back to custom subdirectory
const LOCAL_DB_SUBDIR = 'bible_databases';
const LOCAL_DB_DIR = `${FileSystem.documentDirectory}${LOCAL_DB_SUBDIR}/`;

// Keep track of active downloads
const activeDownloads: { [key: string]: FileSystem.DownloadResumable } = {};

// --- Helper Functions ---

/**
 * Ensures the local directory for storing downloaded databases exists.
 */
export async function ensureDownloadDirExists(): Promise<void> {
  // Use LOCAL_DB_DIR again
  const dirInfo = await FileSystem.getInfoAsync(LOCAL_DB_DIR);
  if (!dirInfo.exists) {
    console.log(`[FileDownloader] Creating database directory: ${LOCAL_DB_DIR}`);
    await FileSystem.makeDirectoryAsync(LOCAL_DB_DIR, { intermediates: true });
  }
}

/**
 * Gets the expected local file path within the custom bible_databases directory.
 * @param dbFileName - The name of the database file (e.g., "KJV.db").
 * @returns The full local path.
 */
export function getLocalDbPath(dbFileName: string): string {
  // Use LOCAL_DB_DIR again
  return `${LOCAL_DB_DIR}${dbFileName}`;
}

/**
 * Checks if a specific database file has already been downloaded.
 * @param dbFileName - The name of the database file (e.g., "KJV.db").
 * @returns True if the file exists locally, false otherwise.
 */
export async function checkDbExists(dbFileName: string): Promise<boolean> {
  const fileInfo = await FileSystem.getInfoAsync(getLocalDbPath(dbFileName));
  return fileInfo.exists;
}

/**
 * Lists the filenames of all databases currently downloaded.
 * @returns An array of database filenames (e.g., ["KJV.db", "ASV.db"]).
 */
export async function listDownloadedDbs(): Promise<string[]> {
  try {
    await ensureDownloadDirExists();
    // Read from LOCAL_DB_DIR again
    const files = await FileSystem.readDirectoryAsync(LOCAL_DB_DIR);
    return files.filter(file => file.endsWith('.db')); // Ensure we only list .db files
  } catch (error) {
    console.error('[FileDownloader] Error listing downloaded databases:', error);
    return [];
  }
}

/**
 * Deletes a downloaded database file.
 * @param dbFileName - The name of the database file to delete.
 */
export async function deleteDbFile(dbFileName: string): Promise<void> {
  const localPath = getLocalDbPath(dbFileName);
  try {
    if (await checkDbExists(dbFileName)) {
      console.log(`[FileDownloader] Deleting database: ${localPath}`);
      await FileSystem.deleteAsync(localPath);
    } else {
      console.log(`[FileDownloader] Attempted to delete non-existent file: ${localPath}`);
    }
  } catch (error) {
    console.error(`[FileDownloader] Error deleting file ${localPath}:`, error);
    throw error; // Re-throw to allow UI to handle it
  }
}

// --- Download Management ---

/**
 * Downloads a specific database file from the GitHub repository to a temporary location,
 * then moves it to the final directory. Updates the Zustand store with progress.
 * @param dbFileName - The name of the database file to download (e.g., "KJV.db").
 * @param translationId - The identifier for the translation (used for store updates).
 */
export async function downloadDbFile(dbFileName: string, translationId: string): Promise<void> {
  if (activeDownloads[dbFileName]) {
    console.warn(`[FileDownloader] Download already in progress for: ${dbFileName}`);
    return;
  }

  const { setDownloadStatus, addDownloadedTranslation } = useAppStore.getState();
  const remoteUrl = `${GITHUB_RAW_BASE_URL}/${GITHUB_SQLITE_PATH}/${dbFileName}`;
  // Final destination path
  const finalLocalPath = getLocalDbPath(dbFileName);
  // Temporary download path in cache directory
  const tempLocalPath = `${FileSystem.cacheDirectory}${dbFileName}`;

  await ensureDownloadDirExists(); // Ensure final directory exists

  console.log(`[FileDownloader] Starting download: ${remoteUrl} -> ${tempLocalPath} (temp)`);
  setDownloadStatus(true, translationId, 0, null);

  // Clean up any potentially orphaned temp file first
  await FileSystem.deleteAsync(tempLocalPath, { idempotent: true });

  const downloadResumable = FileSystem.createDownloadResumable(
    remoteUrl,
    tempLocalPath, // Download to temp path
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      setDownloadStatus(true, translationId, progress, null);
    }
  );

  activeDownloads[dbFileName] = downloadResumable;

  try {
    const result = await downloadResumable.downloadAsync();
    delete activeDownloads[dbFileName];

    if (result?.status === 200) {
      console.log(`[FileDownloader] Download finished successfully to temp: ${tempLocalPath}`);
      
      // --- Move file from temp to final location ---
      try {
         console.log(`[FileDownloader] Moving ${tempLocalPath} to ${finalLocalPath}`);
         // Ensure final destination doesn't exist (e.g., from failed previous move)
         await FileSystem.deleteAsync(finalLocalPath, { idempotent: true }); 
         await FileSystem.moveAsync({ from: tempLocalPath, to: finalLocalPath });
         console.log(`[FileDownloader] Move successful.`);
         setDownloadStatus(false, translationId, 1, null);
         addDownloadedTranslation(translationId);
      } catch (moveError) {
         console.error(`[FileDownloader] Failed to move downloaded file:`, moveError);
         // Clean up temp file if move fails
         await FileSystem.deleteAsync(tempLocalPath, { idempotent: true });
         throw new Error(`Failed to move downloaded file: ${dbFileName}`);
      }
      // --- End Move File ---

    } else {
      console.error(`[FileDownloader] Download failed with status: ${result?.status}`);
      await FileSystem.deleteAsync(tempLocalPath, { idempotent: true }); // Clean up temp file
      throw new Error(`Download failed with status ${result?.status}`);
    }
  } catch (error) {
    console.error(`[FileDownloader] Download error for ${dbFileName}:`, error);
    delete activeDownloads[dbFileName];
    await FileSystem.deleteAsync(tempLocalPath, { idempotent: true }); // Clean up temp file
    setDownloadStatus(false, translationId, 0, error instanceof Error ? error.message : String(error));
    throw error; // Re-throw
  } finally {
     if (activeDownloads[dbFileName]) {
       delete activeDownloads[dbFileName];
     }
     // Ensure temp file is cleaned up if somehow still present after error/success
     FileSystem.getInfoAsync(tempLocalPath).then(info => {
         if (info.exists) {
             console.log(`[FileDownloader] Cleaning up orphaned temp file: ${tempLocalPath}`);
             FileSystem.deleteAsync(tempLocalPath, { idempotent: true });
         }
     }).catch(() => {}); // Ignore errors during cleanup check
  }
}

/**
 * Cancels an ongoing download.
 * @param dbFileName - The name of the database file download to cancel.
 */
export async function cancelDownload(dbFileName: string): Promise<void> {
   const downloadResumable = activeDownloads[dbFileName];
   const tempLocalPath = `${FileSystem.cacheDirectory}${dbFileName}`; // Get temp path
   if (downloadResumable) {
     console.log(`[FileDownloader] Cancelling download for: ${dbFileName}`);
     try {
       await downloadResumable.cancelAsync();
       console.log(`[FileDownloader] Download cancelled for: ${dbFileName}`);
       // Clean up potentially partially downloaded temp file
       await FileSystem.deleteAsync(tempLocalPath, { idempotent: true }); 
     } catch (error) {
       console.error(`[FileDownloader] Error cancelling download for ${dbFileName}:`, error);
     } finally {
       delete activeDownloads[dbFileName];
       // Optionally reset download status in store
       // const { downloadingTranslationId, setDownloadStatus } = useAppStore.getState();
       // if (downloadingTranslationId === dbFileName) { // Need mapping if ID != filename
       //   setDownloadStatus(false, null, 0, "Cancelled by user");
       // }
     }
   } else {
       // If no active download object, still try cleaning up temp file
       await FileSystem.deleteAsync(tempLocalPath, { idempotent: true }); 
   }
} 