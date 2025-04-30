import React, { useState } from "react"
import { Pressable, StyleSheet, Text, View, TextStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Markdown from 'react-native-markdown-display'

interface MessageProps {
  content: string
  isUser: boolean
  timestamp: Date
  context?: {
    verses: Array<{
      reference: string
      text: string
    }>
  }
}

export function Message({ content, isUser, timestamp, context }: MessageProps) {
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  
  // Format the timestamp to display only hours and minutes
  const time = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  // Define markdown styles based on whether this is a user message or bot message
  const markdownStyles: Record<string, TextStyle> = {
    body: {
      color: isUser ? '#fff' : '#333',
      fontSize: 16,
      lineHeight: 22,
    },
    heading1: {
      color: isUser ? '#fff' : '#333',
      fontSize: 20,
      marginTop: 8,
      marginBottom: 4,
    },
    heading2: {
      color: isUser ? '#fff' : '#333',
      fontSize: 18,
      marginTop: 8,
      marginBottom: 4,
    },
    heading3: {
      color: isUser ? '#fff' : '#333',
      fontSize: 17,
      marginTop: 8,
      marginBottom: 4,
    },
    link: {
      color: isUser ? '#f8d2ce' : '#2980b9',
      textDecorationLine: 'underline' as TextStyle['textDecorationLine'],
    },
    blockquote: {
      backgroundColor: isUser ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      borderLeftColor: isUser ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
      borderLeftWidth: 4,
      paddingLeft: 8,
      paddingVertical: 4,
      marginVertical: 8,
    },
    strong: {
      fontWeight: 'bold' as TextStyle['fontWeight'],
    },
    em: {
      fontStyle: 'italic' as TextStyle['fontStyle'],
    },
    code_inline: {
      backgroundColor: isUser ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
      color: isUser ? '#fff' : '#333',
      fontFamily: 'Courier',
    },
    code_block: {
      backgroundColor: isUser ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
      padding: 8,
      borderRadius: 5,
      marginVertical: 8,
      color: isUser ? '#fff' : '#333',
      fontFamily: 'Courier',
    }
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {context && context.verses.length > 0 && (
        <Pressable 
          style={styles.contextButton} 
          onPress={() => setIsContextExpanded(!isContextExpanded)}
        >
          <Text style={[styles.contextButtonText, isUser ? styles.userContextButtonText : styles.botContextButtonText]}>
            {isContextExpanded ? '↑ Hide Bible verses' : '↓ View Bible verses'} ({context.verses.length})
          </Text>
        </Pressable>
      )}
      
      {context && isContextExpanded && (
        <View style={[styles.contextContainer, isUser ? styles.userContextContainer : styles.botContextContainer]}>
          {context.verses.map((verse, index) => (
            <View key={index} style={styles.contextItem}>
              <Text style={[
                styles.contextReference,
                isUser ? styles.userContextReference : styles.botContextReference
              ]}>
                {verse.reference}
              </Text>
              <Text style={[
                styles.contextText,
                isUser ? styles.userContextText : styles.botContextText
              ]}>
                "{verse.text}"
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {isUser ? (
        // Keep plain text for user messages
        <Text style={[styles.text, styles.userText]}>{content}</Text>
      ) : (
        // Use markdown for bot responses
        <Markdown style={markdownStyles}>
          {content}
        </Markdown>
      )}
      
      <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.botTimestamp]}>{time}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userContainer: {
    alignSelf: "flex-end",
    backgroundColor: "#e74c3c",
  },
  botContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f1f1",
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  botText: {
    color: "#333",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  botTimestamp: {
    color: "#999",
  },
  contextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  contextButtonText: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  userContextButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  botContextButtonText: {
    color: '#666',
  },
  contextContainer: {
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
  },
  userContextContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  botContextContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  contextItem: {
    marginBottom: 8,
  },
  contextReference: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userContextReference: {
    color: '#fff',
  },
  botContextReference: {
    color: '#333',
  },
  contextText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  userContextText: {
    color: '#fff',
  },
  botContextText: {
    color: '#555',
  }
});
