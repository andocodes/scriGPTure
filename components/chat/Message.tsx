import React, { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

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
      
      <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>{content}</Text>
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
