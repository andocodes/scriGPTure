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
        console.log(`[ChatScreen] Adding verse to context: ${params.verseReference}`);
        setContextVerses(prev => [...prev, newVerseContext])
      }
    }
  }, [params.verseReference, params.verseText])

  const handleRemoveVerse = (id: string) => {
    console.log(`[ChatScreen] Removing verse with id: ${id}`);
    setContextVerses(prev => {
      const updated = prev.filter(verse => verse.id !== id);
      console.log(`[ChatScreen] Updated context verses:`, updated);
      return updated;
    });
  }

  const handleClearVerses = () => {
    console.log('[ChatScreen] Clearing all context verses');
    setContextVerses([]);
  }

  const handleSend = async (content: string) => {
    // Create message context from verses if present
    const messageContext = contextVerses.length > 0 ? {
      verses: contextVerses.map(v => ({
        reference: v.reference,
        text: v.text
      }))
    } : undefined;
    
    // Create the user message without embedding context in content
    const newMessage = {
      id: Date.now().toString(),
      content: content,
      isUser: true,
      timestamp: new Date().toISOString(),
      context: messageContext,
    }

    setMessages([...messages, newMessage])
    setIsLoading(true)

    // Clear input after sending
    setInputValue("")

    // For the backend processing, we would include context in the prompt
    // Here we construct what would be sent to the backend API
    let apiPrompt = content;
    if (contextVerses.length > 0) {
      const contextText = "Context:\n" + 
        contextVerses.map(v => `${v.reference}: "${v.text}"`).join("\n");
      apiPrompt = `${contextText}\n\nUser question: ${content}`;
      console.log("[ChatScreen] API prompt with context:", apiPrompt);
    }

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
              context={message.context}
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
