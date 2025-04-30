import React, { useState, useMemo } from 'react';
import { View, Text, SectionList, ActivityIndicator, Pressable, StyleSheet, Platform, Alert, TextInput, TouchableOpacity } from 'react-native';
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
    const sections = useMemo(() => {
        const downloadedSet = new Set(downloadedTranslationIds);
        const baseList = availableTranslations.map(t => ({
            ...t,
            // isDownloaded is based on presence in downloadedTranslationIds from store
            isDownloaded: IS_WEB ? false : downloadedSet.has(t.id), // Use t.id (abbr)
            isActive: t.id === selectedTranslationId,
        }));

        // Apply search filter
        const filteredList = baseList.filter(item => {
            if (!searchTerm) return true;
            const lowerSearchTerm = searchTerm.toLowerCase();
            return (
                item.name.toLowerCase().includes(lowerSearchTerm) ||
                item.abbr.toLowerCase().includes(lowerSearchTerm) ||
                item.lang.toLowerCase().includes(lowerSearchTerm)
            );
        });

        // Separate into sections
        const downloaded = filteredList.filter(item => item.isDownloaded);
        const available = filteredList.filter(item => !item.isDownloaded);

        const result = [];
        if (downloaded.length > 0) {
            result.push({ title: "Downloaded", data: downloaded });
        }
        if (available.length > 0) {
            result.push({ title: "Available for Download", data: available });
        }
        // Handle empty case after filtering
        if (result.length === 0 && searchTerm) {
            result.push({ title: "No Matches", data: [] });
        } else if (result.length === 0) {
            result.push({ title: "Available for Download", data: [] }); // Default if nothing downloaded yet
        }

        return result;
    }, [availableTranslations, downloadedTranslationIds, selectedTranslationId, searchTerm]);

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
                            if (item.id === selectedTranslationId) {
                                console.log(`[Settings] Deleted the active translation (${item.id}), clearing selection.`);
                                setSelectedTranslation(null); // Clear selection to detach DB
                            }
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
                    { marginBottom: 10 }
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

    // Add Section Header Renderer
    const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
        <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
    );

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
                
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    ListEmptyComponent={<Text>No translations available.</Text>}
                    stickySectionHeadersEnabled={true}
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
        backgroundColor: '#f0f0f0', // Add a light grey background to the main container for contrast
    },
    searchInput: {
        height: 45,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        backgroundColor: '#fff',
        fontSize: 16,
    },
    sectionHeaderContainer: {
        paddingHorizontal: 10,
        paddingTop: 15,
        paddingBottom: 8,
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    itemBase: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.18,
        shadowRadius: 1.00,
        elevation: 1,
    },
    itemActive: {
        borderColor: '#007AFF',
        borderWidth: 2,
        backgroundColor: '#e7f3ff',
    },
    itemDisabled: {
        opacity: 0.6,
    },
    infoContainer: {
        flex: 1,
        marginRight: 10,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    language: {
        fontSize: 13,
        color: '#666',
    },
    statusContainer: {
        alignItems: 'flex-end',
        minWidth: 100,
    },
    statusText: {
        fontSize: 13,
        color: '#888',
    },
    downloadedContainer: { 
        alignItems: 'flex-end',
    },
    downloadedText: {
        fontSize: 13,
        color: 'green',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    activeText: {
        fontSize: 13,
        color: '#007AFF',
        fontWeight: 'bold',
        marginBottom: 5, 
    },
    deleteButton: {
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    downloadButton: {
        fontSize: 14,
        color: '#FF3B30', // Red color
        fontWeight: 'bold',
    },
    webNote: {
        fontSize: 13,
        color: '#aaa',
        fontStyle: 'italic',
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        textAlign: 'center',
    },
}); 