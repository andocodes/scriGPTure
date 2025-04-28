import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import RenderHTML from 'react-native-render-html'; // To render HTML content from API
import { useWindowDimensions } from 'react-native';

import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import * as db from "~/db/database";
import * as api from "~/services/apiBible";
import { type ApiBibleVerse } from "~/services/apiBible";

const IS_WEB = Platform.OS === 'web';

// Define local verse type based on DB schema
// Include 'reference' which usually contains the verse number
interface Verse extends Pick<ApiBibleVerse, 'id' | 'content' | 'reference'> {
  // Add any other fields needed from the DB 'verses' table
}

// Helper to extract verse number from reference (e.g., "Genesis 1:1" -> "1")
function extractVerseNumber(reference: string): string {
    const parts = reference?.split(':');
    return parts?.[1] ?? '?'; // Return last part after ':' or ' ? '
}

export default function BibleChapterReaderScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const { selectedTranslationId, setCurrentLocation, apiBibleApiKey } = useAppStore(state => ({
      selectedTranslationId: state.selectedTranslationId,
      setCurrentLocation: state.setCurrentLocation,
      apiBibleApiKey: state.apiBibleApiKey, // Need API key for web fallback
  }));

  const [verses, setVerses] = useState<Verse[]>([]);
  const [chapterReference, setChapterReference] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const loadChapterData = async () => {
      let currentTranslationId = selectedTranslationId;
      // TEMP Default
      if (!currentTranslationId) {
          console.log("No translation selected, defaulting to KJV for loading verses.");
          currentTranslationId = 'de4e12af7f28f599-01'; // KJV ID
      }
      // END TEMP

      if (!currentTranslationId || !chapterId) {
        setError("Missing translation or chapter ID.");
        setVerses([]);
        setChapterReference(null);
        return;
      }
      
      if (IS_WEB && !apiBibleApiKey) {
          setError("API Key is required for web view.");
          setVerses([]);
          return;
      }

      setIsLoading(true);
      setError(null);
      try {
        let verseData: Verse[] = [];
        let fetchedChapterRef: string | null = chapterId; // Fallback
        let fetchedBookId: string | null = null;

        if (IS_WEB) {
          console.log(`WEB: Fetching verses for ${chapterId} in ${currentTranslationId} from API...`);
          // Fetch verses directly from API
          // We don't easily get the nice chapter reference (e.g., "Genesis 1") or book ID from this call
          // We might need another API call or derive it from chapterId if possible.
          fetchedChapterRef = chapterId; // Use ID as ref for now
          const apiVerses = await api.fetchVersesForChapter(currentTranslationId, chapterId);
          verseData = apiVerses.map(v => ({ 
              id: v.id, 
              content: v.content, 
              reference: v.reference 
            }));
            // Extract bookId from chapterId (e.g., GEN.1 -> GEN)
           fetchedBookId = chapterId.split('.')[0] || null;

        } else {
          console.log(`NATIVE: Fetching verses for ${chapterId} in ${currentTranslationId} from DB...`);
          // Fetch chapter reference for the title from DB
          const chapterInfo = await db.get<{ reference: string, book_id: string }>(
            "SELECT reference, book_id FROM chapters WHERE translation_id = ? AND id = ?",
            [currentTranslationId, chapterId]
          );
          fetchedChapterRef = chapterInfo?.reference ?? chapterId;
          fetchedBookId = chapterInfo?.book_id ?? null;

          // Fetch verses for the chapter from DB
          verseData = await db.all<Verse>(
            "SELECT id, reference, content FROM verses WHERE translation_id = ? AND chapter_id = ? ORDER BY sort_order ASC",
            [currentTranslationId, chapterId],
          );
        }

        setChapterReference(fetchedChapterRef);
        setVerses(verseData);

        // Update current location in Zustand store if we found a book ID
        if (fetchedBookId) {
            setCurrentLocation(fetchedBookId, chapterId);
        }

      } catch (err) {
        console.error(`Error loading chapter data (${IS_WEB ? 'API' : 'DB'}):`, err);
        setError(err instanceof Error ? err.message : "Failed to load chapter data");
      } finally {
        setIsLoading(false);
      }
    };

    loadChapterData();
  }, [selectedTranslationId, chapterId, setCurrentLocation, apiBibleApiKey]);

  return (
    <Container>
      <Stack.Screen options={{ title: chapterReference ?? "Loading..." }} />
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading verses...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        {!isLoading && !error && verses.length === 0 && (
          <Text>No verses found. {IS_WEB ? 'Check connection/API key.' : 'Try downloading.'}</Text>
        )}
        {!isLoading && !error && verses.length > 0 && (
          <FlashList
            data={verses}
            estimatedItemSize={50} // Adjust
            renderItem={({ item }) => (
              <View className="flex-row mb-2">
                <Text className="text-sm font-bold w-8 pt-1">
                  {extractVerseNumber(item.reference)} {/* Extract verse num */}
                </Text>
                {/* Render HTML content from verse */}
                <View style={{ flex: 1 }}>
                     <RenderHTML
                        contentWidth={width - 64} // Adjust width based on padding/margins
                        source={{ html: item.content }}
                        // TODO: Configure base styles for fonts, sizes etc.
                        // tagsStyles={tagsStyles}
                    />
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
        )}
      </View>
    </Container>
  );
}

// TODO: Define base styles for RenderHTML
// const tagsStyles = {
//   p: { marginVertical: 0, /* other styles */ },
//   // Add other tags used in API content (span, sup, etc.)
// }; 