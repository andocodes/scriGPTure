import { FlashList } from "@shopify/flash-list"
import { Text, View, Platform } from "react-native"
import { Link, Stack } from "expo-router"
import { useEffect, useState } from "react"

import { Button } from "~/components/Button"
import { Container } from "~/components/Container"
import { useAppStore } from "~/store/store"
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
  const { selectedTranslationId, apiBibleApiKey } = useAppStore(state => ({
    selectedTranslationId: state.selectedTranslationId,
    apiBibleApiKey: state.apiBibleApiKey, // Need API key for web fallback
  }))
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Container>
      <Stack.Screen options={{ title: "Select Book" }} />
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading books...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        {!isLoading && !error && books.length === 0 && (
          <Text>No books found. {IS_WEB ? 'Check connection or API key.' : 'Try downloading the translation first.'}</Text>
        )}
        {!isLoading && !error && books.length > 0 && (
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
