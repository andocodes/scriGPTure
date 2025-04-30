import { Entypo } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { forwardRef } from "react"
import { Pressable, StyleSheet } from "react-native"
import { useMessages } from "~/hooks/useMessages"

export const HeaderNewChatButton = forwardRef<typeof Pressable, { onPress?: () => void }>(
  ({ onPress }, ref) => {
    const { startNewChat } = useMessages()
    const router = useRouter()

    const handleNewChat = () => {
      // Create a new chat and get its ID
      const newChatId = startNewChat()
      
      // Force navigation with a timestamp to ensure re-render
      const timestamp = Date.now()
      console.log(`[HeaderNewChatButton] Creating new chat: ${newChatId} with timestamp: ${timestamp}`)
      
      // Navigate to the chat with the new ID and timestamp
      router.push({
        pathname: "/(drawer)/(chat)",
        params: {
          chatId: newChatId,
          ts: timestamp
        }
      })
    }

    return (
      <Pressable onPress={handleNewChat}>
        {({ pressed }) => (
          <Entypo
            name="new-message"
            size={18}
            color="red"
            style={[
              styles.headerRight,
              {
                opacity: pressed ? 0.5 : 1,
              },
            ]}
          />
        )}
      </Pressable>
    )
  }
)

export const styles = StyleSheet.create({
  headerRight: {
    marginRight: 15,
  },
})
