import { useRef, useState, useEffect } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, View, Alert } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import React from 'react'
import { Container } from "~/components/Container"
import { ChatInput } from "~/components/chat/ChatInput"
import { LoadingMessage } from "~/components/chat/LoadingMessage"
import { Message } from "~/components/chat/Message"
import { VerseContext, VerseContextItem } from "~/components/chat/VerseContext"
import { useMessages } from "~/hooks/useMessages"
import { getChatCompletionStream, OpenRouterMessage } from "~/services/openRouterService"
import { SYSTEM_PROMPT, MISSING_API_KEY_MESSAGE, API_UNAVAILABLE_MESSAGE } from "~/config/prompts"
import { useAppStore } from "~/store/store"

export default function ChatScreen() {
  const { 
    messages, 
    setMessages, 
    currentChatId, 
    loadChatHistory, 
    startNewChat 
  } = useMessages()
  const [isLoading, setIsLoading] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const [inputValue, setInputValue] = useState("")
  const [contextVerses, setContextVerses] = useState<VerseContextItem[]>([])
  const openRouterApiKey = useAppStore((state) => state.openRouterApiKey)
  const abortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter()

  const params = useLocalSearchParams<{ 
    verseReference?: string; 
    verseText?: string;
    chatId?: string;
  }>()

  // Initialize chat based on chatId parameter or create a new chat
  useEffect(() => {
    const initializeChat = async () => {
      if (params.chatId) {
        // Load existing chat history
        await loadChatHistory(params.chatId)
        console.log(`[ChatScreen] Loaded chat history for ID: ${params.chatId}`)
      } else if (!currentChatId) {
        // Start a new chat if no chatId is provided and no current chat is active
        const newChatId = startNewChat()
        console.log(`[ChatScreen] Started new chat with ID: ${newChatId}`)
        
        // Update URL with the new chat ID (for bookmark/share capability)
        router.setParams({ chatId: newChatId })
      }
    }

    initializeChat()
  }, [params.chatId, currentChatId, loadChatHistory, startNewChat, router])

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

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
    if (!openRouterApiKey) {
      Alert.alert("API Key Required", MISSING_API_KEY_MESSAGE);
      return;
    }

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

    // For the API, we construct a context-rich prompt
    let contextText = "";
    if (contextVerses.length > 0) {
      contextText = "Context:\n" + 
        contextVerses.map(v => `${v.reference}: "${v.text}"`).join("\n");
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Construct messages array for the API
      const apiMessages: OpenRouterMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        // Convert previous messages to the API format
        ...messages.map(msg => ({
          role: msg.isUser ? 'user' as const : 'assistant' as const,
          content: msg.content
        })),
        // Add the latest user message with context embedded
        { 
          role: 'user', 
          content: contextText ? `${contextText}\n\nUser question: ${content}` : content 
        }
      ];

      console.log('[ChatScreen] Sending request to OpenRouter API');
      
      // Create placeholder for assistant message that we'll update as chunks arrive
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage = {
        id: assistantMessageId,
        content: "",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Process streaming response
      const stream = await getChatCompletionStream(
        apiMessages,
        openRouterApiKey,
        abortControllerRef.current.signal,
        (chunk) => {
          // Update the assistant message content as chunks arrive
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: msg.content + chunk
                };
              }
              return msg;
            });
          });
          
          // Scroll to the latest content
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      );
      
      if (!stream) {
        throw new Error("Failed to get response stream");
      }
      
      // The stream processing happens via the onChunk callback
      // We just need to wait for it to complete
      await new Promise<void>((resolve, reject) => {
        // The ReadableStream is already being consumed by our callback
        // This promise resolves when the stream is done
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          reject(new Error('Request aborted'));
        });
        
        // We don't actually consume the stream here since it's handled by getChatCompletionStream
        resolve();
      });
      
    } catch (error) {
      console.error('[ChatScreen] Error in API request:', error);
      
      // Only show error if not aborted
      if (!(error instanceof Error && error.message === 'Request aborted')) {
        // Update the assistant message with an error
        setMessages(prevMessages => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          
          // If the last message is an empty assistant message, update it
          if (!lastMessage.isUser && lastMessage.content === "") {
            return [
              ...prevMessages.slice(0, -1),
              {
                ...lastMessage,
                content: API_UNAVAILABLE_MESSAGE
              }
            ];
          }
          
          // Otherwise add a new error message
          return [
            ...prevMessages,
            {
              id: Date.now().toString(),
              content: API_UNAVAILABLE_MESSAGE,
              isUser: false,
              timestamp: new Date().toISOString(),
            }
          ];
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
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
