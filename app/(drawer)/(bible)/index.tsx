import { FlashList } from "@shopify/flash-list"
import { Text, View, Platform } from "react-native"
import { Link, Stack, useRouter } from "expo-router"
import { useEffect, useState } from "react"

import { Button } from "~/components/Button"
import { Container } from "~/components/Container"
import { useAppStore } from "~/store/store"
import type { AppState } from "~/store/store"
import * as db from "~/db/database"
import * as api from "~/services/apiBible"
import { type ApiBibleBook } from "~/services/apiBible"

const IS_WEB = Platform.OS === 'web'

// Define local book type based on DB schema
interface Book extends Pick<ApiBibleBook, 'id' | 'name' | 'abbreviation'> {
  // Add any other fields needed from the DB 'books' table if different
  chapterCount?: number; // We might need to query this separately later
}

export default function BibleBooksScreen() {
  const router = useRouter();
  // Select primitive values individually
  const selectedTranslationId = useAppStore((state: AppState) => state.selectedTranslationId);
  const apiBibleApiKey = useAppStore((state: AppState) => state.apiBibleApiKey);
  const downloadedTranslationIds = useAppStore((state: AppState) => state.downloadedTranslationIds);
  const availableTranslations = useAppStore((state: AppState) => state.availableTranslations);

  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the name of the selected translation
  const selectedTranslation = availableTranslations.find(t => t.id === selectedTranslationId);
  const translationDisplayName = selectedTranslation ? `${selectedTranslation.name} (${selectedTranslation.abbreviation})` : "No Translation Selected";

  useEffect(() => {
    const loadBooks = async () => {
      let currentTranslationId = selectedTranslationId

      // TEMP: Default to KJV if nothing selected for initial testing
      // TODO: Implement proper translation selection/default logic
      if (!currentTranslationId) {
        console.log("No translation selected, defaulting to KJV for loading books.")
        currentTranslationId = 'de4e12af7f28f599-01' // KJV ID from API.Bible
      }
      // END TEMP

      if (!currentTranslationId) {
        setError("No Bible translation selected or defaulted.")
        setBooks([])
        return
      }

      // Check for API key specifically on web
      if (IS_WEB && !apiBibleApiKey) {
        setError("API Key is required for web view.")
        setBooks([])
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        let bookData: Book[] = []
        if (IS_WEB) {
          console.log(`WEB: Fetching books for ${currentTranslationId} from API...`)
          const apiBooks = await api.fetchBooksForTranslation(currentTranslationId)
          // Map API response to local Book type
          bookData = apiBooks.map(b => ({ 
            id: b.id, 
            name: b.name, 
            abbreviation: b.abbreviation, 
            // chapterCount could potentially be fetched if API supports it or via separate calls
          }))
        } else {
          console.log(`NATIVE: Fetching books for ${currentTranslationId} from DB...`)
          // Fetch books from the database for the selected translation
          bookData = await db.all<Book>(
            "SELECT id, abbreviation, name FROM books WHERE translation_id = ? ORDER BY sort_order ASC",
            [currentTranslationId],
          )
        }
        setBooks(bookData)
      } catch (err) {
        console.error(`Error loading books (${IS_WEB ? 'API' : 'DB'}):`, err)
        setError(err instanceof Error ? err.message : "Failed to load books")
      } finally {
        setIsLoading(false)
      }
    }

    loadBooks()
  }, [selectedTranslationId, apiBibleApiKey]) // Re-run if selection or key changes

  // Check if the selected translation is downloaded (only relevant on native)
  const isSelectedDownloaded = IS_WEB || (selectedTranslationId ? downloadedTranslationIds.includes(selectedTranslationId) : false);

  return (
    <Container>
      <Stack.Screen options={{ title: "Select Book" }} />
      {/* Display current translation */}
      <Text className="text-center text-sm text-gray-600 p-2 bg-gray-100">
        Selected: {translationDisplayName}
      </Text>
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading books...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        
        {/* Case 1: Not loading, no error, but selected translation not downloaded on native */}
        {!isLoading && !error && !isSelectedDownloaded && !IS_WEB && (
            <View className="items-center justify-center flex-1">
                <Text className="text-center mb-4">This translation is not downloaded.</Text>
                <Button 
                    title="Go to Settings to Download"
                    onPress={() => router.push('/(drawer)/settings')} 
                />
            </View>
        )}

        {/* Case 2: Not loading, no error, downloaded (or web), but no books found (e.g., API error) */}
        {!isLoading && !error && isSelectedDownloaded && books.length === 0 && (
          <Text>No books found. {IS_WEB ? 'Check connection or API key.' : 'Download might be incomplete or empty.'}</Text>
        )}

        {/* Case 3: Not loading, no error, downloaded (or web), books found -> Show List */}
        {!isLoading && !error && isSelectedDownloaded && books.length > 0 && (
          <FlashList
            data={books}
            estimatedItemSize={80} // Adjust based on content
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <View className="p-4 bg-white rounded-lg shadow-sm">
                <Text className="text-lg font-semibold">{item.name}</Text>
                {/* Display abbreviation or chapter count if available */}
                {/* <Text className="text-gray-600 mb-3">{item.abbreviation}</Text> */}
                <Link
                  href={{
                    pathname: "/(drawer)/(bible)/[bookId]", // Navigate to chapter selection
                    params: { bookId: item.id },
                  }}
                  asChild
                >
                  <Button
                    title="Select Book"
                    // variant="outline" // Example of using a different button style
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
