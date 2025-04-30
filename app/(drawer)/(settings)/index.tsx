import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Container } from '~/components/Container';
import { useAppStore } from '~/store/store';

const IS_WEB = Platform.OS === 'web';

interface SettingsSection {
    id: string;
    title: string;
    description: string;
    icon: string;
    route: string;
}

export default function SettingsScreen() {
    const router = useRouter();
    const downloadedTranslationIds = useAppStore(state => state.downloadedTranslationIds);

    // Define the main settings sections
    const sections: SettingsSection[] = [
        {
            id: 'reading',
            title: 'Reading Preferences',
            description: 'Customize text size, verse numbers, and display options',
            icon: 'book-outline',
            route: 'reading'
        },
        {
            id: 'translations',
            title: 'Translations',
            description: `Manage ${downloadedTranslationIds.length} downloaded translations and find new ones`,
            icon: 'language-outline',
            route: 'translations'
        }
    ];

    const navigateToSection = (route: string) => {
        router.push(route as any);
    };

    const renderSettingsItem = (item: SettingsSection, index: number) => {
        const isLastItem = index === sections.length - 1;
        
        return (
            <Pressable
                key={item.id}
                style={({ pressed }) => [
                    styles.settingItem,
                    pressed && styles.settingItemPressed,
                    !isLastItem && styles.itemBorder
                ]}
                onPress={() => navigateToSection(item.route)}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={item.icon as any} size={24} color="#444" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
            </Pressable>
        );
    };

    return (
        <Container>
            <View style={styles.container}>
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search settings"
                            placeholderTextColor="#999"
                        />
                    </View>
                </View>
                
                <ScrollView style={styles.scrollView}>
                    {sections.map((item, index) => renderSettingsItem(item, index))}
                </ScrollView>
            </View>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    scrollView: {
        flex: 1,
    },
    searchContainer: {
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8e8e8',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: 40,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
    },
    settingItemPressed: {
        backgroundColor: '#f0f0f0',
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f2f2f2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#666',
    },
}); 