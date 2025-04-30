import { FlashList } from "@shopify/flash-list"
import { Text, View, Platform } from "react-native"
import { Link, Stack, useRouter } from "expo-router"
import { useEffect, useState, useMemo } from "react"

import { Button } from "~/components/Button"
import { Container } from "~/components/Container"
import { useAppStore } from "~/store/store"
import { getBooks, type AppBook } from "~/db/database"
import { type ScrollmapperTranslationInfo } from "~/config/translationMap"

const IS_WEB = Platform.OS === 'web'

// Use AppBook type directly
// interface Book extends Pick<ApiBibleBook, 'id' | 'name' | 'abbreviation'> { ... }

type Book = AppBook

export default function BibleBooksScreen() {
  const router = useRouter();
  // Get needed state
  const selectedTranslationId = useAppStore((state) => state.selectedTranslationId); // abbr
  const isDbReady = useAppStore((state) => state.isDbReady); // Get DB readiness flag
  const downloadedTranslationIds = useAppStore((state) => state.downloadedTranslationIds); // abbrs
  const availableTranslations = useAppStore((state) => state.availableTranslations); // ScrollmapperTranslationInfo[]

  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the selected translation object from the map
  const selectedTranslation = useMemo(() => 
      availableTranslations.find(t => t.id === selectedTranslationId), 
      [availableTranslations, selectedTranslationId]
  );

  const translationDisplayName = selectedTranslation 
    ? `${selectedTranslation.name} (${selectedTranslation.abbr})` 
    : "No Translation Selected";

  // Check if the selected translation is downloaded (native only)
  const isSelectedDownloaded = useMemo(() => 
    IS_WEB || (selectedTranslationId ? downloadedTranslationIds.includes(selectedTranslationId) : false),
    [selectedTranslationId, downloadedTranslationIds]
  );

  useEffect(() => {
    const loadBooks = async () => {
      // ** Critical Check: Ensure translation is selected AND DB is ready **
      if (!selectedTranslation || !isDbReady) {
        // If ID selected but DB not ready, show specific message
        if (selectedTranslationId && !isDbReady) {
            console.log("[BibleBooksScreen] Waiting for DB to be ready...");
            setError("Initializing translation data..."); // Or a loading indicator
            setBooks([]);
            setIsLoading(true); // Show loading while DB is switching
        } else {
            // No translation selected at all
            console.log("[BibleBooksScreen] No translation selected.");
            setError("No Bible translation selected.");
            setBooks([]);
            setIsLoading(false);
        }
        return;
      }

      // Web view is deferred
      if (IS_WEB) {
        setError("Web view not yet implemented with this data source.");
        setBooks([]);
        setIsLoading(false); // Stop loading if showing web error
        return;
      }
      
      // Check if downloaded on native (only relevant if DB is supposedly ready)
      if (!isSelectedDownloaded) {
         console.log("[BibleBooksScreen] DB ready but selected translation not marked as downloaded?");
         setError("Selected translation is not downloaded.");
         setBooks([]); 
         setIsLoading(false); // Stop loading if showing download error
         // No need to return, the UI below handles showing download button
         // return;
      }

      // Proceed with loading if DB is ready and platform/download status allows
      console.log(`[BibleBooksScreen] DB is ready. Loading books for ${selectedTranslation.abbr} using ${selectedTranslation.dbFileName}`);
      
      // --- Add detailed logging before DB call ---
      console.log(`[BibleBooksScreen] Preparing to call getBooks. ABBR='${selectedTranslation.abbr}', FILENAME='${selectedTranslation.dbFileName}', ID='${selectedTranslation.id}'`);
      if (!selectedTranslation.abbr) {
        console.error("[BibleBooksScreen] CRITICAL: selectedTranslation.abbr is missing or falsy!", selectedTranslation);
        setError("Internal error: Invalid translation data.");
        setIsLoading(false);
        return; 
      }
      // --- End detailed logging ---

      setIsLoading(true);
      setError(null);
      setBooks([]); // Clear previous books

      try {
        // Validate DB name against selected translation before calling DB
        if (!selectedTranslation.dbFileName) {
             throw new Error(`Missing dbFileName for ${selectedTranslation.abbr}`);
        }
        // Call the DB function - assumes switchActiveDatabase was successful
        const bookData = await getBooks(selectedTranslation.abbr);
        setBooks(bookData);
         if (bookData.length === 0) {
             console.warn(`[BibleBooksScreen] No books found in DB ${selectedTranslation.dbFileName} for ${selectedTranslation.abbr}`);
             setError("No books found for this translation."); // More specific error
         }
      } catch (err) {
        console.error(`[BibleBooksScreen] Error loading books from DB:`, err);
        setError(err instanceof Error ? err.message : "Failed to load books");
      } finally {
        setIsLoading(false);
      }
    };

    // Trigger loadBooks whenever dependencies change
    loadBooks();

  // ** Updated Dependencies **
  }, [selectedTranslationId, selectedTranslation, isDbReady, isSelectedDownloaded]); 

  return (
    <Container>
      <Stack.Screen options={{ title: "Select Book" }} />
      {/* Display current translation */}
      <Text className="text-center text-sm text-gray-600 p-2 bg-gray-100">
        Selected: {translationDisplayName}
      </Text>
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading books...</Text>}
        
        {/* Display specific message and button if no translation is selected */}
        {!isLoading && error === "No Bible translation selected." && (
            <View className="items-center justify-center flex-1">
                <Text className="text-center mb-4 text-red-500">Error: {error}</Text>
                <Button 
                    title="Go to Settings to Select/Download"
                    onPress={() => router.push('/(drawer)/settings')} 
                />
            </View>
        )}

        {/* Display other errors (but not the 'no selection' one handled above) */}
        {!isLoading && error && error !== "No Bible translation selected." && (
             <Text className="text-red-500">Error: {error}</Text>
        )}
        
        {/* Case 1: Not loading, no specific error, but selected translation not downloaded */}
        {!isLoading && !error && !isSelectedDownloaded && !IS_WEB && (
            <View className="items-center justify-center flex-1">
                <Text className="text-center mb-4">This translation is not downloaded.</Text>
                <Button 
                    title="Go to Settings to Download"
                    onPress={() => router.push('/(drawer)/settings')} 
                />
            </View>
        )}

        {/* Case 2: Not loading, no error, downloaded/web, but no books found */}
        {!isLoading && !error && (isSelectedDownloaded || IS_WEB) && books.length === 0 && (
          <Text>No books found. {IS_WEB ? 'Web view TBD.' : 'Data might be missing or empty.'}</Text>
        )}

        {/* Case 3: Not loading, no error, downloaded/web, books found -> Show List */}
        {!isLoading && !error && (isSelectedDownloaded || IS_WEB) && books.length > 0 && (
          <FlashList
            data={books}
            estimatedItemSize={80} // Adjust based on content
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <View className="p-4 bg-white rounded-lg shadow-sm">
                <Text className="text-lg font-semibold">{item.name}</Text>
                {/* Link remains the same, passing the string book ID */}
                <Link
                  href={{
                    pathname: "/(drawer)/(bible)/[bookId]", 
                    params: { bookId: item.id },
                  }}
                  asChild
                >
                  <Button
                    title="Select Book"
                  />
                </Link>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
        )}
      </View>
    </Container>
  )
}
