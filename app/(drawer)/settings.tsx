import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Platform, Alert, TextInput } from 'react-native';
import { Stack } from 'expo-router';

import { Container } from '~/components/Container';
import { useAppStore } from '~/store/store';
import { fetchAvailableTranslations, downloadAndStoreTranslation, type ApiBibleTranslation } from '~/services/apiBible';
import * as db from '~/db/database';

const IS_WEB = Platform.OS === 'web';

interface DisplayTranslation extends ApiBibleTranslation {
    isDownloaded: boolean;
    isActive: boolean;
}

export default function SettingsScreen() {
    const apiKeysLoaded = useAppStore((state) => state.apiKeysLoaded);
    const apiBibleApiKey = useAppStore((state) => state.apiBibleApiKey);
    const setAvailableTranslations = useAppStore((state) => state.setAvailableTranslations);
    const selectedTranslationId = useAppStore((state) => state.selectedTranslationId);
    const setSelectedTranslation = useAppStore((state) => state.setSelectedTranslation);
    // Select download status individually
    const isDownloading = useAppStore(state => state.isDownloading);
    const downloadProgress = useAppStore(state => state.downloadProgress);
    const downloadError = useAppStore(state => state.downloadError);
    const downloadingTranslationId = useAppStore(state => state.downloadingTranslationId);
    const downloadedTranslationIds = useAppStore(state => state.downloadedTranslationIds); // Get downloaded IDs

    const [displayList, setDisplayList] = useState<DisplayTranslation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = useCallback(async () => {
        if (!apiKeysLoaded) {
            setError(null); // Don't show key error until keys are loaded
            setDisplayList([]);
            setIsLoading(false);
            return;
        }
        if (!apiBibleApiKey) {
            setError("API.Bible key not configured.");
            setDisplayList([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const apiTranslations = await fetchAvailableTranslations();
            
            // --- De-duplication Logic Start (by Name) ---
            const uniqueNameTranslations: ApiBibleTranslation[] = [];
            const seenNames = new Set<string>(); // Track seen translation names
            for (const translation of apiTranslations) {
                if (!seenNames.has(translation.name)) { // Check translation name
                    uniqueNameTranslations.push(translation);
                    seenNames.add(translation.name); // Add translation name to set
                }
            }
            // --- De-duplication Logic End ---

            // Use the unique list for further processing
            setAvailableTranslations(uniqueNameTranslations); 

            let downloadedIds = new Set<string>();
            if (!IS_WEB) { // Only check DB on native
                const downloaded = await db.all<{ id: string }>(
                    "SELECT id FROM translations WHERE downloaded = 1"
                );
                downloadedIds = new Set(downloaded.map(t => t.id));
            }
            
            // On web, assume nothing is downloaded unless we implement web storage later
            const combinedList = uniqueNameTranslations.map(apiT => ({
                ...apiT,
                // On web, isDownloaded is always false for now
                isDownloaded: IS_WEB ? false : downloadedIds.has(apiT.id),
                isActive: apiT.id === selectedTranslationId,
            }));
            setDisplayList(combinedList);

        } catch (err) {
            console.error("Error loading translations data:", err);
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setIsLoading(false);
        }
    }, [apiKeysLoaded, apiBibleApiKey, selectedTranslationId, downloadedTranslationIds]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter logic: derive filtered list based on searchTerm
    const filteredList = displayList.filter(item => {
        if (!searchTerm) return true; // Show all if search is empty
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
            item.name.toLowerCase().includes(lowerSearchTerm) ||
            item.abbreviation.toLowerCase().includes(lowerSearchTerm) ||
            item.language.name.toLowerCase().includes(lowerSearchTerm)
        );
    });

    const handlePressItem = (translation: DisplayTranslation) => {
        if (translation.isDownloaded || IS_WEB) {
            // Allow selection if downloaded OR if on web (reading uses API directly)
            setSelectedTranslation(translation.id);
        } else if (!IS_WEB && !isDownloading) {
            // Ask for confirmation before downloading
            Alert.alert(
                "Confirm Download",
                `Download the ${translation.name} translation? This may take some time and use data.`, 
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Download", 
                        onPress: () => {
                            // Call download function asynchronously
                            downloadAndStoreTranslation(translation).catch(err => {
                                // Error is already handled within download func and sets store state
                                console.error("Download initiation failed (already logged):", err);
                            });
                        }
                    }
                ]
            );
        }
    };

    const renderItem = ({ item }: { item: DisplayTranslation }) => {
        // Determine if the current item is the one being downloaded
        const isCurrentDownload = isDownloading && item.id === downloadingTranslationId; // Use the reactive state variable

        return (
            <Pressable
                disabled={!IS_WEB && isDownloading && !isCurrentDownload} // Disable others while one downloads
                style={({ pressed }) => [
                    styles.itemBase,
                    item.isActive && styles.itemActive,
                    (pressed || (!IS_WEB && isDownloading && !isCurrentDownload)) && styles.itemDisabled,
                ]}
                onPress={() => handlePressItem(item)}
            >
                <View style={styles.infoContainer}>
                    <Text style={styles.name}>{item.name} ({item.abbreviation})</Text>
                    <Text style={styles.language}>{item.language.name}</Text>
                </View>
                <View style={styles.statusContainer}>
                    {/* Display Download Status */}
                    {IS_WEB ? (
                         <Text style={styles.webNote}>Select to read</Text>
                     ) : isCurrentDownload ? ( // Show progress for the item being downloaded
                         <Text style={styles.statusText}>Downloading {(downloadProgress * 100).toFixed(0)}%...</Text>
                     ) : item.isDownloaded ? (
                         <Text style={item.isActive ? styles.activeText : styles.statusText}>
                             ✓ Downloaded {item.isActive ? '(Active)' : ''}
                         </Text>
                     ) : (
                         <Text style={styles.downloadButton}>Download</Text>
                     )
                    }
                </View>
            </Pressable>
        );
    };

    return (
        <Container>
            <Stack.Screen options={{ title: 'Settings & Translations' }} />
            <View style={styles.container}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search translations (name, lang, abbr)..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholderTextColor="#999"
                />

                {!apiKeysLoaded && <Text>Loading API keys...</Text>}
                {error && <Text style={styles.errorText}>Error: {error}</Text>}
                {isLoading && <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#0000ff" />}
                
                {!isLoading && !error && apiKeysLoaded && apiBibleApiKey && (
                    <FlatList
                        data={filteredList}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={<Text>No translations found.</Text>}
                        extraData={{ selectedTranslationId, isDownloading, downloadProgress }}
                    />
                )}
                 {apiKeysLoaded && !apiBibleApiKey && !isLoading && !error && 
                    <Text style={styles.errorText}>API.Bible key missing.</Text>}
                {downloadError && !isLoading && <Text style={[styles.errorText, {marginTop: 5}]}>Download Error: {downloadError}</Text>}
            </View>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginBottom: 15,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    itemActive: {
        borderColor: 'red',
        borderWidth: 2,
        backgroundColor: '#ffebee',
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
        marginBottom: 2,
    },
    language: {
        fontSize: 14,
        color: '#555',
    },
    statusContainer: {
        minWidth: 100, 
        justifyContent: 'center'
    },
    statusText: {
        fontSize: 14,
        color: 'green',
    },
    activeText: {
      fontSize: 14,
      color: '#0056b3',
      fontWeight: 'bold',
    },
    downloadButton: {
        fontSize: 14,
        color: 'red',
        fontWeight: 'bold',
    },
    webNote: {
      fontSize: 14,
      color: '#666',
      fontStyle: 'italic'
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
}); 