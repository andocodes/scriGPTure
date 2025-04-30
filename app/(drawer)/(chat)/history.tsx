import React, { useEffect, useState } from "react"
import { Alert, FlatList, Pressable, Text, View } from "react-native"
import { Link, useRouter } from "expo-router"
import { Container } from "~/components/Container"
import { getChatHistoryList } from "~/hooks/useMessages"
import AsyncStorage from "@react-native-async-storage/async-storage"

interface ChatHistoryItem {
  id: string
  timestamp: number
  preview: string
}

const CHAT_HISTORY_PREFIX = "chatHistory_"

export default function ChatHistoryScreen() {
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadChatHistory()
  }, [])

  const loadChatHistory = async () => {
    setIsLoading(true)
    try {
      const historyList = await getChatHistoryList()
      
      // Load message previews for each chat
      const historyWithPreview = await Promise.all(
        historyList.map(async (item) => {
          const key = `${CHAT_HISTORY_PREFIX}${item.id}`
          const messagesJson = await AsyncStorage.getItem(key)
          let preview = "Empty chat"
          
          if (messagesJson) {
            const messages = JSON.parse(messagesJson)
            // Find the first user message if any
            const firstUserMessage = messages.find((msg: any) => msg.isUser)
            if (firstUserMessage) {
              // Truncate message preview
              preview = firstUserMessage.content.length > 40
                ? `${firstUserMessage.content.substring(0, 40)}...`
                : firstUserMessage.content
            }
          }
          
          return {
            ...item,
            preview
          }
        })
      )
      
      setChatHistory(historyWithPreview)
    } catch (error) {
      console.error("[ChatHistory] Error loading chat history:", error)
      Alert.alert("Error", "Failed to load chat history")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    try {
      await AsyncStorage.removeItem(`${CHAT_HISTORY_PREFIX}${chatId}`)
      setChatHistory(prev => prev.filter(item => item.id !== chatId))
      console.log(`[ChatHistory] Deleted chat with ID: ${chatId}`)
    } catch (error) {
      console.error(`[ChatHistory] Error deleting chat ${chatId}:`, error)
      Alert.alert("Error", "Failed to delete chat")
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const renderChatItem = ({ item }: { item: ChatHistoryItem }) => (
    <Pressable
      className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200"
      onPress={() => router.push(`/chat?chatId=${item.id}`)}
    >
      <View className="flex-1 mr-4">
        <Text className="font-medium text-gray-900 mb-1">{item.preview}</Text>
        <Text className="text-sm text-gray-500">{formatDate(item.timestamp)}</Text>
      </View>
      <Pressable
        className="bg-red-500 px-3 py-2 rounded"
        onPress={() => handleDeleteChat(item.id)}
      >
        <Text className="text-white font-medium">Delete</Text>
      </Pressable>
    </Pressable>
  )

  return (
    <Container>
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        <Text className="text-xl font-bold">Chat History</Text>
        <Link href="/chat" asChild>
          <Pressable className="bg-blue-500 px-4 py-2 rounded">
            <Text className="text-white font-medium">New Chat</Text>
          </Pressable>
        </Link>
      </View>

      {chatHistory.length === 0 && !isLoading ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-gray-500 text-center mb-4">
            No chat history found. Start a new conversation!
          </Text>
          <Link href="/chat" asChild>
            <Pressable className="bg-blue-500 px-4 py-2 rounded">
              <Text className="text-white font-medium">Start Chat</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <FlatList
          data={chatHistory}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            isLoading ? (
              <View className="flex-1 justify-center items-center p-4">
                <Text>Loading chat history...</Text>
              </View>
            ) : null
          }
        />
      )}
    </Container>
  )
}
