import React, { useState, useMemo } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet, Platform, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Container } from '~/components/Container';
import { useAppStore } from '~/store/store';
import { ScrollmapperTranslationInfo } from '~/config/translationMap';
import { downloadDbFile, deleteDbFile } from '~/utils/fileDownloader';

const IS_WEB = Platform.OS === 'web';

// Interface for display translation
interface DisplayTranslation extends ScrollmapperTranslationInfo {
    isDownloaded: boolean;
    isActive: boolean;
}

export default function TranslationsScreen() {
    // Get state from Zustand store
    const availableTranslations = useAppStore((state) => state.availableTranslations);
    const selectedTranslationId = useAppStore((state) => state.selectedTranslationId);
    const setSelectedTranslation = useAppStore((state) => state.setSelectedTranslation);
    const isDownloading = useAppStore(state => state.isDownloading);
    const downloadProgress = useAppStore(state => state.downloadProgress);
    const downloadError = useAppStore(state => state.downloadError);
    const downloadingTranslationId = useAppStore(state => state.downloadingTranslationId);
    const downloadedTranslationIds = useAppStore(state => state.downloadedTranslationIds);
    const removeDownloadedTranslation = useAppStore(state => state.removeDownloadedTranslation);

    // Local component state
    const [searchTerm, setSearchTerm] = useState('');

    // Format and filter translations based on search
    const filteredTranslations = useMemo(() => {
        const downloadedSet = new Set(downloadedTranslationIds);
        const baseList = availableTranslations.map(t => ({
            ...t,
            isDownloaded: IS_WEB ? false : downloadedSet.has(t.id),
            isActive: t.id === selectedTranslationId,
        }));

        if (!searchTerm) return baseList;
        
        return baseList.filter(item => {
            const lowerSearchTerm = searchTerm.toLowerCase();
            return (
                item.name.toLowerCase().includes(lowerSearchTerm) ||
                item.abbr.toLowerCase().includes(lowerSearchTerm) ||
                item.lang.toLowerCase().includes(lowerSearchTerm)
            );
        });
    }, [availableTranslations, downloadedTranslationIds, selectedTranslationId, searchTerm]);

    // Prepare section data
    const sections = useMemo(() => {
        const downloaded = filteredTranslations.filter(item => item.isDownloaded);
        const available = filteredTranslations.filter(item => !item.isDownloaded);
        
        const result = [];
        if (downloaded.length > 0) {
            result.push({ title: "Downloaded Translations", data: downloaded });
        }
        if (available.length > 0) {
            result.push({ title: "Available for Download", data: available });
        }
        
        if (result.length === 0 && searchTerm) {
            result.push({ title: "No Matches Found", data: [] });
        } else if (result.length === 0) {
            result.push({ title: "Available for Download", data: [] });
        }
        
        return result;
    }, [filteredTranslations, searchTerm]);

    // --- Event Handlers ---
    const handleSelectItem = (item: DisplayTranslation) => {
        console.log(`[TranslationsScreen] Selecting item: ${item.id}`);
        setSelectedTranslation(item.id);
    };

    const handleDownloadItem = (item: DisplayTranslation) => {
        if (IS_WEB || isDownloading) return;

        Alert.alert(
            "Confirm Download",
            `Download the ${item.name} translation (${item.abbr})? This may take some time and use data.`, 
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Download", 
                    onPress: async () => {
                        console.log(`[TranslationsScreen] Starting download for: ${item.dbFileName}`);
                        try {
                            await downloadDbFile(item.dbFileName, item.id);
                            console.log(`[TranslationsScreen] Download call finished for ${item.dbFileName}.`);
                        } catch (err) {
                            console.error(`[TranslationsScreen] Download initiation failed for ${item.dbFileName}:`, err);
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
                        console.log(`[TranslationsScreen] Deleting: ${item.dbFileName}`);
                        try {
                            await deleteDbFile(item.dbFileName);
                            removeDownloadedTranslation(item.id);
                            console.log(`[TranslationsScreen] Deleted ${item.dbFileName} successfully.`);
                            if (item.id === selectedTranslationId) {
                                console.log(`[TranslationsScreen] Deleted the active translation (${item.id}), clearing selection.`);
                                setSelectedTranslation(null);
                            }
                        } catch (err) {
                            console.error(`[TranslationsScreen] Failed to delete ${item.dbFileName}:`, err);
                            Alert.alert("Delete Error", err instanceof Error ? err.message : "An unknown error occurred.");
                        }
                    }
                }
            ]
        );
    };

    // --- Render Helpers ---
    const renderTranslationItem = ({ item }: { item: DisplayTranslation }) => {
        const isItemDownloaded = IS_WEB ? false : downloadedTranslationIds.includes(item.id);
        const isItemActive = item.id === selectedTranslationId;
        const isCurrentItemDownloading = isDownloading && downloadingTranslationId === item.id;
        const pressDisabled = !IS_WEB && isDownloading && !isCurrentItemDownloading;

        return (
            <Pressable
                disabled={pressDisabled} 
                style={({ pressed }) => [
                    styles.translationItem,
                    isItemActive && styles.itemActive,
                    (pressed || pressDisabled) && styles.itemDisabled,
                ]}
                onPress={() => isItemDownloaded ? handleSelectItem(item) : handleDownloadItem(item)}
            >
                <View style={styles.infoContainer}>
                    <Text style={styles.name}>{item.name} ({item.abbr})</Text>
                    <Text style={styles.language}>{item.lang} - {item.description || ''}</Text>
                </View>
                <View style={styles.statusContainer}>
                    {!IS_WEB && (
                        isCurrentItemDownloading ? (
                            <View style={styles.downloadingContainer}>
                                <Text style={styles.statusText}>Downloading {(downloadProgress * 100).toFixed(0)}%</Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
                                </View>
                            </View>
                        ) : isItemDownloaded ? (
                            <View style={styles.downloadedContainer}> 
                                <Text style={isItemActive ? styles.activeText : styles.downloadedText}>
                                    {isItemActive ? 'Active' : 'Downloaded'}
                                </Text>
                                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.deleteButton}>
                                    <Text style={styles.deleteButtonText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.downloadButtonContainer}>
                                <Ionicons name="cloud-download-outline" size={18} color="#FF3B30" />
                                <Text style={styles.downloadButtonText}>Download</Text>
                            </View>
                        )
                    )}
                    {IS_WEB && <Text style={styles.webNote}>Not implemented</Text>} 
                </View>
            </Pressable>
        );
    };

    const renderSectionHeader = ({ section }: { section: { title: string } }) => (
        <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
    );

    return (
        <Container>
            <View style={styles.container}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, language, or abbreviation"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor="#999"
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                            <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                    )}
                </View>
                
                {downloadError && !isDownloading && (
                    <Text style={styles.errorText}>Download Error: {downloadError}</Text>
                )}
                
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderTranslationItem}
                    renderSectionHeader={renderSectionHeader}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {searchTerm ? 'No translations match your search' : 'No translations available'}
                        </Text>
                    }
                    stickySectionHeadersEnabled={true}
                />
            </View>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        height: 45,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
    },
    sectionHeaderContainer: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 10,
        backgroundColor: '#f5f5f5',
    },
    sectionHeaderText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        textTransform: 'uppercase',
    },
    translationItem: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    itemActive: {
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
        paddingLeft: 12, // Adjust padding to account for border
    },
    itemDisabled: {
        opacity: 0.6,
    },
    infoContainer: {
        flex: 1,
        marginRight: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    language: {
        fontSize: 13,
        color: '#666',
    },
    statusContainer: {
        alignItems: 'flex-end',
        minWidth: 110,
    },
    downloadedContainer: {
        alignItems: 'center',
    },
    downloadingContainer: {
        alignItems: 'center',
        width: 110,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: '#eee',
        borderRadius: 2,
        marginTop: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
    },
    downloadButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    downloadButtonText: {
        color: '#FF3B30',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    downloadedText: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    activeText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    deleteButton: {
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#FFE5E5',
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 13,
        fontWeight: '500',
    },
    statusText: {
        fontSize: 13,
        color: '#666',
    },
    webNote: {
        fontSize: 13,
        color: '#aaa',
        fontStyle: 'italic',
    },
    errorText: {
        color: '#FF3B30',
        backgroundColor: '#FFEBE9',
        padding: 10,
        margin: 12,
        borderRadius: 6,
        textAlign: 'center',
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#666',
        fontSize: 16,
    },
}); 