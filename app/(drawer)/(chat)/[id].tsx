import { useLocalSearchParams } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native"
import { Container } from "~/components/Container"
import { ChatInput } from "~/components/chat/ChatInput"
import { LoadingMessage } from "~/components/chat/LoadingMessage"
import { Message } from "~/components/chat/Message"
import mockChats from "~/mocks/chats.json"

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [messages, setMessages] = useState(
    mockChats.chats.find((chat) => chat.id === id)?.messages ?? []
  )
  const [isLoading, setIsLoading] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  const handleSend = async (content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, newMessage])
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        content: "I am ScriGPTure, your Bible study assistant. How can I help you today?",
        isUser: false,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiResponse])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <Container>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }}
        >
          {messages.map((message) => (
            <Message
              key={message.id}
              content={message.content}
              isUser={message.isUser}
              timestamp={new Date(message.timestamp)}
            />
          ))}
          {isLoading && <LoadingMessage />}
        </ScrollView>

        <ChatInput onSend={handleSend} />
      </KeyboardAvoidingView>
    </Container>
  )
}
