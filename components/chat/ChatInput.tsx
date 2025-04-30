import { Ionicons } from "@expo/vector-icons"
import React, { useState, useEffect, useRef } from "react"
import { Pressable, TextInput, View, StyleSheet, Platform } from "react-native"

interface ChatInputProps {
  onSend: (message: string) => void
  inputValue: string
  onInputChange: (text: string) => void
}

export function ChatInput({ onSend, inputValue, onInputChange }: ChatInputProps) {
  const [inputHeight, setInputHeight] = useState(40)
  const inputRef = useRef<TextInput>(null)
  
  const handleSend = () => {
    if (inputValue?.trim()) {
      onSend(inputValue.trim())
    }
  }

  // Reset input height when value changes to empty (after sending)
  useEffect(() => {
    if (!inputValue) {
      setInputHeight(40)
    }
  }, [inputValue])

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          // More reliable height calculation with platform checks
          { 
            minHeight: 40, 
            maxHeight: 120,
            height: 'auto' // Allow auto height on iOS/web
          },
          // On Android, manually set height
          Platform.OS === 'android' ? { height: Math.max(40, inputHeight) } : null,
        ]}
        placeholder="Ask a question..."
        value={inputValue ?? ''}
        onChangeText={onInputChange}
        multiline={true}
        textAlignVertical="center"
        scrollEnabled={true}
        blurOnSubmit={false} // Don't blur on return press
        maxLength={2000}
        onContentSizeChange={(e) => {
          const newHeight = e.nativeEvent.contentSize.height
          setInputHeight(Math.min(120, newHeight + 6)) // Add padding to avoid text clipping
        }}
      />
      <Pressable
        onPress={handleSend}
        style={[
          styles.sendButton,
          !inputValue?.trim() && styles.disabledButton
        ]}
        disabled={!inputValue?.trim()}
      >
        <Ionicons name="send-sharp" size={18} color="white" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align to bottom for multiline support
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    fontSize: 16,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});
