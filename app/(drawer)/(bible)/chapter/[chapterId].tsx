import { FlashList } from "@shopify/flash-list";
import { Text, View, Platform, StyleSheet, Pressable, Alert, Clipboard } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import React from 'react';
import ContextMenuView, { type ContextMenuAction } from 'react-native-context-menu-view';

import { Container } from "~/components/Container";
import { useAppStore } from "~/store/store";
import { getVerses, getBooks, type Verse, type AppBook, type FavouriteVerse } from "~/db/database";
const IS_WEB = Platform.OS === 'web';

export default function BibleVerseReaderScreen() {
  // Get params based on the new route structure: [bookId]/[chapterNumber]
  const { bookId, chapterNumber: chapterNumberParam, verseNumber: verseNumberParam } = useLocalSearchParams<{ 
    bookId: string, 
    chapterNumber: string,
    verseNumber?: string 
  }>();
  const navigation = useNavigation();
  const router = useRouter();
  
  // Reference to the FlashList to enable scrolling to specific verses
  const flashListRef = React.useRef(null);
  
  // Zustand state and actions
  const selectedTranslationId = useAppStore((state) => state.selectedTranslationId); // abbr
  const isDbReady = useAppStore((state) => state.isDbReady); // <-- Add isDbReady
  const availableTranslations = useAppStore((state) => state.availableTranslations);
  const setCurrentLocation = useAppStore((state) => state.setCurrentLocation);
  const downloadedTranslationIds = useAppStore((state) => state.downloadedTranslationIds);
  const favourites = useAppStore((state) => state.favourites);
  const addFavourite = useAppStore((state) => state.addFavourite);
  const removeFavourite = useAppStore((state) => state.removeFavourite);

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

  // --- Favourites Logic ---
  // Memoize the set of favourite references for quick lookup
  const favouriteRefs = useMemo(() => {
    const refs = new Set<string>();
    favourites.forEach(fav => {
      // Create a unique key for each favourite based on translation, book, chapter, verse
      refs.add(`${fav.translation_id}_${fav.book_id}_${fav.chapter}_${fav.verse}`);
    });
    return refs;
  }, [favourites]);

  // Function to check if a specific verse is favourited
  const isVerseFavourited = (verse: Verse): boolean => {
    if (!selectedTranslation || !bookId || chapterNumber === null) return false;
    const key = `${selectedTranslation.id}_${bookId}_${chapterNumber}_${verse.verse}`;
    return favouriteRefs.has(key);
  };

  // Function to handle toggling a favourite
  const handleToggleFavourite = (verse: Verse) => {
    if (!selectedTranslation || !bookId || chapterNumber === null) return;
    
    const key = `${selectedTranslation.id}_${bookId}_${chapterNumber}_${verse.verse}`;
    const existingFavourite = favourites.find(fav => 
         `${fav.translation_id}_${fav.book_id}_${fav.chapter}_${fav.verse}` === key
    );

    if (existingFavourite) {
        // Remove favourite
        console.log(`[VerseScreen] Removing favourite ID: ${existingFavourite.id}`);
        removeFavourite(existingFavourite.id);
    } else {
        // Add favourite
        const newFavourite: Omit<FavouriteVerse, 'id' | 'created_at'> = {
            translation_id: selectedTranslation.id,
            book_id: bookId,
            chapter: chapterNumber,
            verse: verse.verse,
            text: verse.text // Store the text
        };
        console.log(`[VerseScreen] Adding new favourite:`, newFavourite);
        addFavourite(newFavourite);
    }
  };
  // --- End Favourites Logic ---

  // --- Send to Chat Logic ---
  const handleSendToChat = (verse: Verse) => {
    if (!selectedTranslation || !bookId || chapterNumber === null) return;

    const reference = `${bookName || bookId} ${chapterNumber}:${verse.verse} (${selectedTranslation.abbr})`;
    const textToSend = verse.text?.trim() || '';
    
    console.log(`[VerseScreen] Sending to chat: ${reference}`);
    // Navigate to chat screen, passing data as params
    router.push({
        pathname: '/(drawer)/(chat)',
        params: {
            verseReference: reference,
            verseText: textToSend
        }
    });
  };
  // --- End Send to Chat Logic ---

  // --- Copy Verse Logic ---
  const handleCopyVerse = async (verse: Verse) => {
    if (!selectedTranslation || !bookId || chapterNumber === null) return;

    try {
      const reference = `${bookName || bookId} ${chapterNumber}:${verse.verse} (${selectedTranslation.abbr})`;
      const textToCopy = `${reference}\n"${verse.text?.trim()}"`;
      
      Clipboard.setString(textToCopy);
      console.log(`[VerseScreen] Copied to clipboard: ${reference}`);
      
      // Give user feedback
      Alert.alert("Copied", `${reference} has been copied to clipboard.`, [{ text: "OK" }], { 
        cancelable: true 
      });
    } catch (error) {
      console.error('[VerseScreen] Error copying to clipboard:', error);
      Alert.alert("Error", "Could not copy verse to clipboard.");
    }
  };
  // --- End Copy Verse Logic ---

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

  // Effect to scroll to a specific verse if verseNumber is provided
  useEffect(() => {
    // Only try to scroll if we have verses loaded and a verse number
    if (!isLoading && verses.length > 0 && verseNumberParam) {
      const verseNum = parseInt(verseNumberParam, 10);
      if (!isNaN(verseNum)) {
        // Find the index of the verse in our verses array
        const verseIndex = verses.findIndex(v => v.verse === verseNum);
        if (verseIndex !== -1 && flashListRef.current) {
          console.log(`[VerseScreen] Scrolling to verse ${verseNum} at index ${verseIndex}`);
          // Scroll to the verse with a slight delay to ensure rendering is complete
          setTimeout(() => {
            if (flashListRef.current) {
              // @ts-ignore - TypeScript doesn't know about scrollToIndex
              flashListRef.current.scrollToIndex({ 
                index: verseIndex,
                animated: true,
                viewOffset: 50 // Add some offset at the top
              });
            }
          }, 300);
        }
      }
    }
  }, [verses, isLoading, verseNumberParam]);

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
      <View style={styles.container}>
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
            ref={flashListRef}
            data={verses}
            estimatedItemSize={50} 
            renderItem={({ item }) => { 
              const isFavourited = isVerseFavourited(item);
              
              // Define menu actions for this specific verse
              const menuActions: ContextMenuAction[] = [
                {
                  title: isFavourited ? "Unfavourite" : "Favourite",
                  systemIcon: isFavourited ? 'star.fill' : 'star',
                },
                {
                  title: "Send to Chat",
                  systemIcon: 'paperplane',
                },
                {
                  title: "Copy Verse",
                  systemIcon: 'doc.on.doc',
                },
              ];
              
              // Render the verse row with the context menu
              return (
                <ContextMenuView
                  actions={menuActions}
                  onPress={({ nativeEvent }: { nativeEvent: { index: number; name: string } }) => { 
                    console.log(`[VerseScreen] Context menu action pressed: index=${nativeEvent.index}, title='${nativeEvent.name}'`);
                    switch (nativeEvent.index) {
                      case 0: // Favourite/Unfavourite
                        handleToggleFavourite(item);
                        break;
                      case 1: // Send to Chat
                        handleSendToChat(item);
                        break;
                      case 2: // Copy Verse
                        handleCopyVerse(item);
                        break;
                    }
                  }}
                >
                  <Pressable style={[
                    styles.verseRow,
                    isFavourited && styles.favouritedVerse
                  ]}>
                    <Text style={styles.verseNumber}>{item.verse}</Text>
                    <Text style={styles.verseText}>{item.text?.trim() || '[Verse text not available]'}</Text>
                  </Pressable>
                </ContextMenuView>
              );
            }}
            keyExtractor={(item) => item.verse.toString()}
            extraData={favourites} // Still needed for fav updates
          />
        )}
      </View>
    </Container>
  );
}

// Update Styles
const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 15,
      paddingTop: 10,
    },
    verseRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 12,
      alignItems: 'flex-start',
      backgroundColor: 'transparent',
      borderRadius: 6,
    },
    favouritedVerse: {
      backgroundColor: '#fff8e1', // Soft yellow background
      borderLeftWidth: 3,
      borderLeftColor: '#ffd54f', // Amber/gold border
    },
    verseNumber: {
      fontSize: 13, 
      fontWeight: 'bold',
      width: 28, 
      textAlign: 'right',
      marginRight: 8,
      color: '#555',
      paddingTop: 2,
    },
    verseText: {
      flex: 1, 
      fontSize: 17, 
      lineHeight: 24,
    },
}); 