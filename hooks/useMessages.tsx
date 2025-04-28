import { ReactNode, createContext, useContext, useState } from "react"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: string
}

interface MessagesContextType {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])

  const clearMessages = () => setMessages([])

  return (
    <MessagesContext.Provider
      value={{
        messages,
        setMessages,
        clearMessages,
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
