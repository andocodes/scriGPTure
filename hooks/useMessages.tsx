import React, { createContext, ReactNode, useContext, useState } from "react"

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
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

interface MessagesProviderProps {
  children: ReactNode
}

export function MessagesProvider({ children }: MessagesProviderProps) {
  const [messages, setMessages] = useState<Message[]>([])

  const clearMessages = () => {
    setMessages([])
  }

  return (
    <MessagesContext.Provider value={{ messages, setMessages, clearMessages }}>
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
