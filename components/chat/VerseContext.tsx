import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface VerseContextItem {
  id: string;
  reference: string;
  text: string;
}

interface VerseContextProps {
  verses: VerseContextItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function VerseContext({ verses, onRemove, onClear }: VerseContextProps) {
  if (verses.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Context ({verses.length})</Text>
        {verses.length > 0 && (
          <Pressable onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </Pressable>
        )}
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {verses.map((verse) => (
          <View key={verse.id} style={styles.verseItem}>
            <View style={styles.verseContent}>
              <Text style={styles.reference}>{verse.reference}</Text>
              <Text numberOfLines={2} style={styles.text}>{verse.text}</Text>
            </View>
            <Pressable 
              onPress={() => onRemove(verse.id)} 
              style={styles.removeButton}
            >
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#FF3B30',
  },
  scrollContent: {
    paddingRight: 12,
  },
  verseItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginRight: 10,
    padding: 10,
    maxWidth: 280,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    flexDirection: 'row',
  },
  verseContent: {
    flex: 1,
    marginRight: 8,
  },
  reference: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  text: {
    fontSize: 12,
    color: '#555',
  },
  removeButton: {
    alignSelf: 'flex-start',
    padding: 2,
  },
}); 