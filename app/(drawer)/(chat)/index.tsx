import { useRef, useState, useEffect } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import React from 'react'
import { Container } from "~/components/Container"
import { ChatInput } from "~/components/chat/ChatInput"
import { LoadingMessage } from "~/components/chat/LoadingMessage"
import { Message } from "~/components/chat/Message"
import { VerseContext, VerseContextItem } from "~/components/chat/VerseContext"
import { useMessages } from "~/hooks/useMessages"

export default function ChatScreen() {
  const { messages, setMessages } = useMessages()
  const [isLoading, setIsLoading] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const [inputValue, setInputValue] = useState("")
  const [contextVerses, setContextVerses] = useState<VerseContextItem[]>([])

  const params = useLocalSearchParams<{ verseReference?: string; verseText?: string }>()

  useEffect(() => {
    if (params.verseReference && params.verseText) {
      console.log("[ChatScreen] Received verse params:", params)
      
      // Add the verse to context instead of prepopulating the input
      const newVerseContext: VerseContextItem = {
        id: Date.now().toString(),
        reference: params.verseReference,
        text: params.verseText
      }
      
      // Check if we already have this verse in context (by reference)
      const exists = contextVerses.some(v => v.reference === params.verseReference)
      if (!exists) {
        setContextVerses(prev => [...prev, newVerseContext])
      }
    }
  }, [params])

  const handleRemoveVerse = (id: string) => {
    setContextVerses(prev => prev.filter(verse => verse.id !== id))
  }

  const handleClearVerses = () => {
    setContextVerses([])
  }

  const handleSend = async (content: string) => {
    // Add context information if present
    let messageContent = content
    
    if (contextVerses.length > 0) {
      const contextHeader = "Context provided:\n" + 
        contextVerses.map(v => `${v.reference}: "${v.text}"`).join("\n\n") +
        "\n\n" + content;
        
      messageContent = contextHeader;
    }
    
    const newMessage = {
      id: Date.now().toString(),
      content: messageContent,
      isUser: true,
      timestamp: new Date().toISOString(),
    }

    setMessages([...messages, newMessage])
    setIsLoading(true)

    // Clear input after sending
    setInputValue("")

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        content: "I am scriGPTure, your Bible study assistant. How can I help you today?",
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

        <VerseContext 
          verses={contextVerses}
          onRemove={handleRemoveVerse}
          onClear={handleClearVerses}
        />
        
        <ChatInput 
          inputValue={inputValue} 
          onInputChange={setInputValue} 
          onSend={handleSend} 
        />
      </KeyboardAvoidingView>
    </Container>
  )
}
