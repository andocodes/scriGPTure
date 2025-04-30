import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Platform, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';

import { Container } from '~/components/Container';
import { useAppStore } from '~/store/store';
// Import new services and config
import { type ScrollmapperTranslationInfo } from '~/config/translationMap';
import { downloadDbFile, deleteDbFile, checkDbExists } from '~/services/fileDownloader';

// Remove old imports
// import { fetchAvailableTranslations, downloadAndStoreTranslation, type ApiBibleTranslation } from '~/services/apiBible';
// import * as db from '~/db/database';

const IS_WEB = Platform.OS === 'web';

// Interface is simpler now, mainly for type clarity in the component
interface DisplayTranslation extends ScrollmapperTranslationInfo {
    isDownloaded: boolean;
    isActive: boolean;
}

export default function SettingsScreen() {
    // Get state from Zustand store
    const apiKeysLoaded = useAppStore((state) => state.apiKeysLoaded); // Still needed for OpenRouter check?
    const availableTranslations = useAppStore((state) => state.availableTranslations); // Now uses Scrollmapper map
    const selectedTranslationId = useAppStore((state) => state.selectedTranslationId); // Is the abbr
    const setSelectedTranslation = useAppStore((state) => state.setSelectedTranslation);
    const isDownloading = useAppStore(state => state.isDownloading);
    const downloadProgress = useAppStore(state => state.downloadProgress);
    const downloadError = useAppStore(state => state.downloadError);
    const downloadingTranslationId = useAppStore(state => state.downloadingTranslationId); // Is the abbr
    const downloadedTranslationIds = useAppStore(state => state.downloadedTranslationIds); // Array of abbrs
    const removeDownloadedTranslation = useAppStore(state => state.removeDownloadedTranslation); // Action

    // Local component state
    // const [isLoading, setIsLoading] = useState(false); // Maybe needed for delete?
    const [error, setError] = useState<string | null>(null); // For local errors if any
    const [searchTerm, setSearchTerm] = useState('');

    // The list is now derived directly from the store + download status
    const displayList = useMemo(() => {
        const downloadedSet = new Set(downloadedTranslationIds);
        return availableTranslations.map(t => ({
            ...t,
            // isDownloaded is based on presence in downloadedTranslationIds from store
            isDownloaded: IS_WEB ? false : downloadedSet.has(t.id), // Use t.id (abbr)
            isActive: t.id === selectedTranslationId,
        }));
    }, [availableTranslations, downloadedTranslationIds, selectedTranslationId]);

    // Filter logic: derive filtered list based on searchTerm
    const filteredList = useMemo(() => displayList.filter(item => {
        if (!searchTerm) return true; // Show all if search is empty
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
            item.name.toLowerCase().includes(lowerSearchTerm) ||
            item.abbr.toLowerCase().includes(lowerSearchTerm) ||
            item.lang.toLowerCase().includes(lowerSearchTerm)
        );
    }), [displayList, searchTerm]);

    // --- Event Handlers ---

    const handleSelectItem = (item: DisplayTranslation) => {
        console.log(`[Settings] Selecting item: ${item.id}`);
        setSelectedTranslation(item.id);
    };

    const handleDownloadItem = (item: DisplayTranslation) => {
         if (IS_WEB || isDownloading) return; // Should not happen if button disabled, but check anyway

        Alert.alert(
            "Confirm Download",
            `Download the ${item.name} translation (${item.abbr})? This may take some time and use data.`, 
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Download", 
                    onPress: async () => {
                        console.log(`[Settings] Starting download for: ${item.dbFileName}`);
                        try {
                             // Call new download function
                            await downloadDbFile(item.dbFileName, item.id); // Pass dbFilename and id (abbr)
                            // Store updates progress and adds to downloaded list on success
                            console.log(`[Settings] Download call finished for ${item.dbFileName}.`);
                        } catch (err) {
                            console.error(`[Settings] Download initiation failed for ${item.dbFileName}:`, err);
                            // Error state is set in store by the download service
                            Alert.alert("Download Error", err instanceof Error ? err.message : "An unknown error occurred.");
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteItem = (item: DisplayTranslation) => {
         if (IS_WEB || isDownloading || !item.isDownloaded) return;

         Alert.alert(
            "Confirm Delete",
            `Delete the downloaded data for ${item.name} (${item.abbr})?`, 
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        console.log(`[Settings] Deleting: ${item.dbFileName}`);
                        // TODO: Add local loading state if needed
                        try {
                            await deleteDbFile(item.dbFileName);
                            removeDownloadedTranslation(item.id); // Update store
                            console.log(`[Settings] Deleted ${item.dbFileName} successfully.`);
                        } catch (err) {
                             console.error(`[Settings] Failed to delete ${item.dbFileName}:`, err);
                             Alert.alert("Delete Error", err instanceof Error ? err.message : "An unknown error occurred.");
                        }
                    }
                }
            ]
        );
    };

    // --- Render Logic ---

    const renderItem = ({ item }: { item: DisplayTranslation }) => {
        // Determine current status flags directly here using store state
        const isItemDownloaded = IS_WEB ? false : downloadedTranslationIds.includes(item.id);
        const isItemActive = item.id === selectedTranslationId;
        const isCurrentItemDownloading = isDownloading && downloadingTranslationId === item.id;
        // Disable press if another download is active
        const pressDisabled = !IS_WEB && isDownloading && !isCurrentItemDownloading;

        return (
            <Pressable
                disabled={pressDisabled} 
                style={({ pressed }) => [
                    styles.itemBase,
                    isItemActive && styles.itemActive,
                    (pressed || pressDisabled) && styles.itemDisabled,
                ]}
                // Select if downloaded, otherwise trigger download
                onPress={() => isItemDownloaded ? handleSelectItem(item) : handleDownloadItem(item)}
            >
                <View style={styles.infoContainer}>
                    <Text style={styles.name}>{item.name} ({item.abbr})</Text>
                    <Text style={styles.language}>{item.lang} - {item.description || ''}</Text>
                </View>
                <View style={styles.statusContainer}>
                    {/* Display Download Status - Native Only Logic for now */}
                    {!IS_WEB && (
                        isCurrentItemDownloading ? (
                            <Text style={styles.statusText}>Downloading {(downloadProgress * 100).toFixed(0)}%...</Text>
                        ) : isItemDownloaded ? (
                            <View style={styles.downloadedContainer}> 
                                <Text style={isItemActive ? styles.activeText : styles.downloadedText}>
                                    ✓ {isItemActive ? '(Active)' : 'Downloaded'}
                                </Text>
                                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.deleteButton}>
                                     <Text style={styles.deleteButtonText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text style={styles.downloadButton}>Download</Text>
                        )
                    )}
                    {IS_WEB && <Text style={styles.webNote}>Not implemented</Text>} 
                </View>
            </Pressable>
        );
    };

    return (
        <Container>
            <Stack.Screen options={{ title: 'Settings & Downloads' }} />
            <View style={styles.container}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search translations (name, lang, abbr)..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholderTextColor="#999"
                />
                
                {/* Removed API Key check for list display */}
                {/* Add check if availableTranslations list is empty? */}
                {/* {availableTranslations.length === 0 && <Text>Loading translation list...</Text>} */} 

                {error && <Text style={styles.errorText}>Error: {error}</Text>}
                {/* Global download error display */} 
                {downloadError && !isDownloading && <Text style={[styles.errorText, {marginTop: 5}]}>Download Error: {downloadError}</Text>}
                
                <FlatList
                    data={filteredList}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={<Text>No translations match your search.</Text>}
                    // Add necessary extraData for FlatList updates
                    extraData={{ selectedTranslationId, downloadedTranslationIds, isDownloading, downloadProgress }}
                />
                
            </View>
        </Container>
    );
}

// --- Styles (Add/Modify as needed) ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15, // Add some padding
    },
    searchInput: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        backgroundColor: '#fff',
        fontSize: 16,
    },
    itemBase: {
        backgroundColor: '#fff',
        paddingVertical: 12, // Adjust padding
        paddingHorizontal: 15, // Adjust padding
        marginBottom: 12, // Increased spacing
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    itemActive: {
        borderColor: '#c53030', // Darker Red-700 for border
        borderWidth: 2,
        backgroundColor: '#fed7d7', // Lighter Red-100 background for active
    },
    itemDisabled: {
        opacity: 0.5, // Keep disabled opacity
        backgroundColor: '#f7fafc', // Lighter grey background when disabled
    },
    infoContainer: {
        flex: 1,
        marginRight: 10,
    },
    name: {
        fontSize: 16,
        fontWeight: '600', // Semibold
        marginBottom: 3,
    },
    language: {
        fontSize: 13, // Smaller language text
        color: '#718096', // Gray-600
    },
    statusContainer: {
        // Removed minWidth, let content size it
        alignItems: 'flex-end', // Keep outer container aligned right
        justifyContent: 'center'
    },
    statusText: {
        fontSize: 14,
        color: '#4a5568', // Gray-700
    },
    downloadedContainer: { 
        // Arrange text and delete button horizontally
        flexDirection: 'row',
        alignItems: 'center',
    },
    downloadedText: {
        fontSize: 14,
        color: '#38a169', // Green-600
        // Remove margin bottom
        // marginBottom: 4, 
    },
    activeText: {
      fontSize: 14,
      color: '#c53030', // Red-700 for active text too
      fontWeight: 'bold',
      // Remove margin bottom
      // marginBottom: 4,
    },
    downloadButton: { 
        fontSize: 14,
        color: '#c53030', // Make Download text red
        fontWeight: 'bold',
    },
    deleteButton: { 
       paddingVertical: 2,
       // Add left margin for spacing
       marginLeft: 8, 
    },
    deleteButtonText: { // Style for the delete text itself
        fontSize: 12,
        color: '#e53e3e', // Red-600
        // fontWeight: 'bold',
    },
    webNote: {
      fontSize: 14,
      color: '#a0aec0', // Gray-500
      fontStyle: 'italic'
    },
    errorText: {
        color: '#e53e3e',
        textAlign: 'center',
        marginVertical: 10, // Use vertical margin
    },
}); 