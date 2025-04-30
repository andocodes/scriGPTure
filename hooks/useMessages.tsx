import React, { createContext, ReactNode, useContext, useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

export interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: string
  context?: {
    verses: Array<{
      reference: string
      text: string
    }>
  }
}

interface MessagesContextType {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
  currentChatId: string | null
  setCurrentChatId: (chatId: string | null) => void
  loadChatHistory: (chatId: string) => Promise<void>
  startNewChat: () => string
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

interface MessagesProviderProps {
  children: ReactNode
}

// Key prefix for storing chat history
const CHAT_HISTORY_PREFIX = "chatHistory_"

export function MessagesProvider({ children }: MessagesProviderProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      if (currentChatId && messages.length > 0) {
        try {
          await AsyncStorage.setItem(
            `${CHAT_HISTORY_PREFIX}${currentChatId}`,
            JSON.stringify(messages)
          )
          console.log(`[Messages] Saved ${messages.length} messages for chat ${currentChatId}`)
        } catch (error) {
          console.error("[Messages] Error saving chat history:", error)
        }
      }
    }

    saveMessages()
  }, [messages, currentChatId])

  const clearMessages = () => {
    setMessages([])
  }

  const loadChatHistory = async (chatId: string) => {
    try {
      const storedMessages = await AsyncStorage.getItem(`${CHAT_HISTORY_PREFIX}${chatId}`)
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages))
        setCurrentChatId(chatId)
        console.log(`[Messages] Loaded chat history for ${chatId}`)
      } else {
        // Chat ID exists but no messages - set empty array
        setMessages([])
        setCurrentChatId(chatId)
        console.log(`[Messages] No chat history found for ${chatId}, starting empty`)
      }
    } catch (error) {
      console.error(`[Messages] Error loading chat history for ${chatId}:`, error)
      // Reset to empty state on error
      setMessages([])
      setCurrentChatId(chatId)
    }
  }

  const startNewChat = () => {
    // Generate a new chat ID with timestamp
    const newChatId = `chat-${Date.now()}`
    // Reset messages and set the new chat ID
    setMessages([])
    setCurrentChatId(newChatId)
    console.log(`[Messages] Started new chat with ID: ${newChatId}`)
    return newChatId
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        setMessages,
        clearMessages,
        currentChatId,
        setCurrentChatId,
        loadChatHistory,
        startNewChat,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}

export function useMessages() {
  const context = useContext(MessagesContext)
  if (context === undefined) {
    throw new Error("useMessages must be used within a MessagesProvider")
  }
  return context
}

// Helper function to get all stored chat IDs
export async function getChatHistoryList(): Promise<Array<{ id: string; timestamp: number }>> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const chatKeys = keys.filter((key) => key.startsWith(CHAT_HISTORY_PREFIX))

    // Extract chat IDs and sort by timestamp (newest first)
    return chatKeys
      .map((key) => {
        const chatId = key.replace(CHAT_HISTORY_PREFIX, "")
        // Extract timestamp from chat ID (format: chat-1234567890)
        const timestamp = parseInt(chatId.split("-")[1], 10)
        return { id: chatId, timestamp }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error("[Messages] Error getting chat history list:", error)
    return []
  }
}
