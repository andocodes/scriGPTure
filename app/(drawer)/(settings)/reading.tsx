import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Container } from '~/components/Container';

interface PreferenceItem {
  id: string;
  title: string;
  description: string | null;
  type: 'toggle' | 'select';
  value: any;
  options?: string[];
}

export default function ReadingPreferencesScreen() {
  // These would come from a persistent store in a real implementation
  const [textSize, setTextSize] = useState('Medium');
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);
  const [showChapterNumbers, setShowChapterNumbers] = useState(true);
  const [paragraphView, setParagraphView] = useState(false);
  const [highlightWords, setHighlightWords] = useState(true);
  const [redLetters, setRedLetters] = useState(true);

  // Group preferences by category
  const preferences: { category: string; items: PreferenceItem[] }[] = [
    {
      category: 'Text Display',
      items: [
        {
          id: 'textSize',
          title: 'Text Size',
          description: 'Adjust the size of scripture text',
          type: 'select',
          value: textSize,
          options: ['Small', 'Medium', 'Large', 'Extra Large'],
        },
        {
          id: 'showVerseNumbers',
          title: 'Show Verse Numbers',
          description: 'Display verse numbers in scripture text',
          type: 'toggle',
          value: showVerseNumbers,
        },
        {
          id: 'showChapterNumbers',
          title: 'Show Chapter Numbers',
          description: 'Display chapter numbers in scripture text',
          type: 'toggle',
          value: showChapterNumbers,
        },
      ],
    },
    {
      category: 'Layout',
      items: [
        {
          id: 'paragraphView',
          title: 'Paragraph View',
          description: 'Display text in paragraph format instead of verse-by-verse',
          type: 'toggle',
          value: paragraphView,
        },
      ],
    },
    {
      category: 'Highlighting',
      items: [
        {
          id: 'highlightWords',
          title: 'Highlight Search Terms',
          description: 'Highlight matching terms when searching',
          type: 'toggle',
          value: highlightWords,
        },
        {
          id: 'redLetters',
          title: 'Red Letters for Christ\'s Words',
          description: 'Show words of Jesus in red text',
          type: 'toggle',
          value: redLetters,
        },
      ],
    },
  ];

  const handleToggleChange = (id: string, newValue: boolean) => {
    console.log(`[ReadingScreen] Updating ${id} to:`, newValue);
    // Update the appropriate state based on the preference ID
    switch (id) {
      case 'showVerseNumbers':
        setShowVerseNumbers(newValue);
        break;
      case 'showChapterNumbers':
        setShowChapterNumbers(newValue);
        break;
      case 'paragraphView':
        setParagraphView(newValue);
        break;
      case 'highlightWords':
        setHighlightWords(newValue);
        break;
      case 'redLetters':
        setRedLetters(newValue);
        break;
    }
    // In a real app, you would also save this to persistent storage
  };

  const handleSelectOption = (id: string) => {
    if (id === 'textSize') {
      // Simple cycling through options for demo purposes
      // In a real app, you'd show a modal or picker
      const options = ['Small', 'Medium', 'Large', 'Extra Large'];
      const currentIndex = options.indexOf(textSize);
      const nextIndex = (currentIndex + 1) % options.length;
      setTextSize(options[nextIndex]);
      console.log(`[ReadingScreen] Updated textSize to: ${options[nextIndex]}`);
    }
    // In a real app, you would also save this to persistent storage
  };

  const renderPreferenceItem = (item: PreferenceItem) => {
    if (item.type === 'toggle') {
      return (
        <View key={item.id} style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>{item.title}</Text>
            {item.description && (
              <Text style={styles.preferenceDescription}>{item.description}</Text>
            )}
          </View>
          <Switch
            value={item.value}
            onValueChange={(value) => handleToggleChange(item.id, value)}
            trackColor={{ false: '#767577', true: '#d32f2f' }}
            thumbColor={item.value ? '#f44336' : '#f4f3f4'}
          />
        </View>
      );
    } else if (item.type === 'select') {
      return (
        <Pressable
          key={item.id}
          style={styles.preferenceItem}
          onPress={() => handleSelectOption(item.id)}
        >
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>{item.title}</Text>
            {item.description && (
              <Text style={styles.preferenceDescription}>{item.description}</Text>
            )}
          </View>
          <View style={styles.selectContainer}>
            <Text style={styles.selectValue}>{item.value}</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </View>
        </Pressable>
      );
    }
    return null;
  };

  return (
    <Container>
      <ScrollView style={styles.container}>
        {preferences.map((group) => (
          <View key={group.category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{group.category}</Text>
            <View style={styles.preferenceGroup}>
              {group.items.map((item) => renderPreferenceItem(item))}
            </View>
          </View>
        ))}

        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewContainer}>
            <Text style={[styles.previewText, { fontSize: textSize === 'Small' ? 14 : textSize === 'Medium' ? 16 : textSize === 'Large' ? 18 : 20 }]}>
              {showChapterNumbers && <Text style={styles.chapterNumber}>1 </Text>}
              {showVerseNumbers && <Text style={styles.verseNumber}>1 </Text>}
              In the beginning God created the heaven and the earth. 
              {'\n'}
              {showVerseNumbers && <Text style={styles.verseNumber}>2 </Text>}
              And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  preferenceGroup: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 12,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#666',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
  },
  previewSection: {
    marginBottom: 40,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  previewText: {
    lineHeight: 26,
    color: '#333',
  },
  chapterNumber: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#d32f2f',
  },
  verseNumber: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#666',
    top: -3,
  },
}); 