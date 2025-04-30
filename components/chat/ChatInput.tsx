import { Ionicons } from "@expo/vector-icons"
import React, { useState } from "react"
import { Pressable, TextInput, View } from "react-native"

interface ChatInputProps {
  onSend: (message: string) => void
  inputValue: string
  onInputChange: (text: string) => void
}

export function ChatInput({ onSend, inputValue, onInputChange }: ChatInputProps) {
  const handleSend = () => {
    if (inputValue?.trim()) {
      onSend(inputValue.trim())
    }
  }

  return (
    <View className="flex-row items-center px-4 py-2 border-t border-gray-200 bg-white">
      <TextInput
        className="flex-1 min-h-[40px] px-4 py-2 bg-gray-100 rounded-sm mr-2 align-middle"
        placeholder="Ask a question..."
        value={inputValue ?? ''}
        onChangeText={onInputChange}
        multiline={false}
        maxLength={1000}
        onSubmitEditing={handleSend}
      />
      <Pressable
        onPress={handleSend}
        className={`
          p-2 rounded-sm
          content-center
          align-middle
          flex
          ${inputValue?.trim() ? "bg-red-500" : "bg-gray-300"}
        `}
        disabled={!inputValue?.trim()}
      >
        <Ionicons name="send-sharp" size={18} color="white" />
      </Pressable>
    </View>
  )
}
