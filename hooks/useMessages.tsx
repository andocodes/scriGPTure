import React, { createContext, ReactNode, useContext, useState, useEffect } from "react"
import { 
  Message, 
  ChatMetadata, 
  saveChatToDb, 
  updateChatTitleInDb, 
  saveMessageToDb, 
  getChatMessagesFromDb, 
  getChatMetadataFromDb, 
  getAllChatsFromDb, 
  deleteChatFromDb 
} from "~/db/database"

interface MessagesContextType {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
  currentChatId: string | null
  setCurrentChatId: (chatId: string | null) => void
  loadChatHistory: (chatId: string) => Promise<void>
  startNewChat: () => string
  updateChatTitle: (chatId: string, title: string) => Promise<void>
  currentChatTitle: string
  setCurrentChatTitle: React.Dispatch<React.SetStateAction<string>>
  saveAllMessages: (chatId: string, messages: Message[]) => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

interface MessagesProviderProps {
  children: ReactNode
}

// Default chat title
const DEFAULT_CHAT_TITLE = "New Chat"

export function MessagesProvider({ children }: MessagesProviderProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [currentChatTitle, setCurrentChatTitle] = useState<string>(DEFAULT_CHAT_TITLE)

  // Save messages to database whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      if (currentChatId && messages.length > 0) {
        try {
          // Ensure chat exists in database
          await saveChatToDb(currentChatId, currentChatTitle)
          
          // Find the last message that was added
          const latestMessage = messages[messages.length - 1]
          
          // Save the message to the database
          await saveMessageToDb(latestMessage, currentChatId)
          
          console.log(`[Messages] Saved message for chat ${currentChatId}, isUser: ${latestMessage.isUser}`)
        } catch (error) {
          console.error("[Messages] Error saving chat history:", error)
        }
      }
    }

    // Only run effect when a new message is added
    if (messages.length > 0) {
      saveMessages()
    }
  }, [messages.length, currentChatId, currentChatTitle]) // Only depend on messages.length, not messages array

  // Save chat title when it changes
  useEffect(() => {
    const saveChatTitle = async () => {
      if (currentChatId) {
        try {
          await updateChatTitleInDb(currentChatId, currentChatTitle)
          console.log(`[Messages] Updated title for chat ${currentChatId} to: ${currentChatTitle}`)
        } catch (error) {
          console.error(`[Messages] Error updating chat title:`, error)
        }
      }
    }
    
    if (currentChatId) {
      saveChatTitle()
    }
  }, [currentChatTitle, currentChatId])

  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      // Update state if this is the current chat
      if (chatId === currentChatId) {
        setCurrentChatTitle(title)
      }
      
      // Update in database
      await updateChatTitleInDb(chatId, title)
      console.log(`[Messages] Updated title for chat ${chatId} to: ${title}`)
    } catch (error) {
      console.error(`[Messages] Error updating chat title for ${chatId}:`, error)
    }
  }

  const clearMessages = () => {
    setMessages([])
  }

  const loadChatHistory = async (chatId: string) => {
    try {
      console.log(`[Messages] Starting to load chat history for ${chatId}`);
      
      // Load chat metadata
      const metadata = await getChatMetadataFromDb(chatId)
      let chatTitle = DEFAULT_CHAT_TITLE
      
      if (metadata) {
        chatTitle = metadata.title
        console.log(`[Messages] Loaded metadata for ${chatId}, title: ${chatTitle}`)
      } else {
        // Create metadata if it doesn't exist
        await saveChatToDb(chatId, DEFAULT_CHAT_TITLE)
        console.log(`[Messages] Created new metadata for ${chatId} with default title`)
      }
      
      // Set current chat title
      setCurrentChatTitle(chatTitle)
      
      // Load messages
      const loadedMessages = await getChatMessagesFromDb(chatId)
      
      if (loadedMessages.length > 0) {
        console.log(`[Messages] Loaded ${loadedMessages.length} messages for chat ${chatId}`)
        setMessages(loadedMessages)
        setCurrentChatId(chatId)
        
        // Ensure all messages are properly saved to database (data consistency check)
        await saveAllMessages(chatId, loadedMessages)
      } else {
        // Chat ID exists but no messages - set empty array
        setMessages([])
        setCurrentChatId(chatId)
        console.log(`[Messages] No chat history found for ${chatId}, starting empty with title: ${chatTitle}`)
      }
    } catch (error) {
      console.error(`[Messages] Error loading chat history for ${chatId}:`, error)
      // Reset to empty state on error
      setMessages([])
      setCurrentChatId(chatId)
      setCurrentChatTitle(DEFAULT_CHAT_TITLE)
    }
  }

  const startNewChat = () => {
    // Generate a new chat ID with timestamp
    const newChatId = `chat-${Date.now()}`
    // Reset messages and set the new chat ID
    setMessages([])
    setCurrentChatId(newChatId)
    setCurrentChatTitle(DEFAULT_CHAT_TITLE)
    
    // Create the chat in the database
    saveChatToDb(newChatId, DEFAULT_CHAT_TITLE)
      .catch(error => console.error(`[Messages] Error creating new chat:`, error))
    
    console.log(`[Messages] Started new chat with ID: ${newChatId}`)
    return newChatId
  }

  // Helper function to manually save all messages for a chat - useful to ensure data consistency
  const saveAllMessages = async (chatId: string, messagesToSave: Message[]) => {
    if (!chatId || messagesToSave.length === 0) return;
    
    try {
      console.log(`[Messages] Saving all ${messagesToSave.length} messages for chat ${chatId}`);
      
      // Ensure chat exists
      await saveChatToDb(chatId, currentChatTitle);
      
      // Save each message
      for (const message of messagesToSave) {
        await saveMessageToDb(message, chatId);
      }
      
      console.log(`[Messages] Successfully saved all messages for chat ${chatId}`);
    } catch (error) {
      console.error(`[Messages] Error saving all messages for chat ${chatId}:`, error);
    }
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
        updateChatTitle,
        currentChatTitle,
        setCurrentChatTitle,
        saveAllMessages,
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

// Get all chats with their metadata
export async function getChatHistoryList(): Promise<Array<{ id: string; timestamp: number; title: string }>> {
  try {
    const chats = await getAllChatsFromDb()
    
    return chats.map(chat => ({
      id: chat.id,
      timestamp: chat.updatedAt,
      title: chat.title
    }))
  } catch (error) {
    console.error("[Messages] Error getting chat history list:", error)
    return []
  }
}
