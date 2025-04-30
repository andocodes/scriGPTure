import React, { useState, useCallback } from "react"
import { Alert, FlatList, Pressable, Text, View, TextInput, ActivityIndicator } from "react-native"
import { useRouter, useFocusEffect } from "expo-router"
import { Container } from "~/components/Container"
import { getChatHistoryList, useMessages } from "~/hooks/useMessages"
import { deleteChatFromDb, getChatPreviewsFromDb } from "~/db/database"

interface ChatHistoryItem {
  id: string
  timestamp: number
  title: string
  preview: string
}

export default function ChatHistoryScreen() {
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editedTitle, setEditedTitle] = useState("")
  const { updateChatTitle } = useMessages()
  const router = useRouter()

  // Use useFocusEffect to reload history whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[ChatHistory] Screen focused, loading chat history')
      loadChatHistory()
      
      // Clean up function
      return () => {
        console.log('[ChatHistory] Screen unfocused')
      }
    }, [])
  )

  const loadChatHistory = async () => {
    setIsLoading(true)
    try {
      console.log('[ChatHistory] Fetching chat history list')
      
      // Get all chats with metadata
      const historyList = await getChatHistoryList()
      console.log(`[ChatHistory] Found ${historyList.length} chats in history`)
      
      // Get message previews
      const previews = await getChatPreviewsFromDb()
      
      // Combine metadata with previews
      const historyWithPreview = historyList.map(item => {
        const previewItem = previews.find(p => p.chatId === item.id)
        return {
          ...item,
          preview: previewItem?.preview || "Empty chat"
        }
      })
      
      setChatHistory(historyWithPreview)
      console.log(`[ChatHistory] Loaded ${historyWithPreview.length} chat previews`)
    } catch (error) {
      console.error("[ChatHistory] Error loading chat history:", error)
      Alert.alert("Error", "Failed to load chat history")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    try {
      const success = await deleteChatFromDb(chatId)
      if (success) {
        setChatHistory(prev => prev.filter(item => item.id !== chatId))
        console.log(`[ChatHistory] Deleted chat with ID: ${chatId}`)
      } else {
        console.warn(`[ChatHistory] Could not delete chat with ID: ${chatId}`)
        Alert.alert("Warning", "Could not delete the chat. It may have been already deleted.")
      }
    } catch (error) {
      console.error(`[ChatHistory] Error deleting chat ${chatId}:`, error)
      Alert.alert("Error", "Failed to delete chat")
    }
  }

  const handleEditTitle = (chatId: string, currentTitle: string) => {
    setEditingTitleId(chatId)
    setEditedTitle(currentTitle)
  }

  const handleSaveTitle = async (chatId: string) => {
    if (editedTitle.trim() === "") {
      // Don't save empty titles
      setEditedTitle("New Chat")
    }
    
    try {
      await updateChatTitle(chatId, editedTitle)
      setChatHistory(prev => 
        prev.map(item => 
          item.id === chatId ? { ...item, title: editedTitle } : item
        )
      )
      console.log(`[ChatHistory] Updated title for chat ${chatId} to: ${editedTitle}`)
    } catch (error) {
      console.error(`[ChatHistory] Error updating title for chat ${chatId}:`, error)
      Alert.alert("Error", "Failed to update chat title")
    } finally {
      setEditingTitleId(null)
      setEditedTitle("")
    }
  }

  const navigateToChat = (chatId: string) => {
    console.log(`[ChatHistory] Navigating to chat with ID: ${chatId}`);
    
    // Make sure we include both chatId and timestamp for proper navigation
    // Force remount with a unique timestamp to ensure the chat is properly reloaded
    const timestamp = Date.now();
    
    // Log the parameters for debugging
    console.log(`[ChatHistory] Navigation params: chatId=${chatId}, ts=${timestamp}`);
    
    // Navigate to the index tab with parameters
    router.push({
      pathname: "/",
      params: {
        chatId: chatId,
        ts: timestamp
      }
    });
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
      onPress={() => navigateToChat(item.id)}
    >
      <View className="flex-1 mr-4">
        {editingTitleId === item.id ? (
          <View className="flex-row items-center mb-1">
            <TextInput 
              className="flex-1 border border-gray-300 rounded px-2 py-1 mr-2"
              value={editedTitle}
              onChangeText={setEditedTitle}
              autoFocus
              onBlur={() => handleSaveTitle(item.id)}
              onSubmitEditing={() => handleSaveTitle(item.id)}
              style={{ minWidth: 50 }}
            />
            <Pressable
              className="bg-green-500 px-2 py-1 rounded"
              onPress={() => handleSaveTitle(item.id)}
            >
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center mb-1">
            <Text className="font-bold text-gray-900 mr-2" numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            <Pressable
              className="bg-gray-200 px-2 py-1 rounded"
              onPress={() => handleEditTitle(item.id, item.title)}
            >
              <Text className="text-xs">Edit</Text>
            </Pressable>
          </View>
        )}
        <Text className="text-sm text-gray-700 mb-1">{item.preview}</Text>
        <Text className="text-xs text-gray-500">{formatDate(item.timestamp)}</Text>
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
        <Pressable 
          className="bg-red-500 px-4 py-2 rounded"
          onPress={() => router.push("/chat")}
        >
          <Text className="text-white font-medium">New Chat</Text>
        </Pressable>
      </View>

      {chatHistory.length === 0 && !isLoading ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-gray-500 text-center mb-4">
            No chat history found. Start a new conversation!
          </Text>
          <Pressable 
            className="bg-red-500 px-4 py-2 rounded"
            onPress={() => router.push("/chat")}
          >
            <Text className="text-white font-medium">Start Chat</Text>
          </Pressable>
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
                <ActivityIndicator size="large" color="#e74c3c" />
                <Text className="mt-2">Loading chat history...</Text>
              </View>
            ) : null
          }
          refreshing={isLoading}
          onRefresh={loadChatHistory}
        />
      )}
    </Container>
  )
}
