import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform } from "react-native";
import { Link, Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useState, useMemo } from "react";

import { Button } from "~/components/Button";
import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import { getChapters, getBooks, type AppBook } from "~/db/database";
import { type ScrollmapperTranslationInfo } from "~/config/translationMap";

const IS_WEB = Platform.OS === 'web';

// Chapter data is now just the number
type ChapterNumber = number;

export default function BibleChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  
  // Get state
  const selectedTranslationId = useAppStore((state) => state.selectedTranslationId);
  const availableTranslations = useAppStore((state) => state.availableTranslations);
  const downloadedTranslationIds = useAppStore((state) => state.downloadedTranslationIds);

  // State for chapter numbers and book name
  const [chapters, setChapters] = useState<ChapterNumber[]>([]);
  const [bookName, setBookName] = useState<string | null>(bookId ?? 'Book');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find the selected translation object
  const selectedTranslation = useMemo(() => 
      availableTranslations.find(t => t.id === selectedTranslationId), 
      [availableTranslations, selectedTranslationId]
  );

  // Check if downloaded
  const isSelectedDownloaded = useMemo(() => 
    IS_WEB || (selectedTranslationId ? downloadedTranslationIds.includes(selectedTranslationId) : false),
    [selectedTranslationId, downloadedTranslationIds]
  );

  useEffect(() => {
    const loadChapterData = async () => {
      if (!selectedTranslation || !bookId) {
        setError("Missing translation or book ID.");
        setChapters([]);
        setBookName(bookId);
        return;
      }

      // Web view deferred
      if (IS_WEB) {
        setError("Web view not yet implemented with this data source.");
        setChapters([]);
        return;
      }

      // Check download status
      if (!isSelectedDownloaded) {
         setError("Selected translation is not downloaded.");
         setChapters([]); 
      }

      setIsLoading(true);
      setError(null);
      setChapters([]);

      try {
        // Fetch book name first using getBooks
        const booksInTranslation = await getBooks(selectedTranslation.abbr);
        const currentBook = booksInTranslation.find(b => b.id === bookId);
        setBookName(currentBook?.name ?? bookId);

        // Then fetch chapter numbers
        const chapterNumbers = await getChapters(selectedTranslation.abbr, bookId);
        setChapters(chapterNumbers);
        
        if (chapterNumbers.length === 0) {
             console.warn(`[ChaptersScreen] No chapters found for ${bookId} in ${selectedTranslation.abbr}`);
             setError("No chapters found for this book.");
         }

      } catch (err) {
        console.error(`[ChaptersScreen] Error loading chapter data from DB:`, err);
        setError(err instanceof Error ? err.message : "Failed to load chapters");
        setBookName(bookId);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedTranslationId && bookId) {
        loadChapterData();
    } else {
         setError(selectedTranslationId ? "Missing book ID" : "No translation selected");
         setChapters([]);
         setIsLoading(false);
    }

  }, [selectedTranslationId, selectedTranslation, bookId, isSelectedDownloaded]);

  const screenTitle = useMemo(() => 
      bookName ? `${bookName} (${selectedTranslation?.abbr ?? ''})` : `Select Chapter`, 
      [bookName, selectedTranslation]
  );

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  return (
    <Container>
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading chapters...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        
        {!isLoading && !error && !isSelectedDownloaded && !IS_WEB && (
             <View className="items-center justify-center flex-1">
                <Text className="text-center mb-4">This translation is not downloaded.</Text>
                <Button 
                    title="Go to Settings to Download"
                    onPress={() => router.push('/(drawer)/settings')} 
                />
            </View>
        )}
        
        {!isLoading && !error && isSelectedDownloaded && chapters.length === 0 && (
          <Text>No chapters found.</Text>
        )}
        
        {!isLoading && !error && isSelectedDownloaded && chapters.length > 0 && (
          <FlashList
            data={chapters}
            estimatedItemSize={60}
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item: chapterNumber }) => (
              <View className="p-4 bg-white rounded-lg shadow-sm flex-row justify-between items-center">
                <Text className="text-lg font-medium">Chapter {chapterNumber}</Text>
                <Link
                  href={{
                    pathname: "/(drawer)/(bible)/chapter/[chapterId]",
                    params: { 
                        chapterId: `${bookId}_${chapterNumber}`,
                        bookId: bookId, 
                        chapterNumber: chapterNumber 
                    },
                  }}
                  asChild
                >
                  <Button title="Read" />
                </Link>
              </View>
            )}
            keyExtractor={(item) => item.toString()}
          />
        )}
      </View>
    </Container>
  );
} 