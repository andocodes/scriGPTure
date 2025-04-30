import React, { createContext, ReactNode, useContext, useState, useEffect } from "react"
import { 
  Message, 
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
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set())

  // Save messages to database whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      if (currentChatId && messages.length > 0) {
        try {
          // Ensure chat exists in database
          await saveChatToDb(currentChatId, currentChatTitle)
          
          // Find the last message that was added
          const latestMessage = messages[messages.length - 1]
          
          // Skip if this message ID has already been saved
          if (savedMessageIds.has(latestMessage.id)) {
            // Just skip quietly to reduce log noise
            return
          }
          
          // Save the message to the database
          await saveMessageToDb(latestMessage, currentChatId)
          
          // Add this message ID to our saved set to avoid duplicate saves
          setSavedMessageIds(prev => new Set(prev).add(latestMessage.id))
          
          const messageType = latestMessage.isUser ? "USER" : "AI";
          const previewContent = latestMessage.content.substring(0, 30) + (latestMessage.content.length > 30 ? '...' : '');
          console.log(`[Messages] Auto-saved ${messageType} message for chat ${currentChatId}, id: ${latestMessage.id}, content: "${previewContent}"`)
        } catch (error) {
          console.error("[Messages] Error saving chat history:", error)
        }
      }
    }

    // Run effect whenever a message is added or changed
    saveMessages()
  }, [messages, currentChatId, currentChatTitle, savedMessageIds])
  
  // Save ALL messages whenever messages array changes completely
  // This helps ensure integrity when loading a chat
  useEffect(() => {
    const saveAllMessagesOnLoad = async () => {
      if (currentChatId && messages.length > 0) {
        try {
          // Check if we need to save all messages (e.g., on chat load)
          // by comparing with our savedMessageIds
          const unsavedMessages = messages.filter(msg => !savedMessageIds.has(msg.id));
          
          if (unsavedMessages.length > 0) {
            console.log(`[Messages] Found ${unsavedMessages.length} unsaved messages to save`);
            
            // Use our saveAllMessages function to save them
            await saveAllMessages(currentChatId, unsavedMessages);
            
            // Add all these IDs to our saved set
            const newSavedIds = new Set(savedMessageIds);
            unsavedMessages.forEach(msg => newSavedIds.add(msg.id));
            setSavedMessageIds(newSavedIds);
          }
        } catch (error) {
          console.error("[Messages] Error in bulk message save:", error);
        }
      }
    };
    
    // Call this function when messages array changes
    saveAllMessagesOnLoad();
  }, [currentChatId, messages.length]);

  // Clear saved message IDs when changing chats
  useEffect(() => {
    if (currentChatId) {
      // Reset saved IDs when switching to a new chat
      setSavedMessageIds(new Set())
    }
  }, [currentChatId])

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
      
      // Reset message array to avoid mixing messages from different chats
      setMessages([]);
      
      // Reset saved message IDs when loading a different chat
      setSavedMessageIds(new Set());
      
      // Set the currentChatId first to ensure proper context for subsequent operations
      setCurrentChatId(chatId);
      
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
        
        // Update the savedMessageIds with all loaded message IDs
        const messageIds = new Set(loadedMessages.map(msg => msg.id));
        setSavedMessageIds(messageIds);
        
        // Set messages in state
        setMessages(loadedMessages)
        
        // Log some sample message info
        if (loadedMessages.length > 0) {
          const lastMsg = loadedMessages[loadedMessages.length - 1];
          console.log(`[Messages] Last message - isUser: ${lastMsg.isUser}, contentLength: ${lastMsg.content.length}`);
        }
      } else {
        // Chat ID exists but no messages - set empty array
        setMessages([])
        console.log(`[Messages] No chat history found for ${chatId}, starting empty with title: ${chatTitle}`)
      }
    } catch (error) {
      console.error(`[Messages] Error loading chat history for ${chatId}:`, error)
      // Reset to empty state on error
      setMessages([])
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
      
      // Ensure chat exists with proper title
      const chatTitle = currentChatId === chatId ? currentChatTitle : DEFAULT_CHAT_TITLE;
      await saveChatToDb(chatId, chatTitle);
      
      // Save each message with proper error handling
      for (const message of messagesToSave) {
        try {
          await saveMessageToDb(message, chatId);
        } catch (msgError) {
          console.error(`[Messages] Error saving individual message ${message.id}:`, msgError);
          // Continue with next message instead of failing entire batch
        }
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
