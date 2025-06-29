import { useRef, useState, useEffect } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, View, Alert, ActivityIndicator, Text, Pressable, TextInput } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import React from 'react'
import { Container } from "~/components/Container"
import { ChatInput } from "~/components/chat/ChatInput"
import { LoadingMessage } from "~/components/chat/LoadingMessage"
import { Message } from "~/components/chat/Message"
import { VerseContext, VerseContextItem } from "~/components/chat/VerseContext"
import { useMessages } from "~/hooks/useMessages"
import { getChatCompletionStream, getChatCompletion, OpenRouterMessage } from "~/services/openRouterService"
import { SYSTEM_PROMPT, MISSING_API_KEY_MESSAGE, API_UNAVAILABLE_MESSAGE } from "~/config/prompts"
import { useAppStore } from "~/store/store"
import { saveMessageToDb } from "~/db/database"

export default function ChatScreen() {
  const { 
    messages, 
    setMessages, 
    currentChatId,
    currentChatTitle,
    setCurrentChatTitle,
    updateChatTitle, 
    loadChatHistory, 
    startNewChat 
  } = useMessages()
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const scrollViewRef = useRef<ScrollView>(null)
  const [inputValue, setInputValue] = useState("")
  const [contextVerses, setContextVerses] = useState<VerseContextItem[]>([])
  const openRouterApiKey = useAppStore((state) => state.openRouterApiKey)
  const abortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter()
  const previousChatIdRef = useRef<string | null>(null)

  const params = useLocalSearchParams<{ 
    verseReference?: string; 
    verseText?: string;
    chatId?: string;
    ts?: string; // Timestamp for forcing remount
  }>()

  // Initialize chat based on chatId parameter or create a new chat
  useEffect(() => {
    const initializeChat = async () => {
      const chatIdParam = params.chatId;
      console.log(`[ChatScreen] initializeChat called with chatId: ${chatIdParam}, currentChatId: ${currentChatId}, previousChatIdRef: ${previousChatIdRef.current}, timestamp: ${params.ts}`);
      
      // Skip if we're already on this chat and no timestamp update triggered refresh
      if (chatIdParam === previousChatIdRef.current && chatIdParam === currentChatId && !params.ts) {
        console.log(`[ChatScreen] Already on chat ${chatIdParam}, skipping initialization`);
        return;
      }
      
      // Update previous chat id reference
      previousChatIdRef.current = chatIdParam ?? null;
      
      if (chatIdParam) {
        // Load existing chat history
        setIsHistoryLoading(true);
        try {
          // First clear the messages array to avoid any stale data
          setMessages([]);
          
          // Then load the chat history for the specified chat ID
          await loadChatHistory(chatIdParam);
          console.log(`[ChatScreen] Loaded chat history for ID: ${chatIdParam}`);
          
          // Double-check we loaded the correct chat ID
          if (currentChatId !== chatIdParam) {
            console.warn(`[ChatScreen] Chat ID mismatch: loaded ${currentChatId} but expected ${chatIdParam}`);
          }
        } catch (error) {
          console.error(`[ChatScreen] Error loading chat ${chatIdParam}:`, error);
          Alert.alert("Error", "Failed to load chat history");
        } finally {
          setIsHistoryLoading(false);
        }
      } else if (!currentChatId) {
        // Start a new chat if no chatId is provided and no current chat is active
        const newChatId = startNewChat();
        console.log(`[ChatScreen] Started new chat with ID: ${newChatId}`);
        
        // Update URL with the new chat ID (for bookmark/share capability)
        router.setParams({ chatId: newChatId });
      }
    };

    initializeChat();
    // Only depend on necessary params to avoid excessive re-renders
  }, [params.chatId, params.ts]);

  // Update edited title when current title changes
  useEffect(() => {
    setEditedTitle(currentChatTitle);
  }, [currentChatTitle]);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100); // Small delay to ensure content is rendered
    
    return () => clearTimeout(timer);
  }, [messages, isLoading, isHistoryLoading]);

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

  const handleStartTitleEdit = () => {
    setIsEditingTitle(true);
    setEditedTitle(currentChatTitle);
  };

  const handleSaveTitle = async () => {
    // Don't save empty titles
    if (editedTitle.trim() === "") {
      setEditedTitle("New Chat");
    }

    if (currentChatId) {
      try {
        await updateChatTitle(currentChatId, editedTitle);
        console.log(`[ChatScreen] Updated title for chat ${currentChatId} to: ${editedTitle}`);
      } catch (error) {
        console.error(`[ChatScreen] Error updating title:`, error);
      }
    } else {
      // Just update state if no chat ID (should not happen)
      setCurrentChatTitle(editedTitle);
    }
    
    setIsEditingTitle(false);
  };

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

    // Check if this is the first message and generate a title
    if (messages.length === 0 && currentChatTitle === "New Chat") {
      // Generate a title from the user message
      const generatedTitle = content.length > 30
        ? `${content.substring(0, 30)}...`
        : content;
      
      // Update chat title
      setCurrentChatTitle(generatedTitle);
      console.log(`[ChatScreen] Auto-generated title: ${generatedTitle}`);
    }

    // First update the messages in state with the user's message
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    // Manual save of user message to ensure it's saved properly
    if (currentChatId) {
      try {
        // Make sure we await this - it's critical user messages are saved
        await saveMessageToDb(newMessage, currentChatId);
        console.log(`[ChatScreen] Manually saved user message ${newMessage.id} to DB`);
      } catch (error) {
        console.error("[ChatScreen] Error manually saving user message:", error);
      }
    } else {
      console.warn("[ChatScreen] No currentChatId available, user message not saved to DB");
    }

    // Clear input after sending
    setInputValue("");

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
        ...updatedMessages.map(msg => ({
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
      
      // Add the empty assistant message to UI
      setMessages(prev => [...prev, assistantMessage]);
      
      // First, get the complete response and save it to the database
      const completeContent = await getChatCompletion(
        apiMessages,
        openRouterApiKey,
        abortControllerRef.current.signal
      );
      
      console.log(`[ChatScreen] Received complete content of length: ${completeContent.length}`);
      
      // Save the complete message to the database
      if (currentChatId) {
        try {
          const completeMessage = {
            ...assistantMessage,
            content: completeContent
          };
          
          await saveMessageToDb(completeMessage, currentChatId);
          console.log(`[ChatScreen] Successfully saved complete AI message (${completeContent.length} chars) to DB`);
        } catch (error) {
          console.error('[ChatScreen] Error saving complete AI message:', error);
        }
      }
      
      // Now start the artificial streaming for UI updates
      let displayedContent = "";
      
      // Create artificial chunks like the streaming function does (10-20 chars per chunk)
      const chunkSize = 15; // Average chunk size
      const chunks: string[] = [];
      
      for (let i = 0; i < completeContent.length; i += chunkSize) {
        chunks.push(completeContent.slice(i, i + chunkSize));
      }
      
      // Process chunks with delays to simulate streaming
      for (const chunk of chunks) {
        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        // Add a slight delay between chunks
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
        
        // Update displayed content
        displayedContent += chunk;
        
        // Update UI
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: displayedContent
              };
            }
            return msg;
          });
        });
        
        // Scroll to the latest content
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
      
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
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        {isEditingTitle ? (
          <View className="flex-1 flex-row">
            <TextInput
              className="flex-1 border border-gray-300 rounded px-2 py-1 mr-2"
              value={editedTitle}
              onChangeText={setEditedTitle}
              autoFocus
              onBlur={handleSaveTitle}
              onSubmitEditing={handleSaveTitle}
              style={{ minWidth: 50 }} // Ensure minimum width to prevent NaN layout issues
            />
            <Pressable
              className="bg-green-500 px-3 py-1 rounded"
              onPress={handleSaveTitle}
            >
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable 
            className="flex-1 flex-row items-center" 
            onPress={handleStartTitleEdit}
          >
            <Text className="text-xl font-bold mr-2" numberOfLines={1} ellipsizeMode="tail">
              {currentChatTitle}
            </Text>
            <Text className="text-xs text-gray-500">(tap to edit)</Text>
          </Pressable>
        )}
      </View>
      
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {isHistoryLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#e74c3c" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4"
            contentContainerStyle={{ paddingVertical: 16 }}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }}
          >
            {messages.length > 0 ? (
              messages.map((message) => (
                <Message
                  key={message.id}
                  content={message.content}
                  isUser={message.isUser}
                  timestamp={new Date(message.timestamp)}
                  context={message.context}
                />
              ))
            ) : (
              <View className="flex-1 justify-center items-center py-10">
                <Text className="text-gray-400">Start a new conversation...</Text>
              </View>
            )}
            {isLoading && <LoadingMessage />}
          </ScrollView>
        )}

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
