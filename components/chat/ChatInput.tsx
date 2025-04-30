import { Ionicons } from "@expo/vector-icons"
import React, { useState, useEffect } from "react"
import { Pressable, TextInput, View, StyleSheet } from "react-native"

interface ChatInputProps {
  onSend: (message: string) => void
  inputValue: string
  onInputChange: (text: string) => void
}

export function ChatInput({ onSend, inputValue, onInputChange }: ChatInputProps) {
  const [inputHeight, setInputHeight] = useState(40)
  
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
        style={[
          styles.input,
          { height: Math.max(40, Math.min(100, inputHeight)) }
        ]}
        placeholder="Ask a question..."
        value={inputValue ?? ''}
        onChangeText={onInputChange}
        multiline={true}
        maxLength={1000}
        onContentSizeChange={(e) => 
          setInputHeight(e.nativeEvent.contentSize.height)
        }
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
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    fontSize: 16,
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
