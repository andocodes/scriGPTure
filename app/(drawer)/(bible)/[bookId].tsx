import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { Button } from "~/components/Button";
import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import type { AppState } from "~/store/store";
import * as db from "~/db/database";
import * as api from "~/services/apiBible";
import { type ApiBibleChapter } from "~/services/apiBible";

const IS_WEB = Platform.OS === 'web';

// Define local chapter type based on DB schema
interface Chapter extends Pick<ApiBibleChapter, 'id' | 'reference'> {
  // Add any other fields needed from the DB 'chapters' table
  bookName?: string; // Might fetch this too for context
}

export default function BibleChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  // Select state individually
  const selectedTranslationId = useAppStore((state: AppState) => state.selectedTranslationId);
  const apiBibleApiKey = useAppStore((state: AppState) => state.apiBibleApiKey);
  const availableTranslations = useAppStore((state: AppState) => state.availableTranslations); // Get available translations
  
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bookName, setBookName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChapters = async () => {
        let currentTranslationId = selectedTranslationId;
        // TEMP Default
        if (!currentTranslationId) {
            console.log("No translation selected, defaulting to KJV for loading chapters.");
            currentTranslationId = 'de4e12af7f28f599-01'; // KJV ID
        }
        // END TEMP

        if (!currentTranslationId || !bookId) {
            setError("Missing translation or book ID.");
            setChapters([]);
            setBookName(null);
            return;
        }
        
        if (IS_WEB && !apiBibleApiKey) {
            setError("API Key is required for web view.");
            setChapters([]);
            return;
        }

      setIsLoading(true);
      setError(null);
      try {
        let chapterData: Chapter[] = [];
        let fetchedBookName: string | null = bookId; // Fallback book name

        if (IS_WEB) {
          console.log(`WEB: Fetching chapters for ${bookId} in ${currentTranslationId} from API...`);
          // Fetch chapters directly from API
          // Note: API.Bible books endpoint can include chapters, but we fetched them separately.
          // We could fetch book details again here to get the name if needed, or rely on nav params.
          // For simplicity, let's assume we might not have the accurate book name on web initially.
          const apiChapters = await api.fetchChaptersForBook(currentTranslationId, bookId);
          // We might need to fetch book details separately if name isn't passed
          // fetchedBookName = (await api.fetchBookDetails(currentTranslationId, bookId)).name; 
          chapterData = apiChapters.map(c => ({ id: c.id, reference: c.reference }));
          // Assuming book name might not be readily available from this API call alone
          fetchedBookName = bookId; // Placeholder
        } else {
          console.log(`NATIVE: Fetching chapters for ${bookId} in ${currentTranslationId} from DB...`);
          // Fetch book name for the title from DB
          const bookInfo = await db.get<{ name: string }>(
            "SELECT name FROM books WHERE translation_id = ? AND id = ?",
            [currentTranslationId, bookId]
          );
          fetchedBookName = bookInfo?.name ?? bookId;

          // Fetch chapters for the book from DB
          chapterData = await db.all<Chapter>(
            "SELECT id, reference FROM chapters WHERE translation_id = ? AND book_id = ? ORDER BY sort_order ASC",
            [currentTranslationId, bookId],
          );
        }
        setBookName(fetchedBookName);
        // Filter out potential book entry (assuming chapter refs contain a space)
        const filteredChapters = chapterData.filter(c => c.reference.includes(' '));
        setChapters(filteredChapters);

      } catch (err) {
        console.error(`Error loading chapters (${IS_WEB ? 'API' : 'DB'}):`, err);
        setError(err instanceof Error ? err.message : "Failed to load chapters");
      } finally {
        setIsLoading(false);
      }
    };

    loadChapters();
  }, [selectedTranslationId, bookId, apiBibleApiKey]);

  // Find the abbreviation of the selected translation
  const selectedTranslationAbbr = availableTranslations.find(t => t.id === selectedTranslationId)?.abbreviation ?? '';
  const screenTitle = bookName ? `${bookName} (${selectedTranslationAbbr})` : `Select Chapter (${selectedTranslationAbbr})`;

  return (
    <Container>
      <Stack.Screen options={{ title: screenTitle, headerBackVisible: true }} />
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading chapters...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        {!isLoading && !error && chapters.length === 0 && (
          <Text>No chapters found. {IS_WEB ? 'Check connection/API key.' : 'Try downloading.'}</Text>
        )}
        {!isLoading && !error && chapters.length > 0 && (
          <FlashList
            data={chapters}
            estimatedItemSize={60}
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => (
              <View className="p-4 bg-white rounded-lg shadow-sm flex-row justify-between items-center">
                <Text className="text-lg font-medium">{item.reference}</Text>
                <Link
                  href={{
                    pathname: "/(drawer)/(bible)/chapter/[chapterId]",
                    params: { chapterId: item.id },
                  }}
                  asChild
                >
                  <Button title="Read" />
                </Link>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
        )}
      </View>
    </Container>
  );
} 