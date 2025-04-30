import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform } from "react-native";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import RenderHTML from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';

import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import { getVerses, getBooks, type Verse, type AppBook } from "~/db/database";
import { type ScrollmapperTranslationInfo } from "~/config/translationMap";

const IS_WEB = Platform.OS === 'web';

// Define base styles for RenderHTML
const tagsStyles = {
  p: { color: 'black', marginBottom: 8, fontSize: 16 }, // Style for paragraphs
  // Add other tags if needed based on scrollmapper HTML content (e.g., .v for verse numbers?)
};

export default function BibleVerseReaderScreen() {
  // Get params based on the new route structure: [bookId]/[chapterNumber]
  const { bookId, chapterNumber: chapterNumberParam } = useLocalSearchParams<{ bookId: string, chapterNumber: string }>();
  const navigation = useNavigation();
  
  // Zustand state and actions
  const selectedTranslationId = useAppStore((state) => state.selectedTranslationId); // abbr
  const availableTranslations = useAppStore((state) => state.availableTranslations);
  const setCurrentLocation = useAppStore((state) => state.setCurrentLocation);
  const downloadedTranslationIds = useAppStore((state) => state.downloadedTranslationIds);

  // Component state
  const [verses, setVerses] = useState<Verse[]>([]); // Use Verse type from db
  const [bookName, setBookName] = useState<string | null>(bookId ?? 'Book');
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions(); // For RenderHTML width

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
    const loadVerseData = async () => {
      const chapterNum = parseInt(chapterNumberParam ?? '', 10);
      setChapterNumber(isNaN(chapterNum) ? null : chapterNum); // Update chapter number state

      if (!selectedTranslation || !bookId || isNaN(chapterNum)) {
        setError("Missing translation, book ID, or valid chapter number.");
        setVerses([]);
        setBookName(bookId); // Keep param bookId if no translation
        return;
      }
      
      // Web view deferred
      if (IS_WEB) {
        setError("Web view not yet implemented with this data source.");
        setVerses([]);
        return;
      }

      // Check download status
      if (!isSelectedDownloaded) {
         setError("Selected translation is not downloaded.");
         setVerses([]); 
         // Allow UI below to handle showing button/message
      }

      setIsLoading(true);
      setError(null);
      setVerses([]); // Clear previous verses

      try {
        // Fetch book name if needed (could be passed from previous screen too)
        // Let's fetch it here for robustness
        // Pass only the abbreviation
        const booksInTranslation = await getBooks(selectedTranslation.abbr);
        const currentBook = booksInTranslation.find(b => b.id === bookId);
        setBookName(currentBook?.name ?? bookId); // Update book name state

        // Fetch verses using the new function
        // Pass abbr, bookId, and chapterNum
        const verseData = await getVerses(selectedTranslation.abbr, bookId, chapterNum);
        setVerses(verseData);

        // --- LOG RAW VERSE TEXT ---
        if (verseData && verseData.length > 0) {
          console.log(`[VerseScreen] Raw text for first verse (${bookId} ${chapterNum}:${verseData[0].verse}):`, verseData[0].text);
          if (verseData.length > 1) {
            console.log(`[VerseScreen] Raw text for second verse (${bookId} ${chapterNum}:${verseData[1].verse}):`, verseData[1].text);
          }
        }
        // --- END LOG ---

        if (verseData.length === 0) {
             console.warn(`[VerseScreen] No verses found for ${bookId} ${chapterNum} in ${selectedTranslation.abbr}`);
             setError("No verses found for this chapter.");
         }

        // Update current location in Zustand store
        setCurrentLocation(bookId, chapterNum);

      } catch (err) {
        console.error(`[VerseScreen] Error loading verse data from DB:`, err);
        setError(err instanceof Error ? err.message : "Failed to load verses");
        setBookName(bookId); // Reset to param on error
      } finally {
        setIsLoading(false);
      }
    };

    // Only load if translation is selected and params exist
    if (selectedTranslationId && bookId && chapterNumberParam) {
        loadVerseData();
    } else {
         setError("Missing translation, book, or chapter information.");
         setVerses([]);
         setIsLoading(false);
    }

  }, [selectedTranslationId, selectedTranslation, bookId, chapterNumberParam, setCurrentLocation, isSelectedDownloaded]); // Add isSelectedDownloaded dependency

  // Update header title dynamically
  const screenTitle = useMemo(() => 
      (bookName && chapterNumber !== null) 
          ? `${bookName} ${chapterNumber} (${selectedTranslation?.abbr ?? ''})` 
          : `Loading...`, 
      [bookName, chapterNumber, selectedTranslation]
  );

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  return (
    <Container>
      <View className="flex-1 p-4">
        {isLoading && <Text>Loading verses...</Text>}
        {error && <Text className="text-red-500">Error: {error}</Text>}
        
        {/* Handle not downloaded case */}
        {!isLoading && !error && !isSelectedDownloaded && !IS_WEB && (
             <View className="items-center justify-center flex-1">
                <Text className="text-center mb-4">This translation is not downloaded.</Text>
                {/* Could add button to go to settings */}
            </View>
        )}
        
        {/* Handle no verses found */} 
        {!isLoading && !error && isSelectedDownloaded && verses.length === 0 && (
          <Text>No verses found for this chapter.</Text>
        )}
        
        {/* Display verse list */} 
        {!isLoading && !error && isSelectedDownloaded && verses.length > 0 && (
          <FlashList
            data={verses}
            estimatedItemSize={50} // Adjust
            renderItem={({ item }) => {
              // item is now { verse: number, text: string }
              return (
                <View className="flex-row mb-2">
                  <Text className="text-sm font-bold w-8 pt-1">
                    {item.verse} 
                  </Text>
                  <View style={{ flex: 1 }}>
                     {item.text && item.text.trim() !== '' ? (
                         <RenderHTML
                            contentWidth={width - 64} // Adjust width based on padding/margins
                            source={{ html: item.text }} // Use item.text directly
                            baseStyle={{ color: 'black', fontSize: 16 }} // Consistent font size
                            tagsStyles={tagsStyles}
                        />
                     ) : (
                         <Text style={{color: '#999', fontSize: 16, fontStyle: 'italic'}}>[Verse text not available]</Text>
                     )}
                  </View>
                </View>
              );
            }}
            // Use verse number for key - requires combining with something if verse numbers aren't unique (e.g., verse 0)
            // Assuming verse number is unique within the chapter for now
            keyExtractor={(item) => item.verse.toString()}
          />
        )}
      </View>
    </Container>
  );
} 