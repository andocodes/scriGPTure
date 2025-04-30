import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Container } from '~/components/Container';
import { useAppStore } from '~/store/store';
import { type FavouriteVerse } from '~/db/database';

export default function FavouritesScreen() {
    const router = useRouter();
    
    // Get favourites state and remove action from store
    const favourites = useAppStore((state) => state.favourites);
    const favouritesLoading = useAppStore((state) => state.favouritesLoading);
    const favouritesError = useAppStore((state) => state.favouritesError);
    const removeFavourite = useAppStore((state) => state.removeFavourite);
    const setSelectedTranslation = useAppStore((state) => state.setSelectedTranslation); // To switch translation

    const handleRemoveFavourite = (id: number) => {
        // Optionally add confirmation alert here
        removeFavourite(id);
    };
    
    // Navigate to the specific verse
    const handleGoToVerse = async (item: FavouriteVerse) => {
        console.log("[FavouritesScreen] Attempting to navigate to verse:", item); // Log item data
        // Ensure the correct translation is selected first
        console.log(`[FavouritesScreen] Setting selected translation to: ${item.translation_id}`);
        await setSelectedTranslation(item.translation_id); 
        
        // Construct the verse screen path params
        const chapterId = `${item.book_id}_${item.chapter}`;
        const params = {
            chapterId: chapterId,
            bookId: item.book_id,
            chapterNumber: item.chapter,
            verseNumber: item.verse, // Pass verse number to scroll to it
        };
        const pathname = `/(drawer)/(bible)/chapter/[chapterId]`;
        console.log(`[FavouritesScreen] Navigating to pathname: ${pathname} with params:`, params); // Log path and params
        
        // Navigate
        try {
             router.push({ pathname, params });
             console.log("[FavouritesScreen] Navigation push successful.");
        } catch (error) {
             console.error("[FavouritesScreen] Navigation push failed:", error);
        }
    };

    const renderItem = ({ item }: { item: FavouriteVerse }) => (
        <View style={styles.itemContainer}>
            <TouchableOpacity style={styles.textContainer} onPress={() => handleGoToVerse(item)}>
                 <Text style={styles.reference}>
                     {item.book_id} {item.chapter}:{item.verse} ({item.translation_id})
                 </Text>
                 <Text style={styles.verseText}>{item.text}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveFavourite(item.id)} style={styles.deleteButton}>
                <MaterialIcons name="delete-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
        </View>
    );

    return (
        <Container>
            {/* Stack Title is set in _layout.tsx */}
            {/* <Stack.Screen options={{ title: 'Favourites' }} /> */}
            <View style={styles.container}>
                {favouritesLoading && <Text>Loading favourites...</Text>}
                {favouritesError && <Text style={styles.errorText}>Error: {favouritesError}</Text>}
                
                {!favouritesLoading && !favouritesError && favourites.length === 0 && (
                    <Text style={styles.emptyText}>You haven't favourited any verses yet.</Text>
                )}
                
                {!favouritesLoading && !favouritesError && favourites.length > 0 && (
                    <FlatList
                        data={favourites}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                )}
            </View>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        backgroundColor: '#fff', // Add background to list items
        paddingHorizontal: 15,
        borderRadius: 8,
    },
    textContainer: {
      flex: 1, // Allow text to take up space
      marginRight: 10, // Space before delete button
    },
    reference: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    verseText: {
        fontSize: 16,
        color: '#555',
    },
    deleteButton: {
        padding: 5, // Make tap target larger
    },
    separator: {
        height: 10, // Space between items
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 50,
      fontSize: 16,
      color: '#777',
    }
}); 