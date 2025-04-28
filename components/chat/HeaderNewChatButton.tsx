import { Entypo } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { forwardRef } from "react"
import { Pressable, StyleSheet } from "react-native"
import { useMessages } from "~/hooks/useMessages"

export const HeaderNewChatButton = forwardRef<typeof Pressable, { onPress?: () => void }>(
  ({ onPress }, ref) => {
    const { clearMessages } = useMessages()
    const router = useRouter()

    return (
      <Pressable
        onPress={() => {
          // const newChatId = `chat-${Date.now()}`
          // router.push(`/(drawer)/(chat)/${newChatId}`)
          clearMessages() // Clear messages before navigating to new chat
          router.push("/(drawer)/(chat)/")
        }}
      >
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
