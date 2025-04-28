import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { Pressable, TextInput, View } from "react-native"

interface ChatInputProps {
  onSend: (message: string) => void
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim())
      setInput("")
    }
  }

  return (
    <View className="flex-row items-center px-4 py-2 border-t border-gray-200 bg-white">
      <TextInput
        className="flex-1 min-h-[40px] px-4 py-2 bg-gray-100 rounded-sm mr-2 align-middle"
        placeholder="Ask a question..."
        value={input}
        onChangeText={setInput}
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
          ${input.trim() ? "bg-red-500" : "bg-gray-300"}
        `}
        disabled={!input.trim()}
      >
        <Ionicons name="send-sharp" size={18} color="white" />
      </Pressable>
    </View>
  )
}
