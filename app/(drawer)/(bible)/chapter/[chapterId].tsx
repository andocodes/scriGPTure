import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform } from "react-native";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import React from 'react';

import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import { getVerses, getBooks, type Verse, type AppBook } from "~/db/database";
import { type ScrollmapperTranslationInfo } from "~/config/translationMap";

const IS_WEB = Platform.OS === 'web';

export default function BibleVerseReaderScreen() {
  // Get params based on the new route structure: [bookId]/[chapterNumber]
  const { bookId, chapterNumber: chapterNumberParam } = useLocalSearchParams<{ bookId: string, chapterNumber: string }>();
  const navigation = useNavigation();
  
  // Zustand state and actions
  const selectedTranslationId = useAppStore((state) => state.selectedTranslationId); // abbr
  const isDbReady = useAppStore((state) => state.isDbReady); // <-- Add isDbReady
  const availableTranslations = useAppStore((state) => state.availableTranslations);
  const setCurrentLocation = useAppStore((state) => state.setCurrentLocation);
  const downloadedTranslationIds = useAppStore((state) => state.downloadedTranslationIds);

  // Component state
  const [verses, setVerses] = useState<Verse[]>([]); // Use Verse type from db
  const [bookName, setBookName] = useState<string | null>(bookId ?? 'Book');
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
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
    const loadVerseData = async () => {
      const chapterNum = parseInt(chapterNumberParam ?? '', 10);
      setChapterNumber(isNaN(chapterNum) ? null : chapterNum); // Update chapter number state

      // Add isDbReady check here
      if (!selectedTranslation || !bookId || isNaN(chapterNum) || !isDbReady) {
        // Handle waiting state if ID selected but DB not ready
        if (selectedTranslationId && bookId && !isNaN(chapterNum) && !isDbReady) {
             console.log(`[VerseScreen] Waiting for DB to be ready for ${selectedTranslationId}...`);
             setError("Initializing translation data...");
             setIsLoading(true);
             setVerses([]);
             setBookName(bookId); // Keep param bookId initially
        } else {
            setError("Missing translation, book ID, or valid chapter number.");
            setIsLoading(false);
            setVerses([]);
            setBookName(bookId); // Keep param bookId if no translation
        }
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
         setIsLoading(false); // Also set loading false if we show this error
         // Allow UI below to handle showing button/message
      }

      // Only proceed if DB is ready and translation is downloaded (or web)
      if (isSelectedDownloaded || IS_WEB) { // Check needed here too
          console.log(`[VerseScreen] DB ready for ${selectedTranslation.abbr}. Loading data for ${bookId} ${chapterNum}...`);
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

            // Update current location in Zustand store
            setCurrentLocation(bookId, chapterNum);

          } catch (err) {
            console.error(`[VerseScreen] Error loading verse data from DB:`, err);
            setError(err instanceof Error ? err.message : "Failed to load verses");
            setBookName(bookId); // Reset to param on error
          } finally {
            setIsLoading(false);
          }
      } // End of if(isSelectedDownloaded || IS_WEB)
    };

    // Call loadVerseData whenever dependencies change
    loadVerseData();

  }, [selectedTranslationId, selectedTranslation, bookId, chapterNumberParam, setCurrentLocation, isSelectedDownloaded, isDbReady]);

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
            estimatedItemSize={50} // Adjust based on expected text height
            renderItem={({ item }) => {
              // item is now { verse: number, text: string }
              return (
                <View className="flex-row mb-2">
                  <Text className="text-sm font-bold w-8 pt-1">
                    {item.verse} 
                  </Text>
                  {/* Render plain text directly */}
                  <Text style={{ flex: 1, fontSize: 16 }}> 
                    {item.text?.trim() || '[Verse text not available]'} 
                  </Text>
                </View>
              );
            }}
            keyExtractor={(item) => item.verse.toString()}
          />
        )}
      </View>
    </Container>
  );
} 