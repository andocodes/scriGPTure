# Phase 2: LLM Chat Feature Implementation Plan

This document details the steps required to implement the LLM chat feature using OpenRouter, based on Phase 2 of the main `PLAN.md`.

## 1. OpenRouter API Service (`services/openRouterService.ts`)

*   **Objective:** Create a dedicated module to handle communication with the OpenRouter API.
*   **Steps:**
    1.  Create a new file: `services/openRouterService.ts`.
    2.  Import the `openRouterApiKey` from the Zustand store (`useAppStore`).
    3.  Define necessary types for API requests and responses (e.g., Message structure for the API, streaming chunk format).
    4.  Implement a function `getChatCompletionStream` (or similar):
        *   Accepts arguments: `messages` (conversation history, including system prompt and user message), `apiKey`.
        *   Constructs the request body for the OpenRouter `/chat/completions` endpoint, specifying a suitable free model (e.g., `mistralai/mistral-7b-instruct-free` or `google/gemma-7b-it:free`).
        *   Sets `stream: true` in the request.
        *   Uses `fetch` API with appropriate headers (Authorization: Bearer `apiKey`, Content-Type: application/json).
        *   Handles the streaming response:
            *   Uses `ReadableStream` and `TextDecoder` to process Server-Sent Events (SSE).
            *   Parses JSON data chunks from the stream (likely prefixed with `data:`).
            *   Provides a callback or async generator to yield the content chunks (`delta.content`).
        *   Includes error handling for API requests and stream processing.

## 2. System Prompt Definition (`config/prompts.ts`)

*   **Objective:** Define the guiding personality and instructions for the AI.
*   **Steps:**
    1.  Create a new file: `config/prompts.ts`.
    2.  Define a constant `SYSTEM_PROMPT` containing the desired personality:
        *   "You are scriGPTure, a Christ-centered, pastoral, and friendly Bible study assistant. Your purpose is to help users understand the Bible better, drawing connections within the text and offering insights grounded in scripture. Respond with kindness and clarity, like a helpful guide inspired by the Holy Spirit. When provided with specific Bible verses as context, focus your answer primarily on those verses, explaining their meaning, context, and relevance to the user's question. Avoid speculation and stick closely to established biblical interpretation. If the user asks a question unrelated to the provided context or the Bible, gently steer the conversation back or state that you can primarily assist with Bible-related inquiries."
    3.  Export the constant.

## 3. AI Integration in Chat Screen (`app/(drawer)/(chat)/index.tsx`)

*   **Objective:** Replace the simulated AI response with actual calls to the OpenRouter service.
*   **Steps:**
    1.  Import `getChatCompletionStream` from `services/openRouterService.ts`.
    2.  Import `SYSTEM_PROMPT` from `config/prompts.ts`.
    3.  Import `openRouterApiKey` from the Zustand store (`useAppStore`).
    4.  Modify the `handleSend` function:
        *   Retrieve the `openRouterApiKey` from the store. Handle the case where it might be missing (show an error to the user).
        *   Prepare the message list for the API:
            *   Start with `{ role: 'system', content: SYSTEM_PROMPT }`.
            *   Add previous messages from `useMessages` hook, mapping them to `{ role: 'user' | 'assistant', content: message.content }`.
            *   Append the latest user message, **including the context string** that's already being constructed (e.g., `User question: ${content}

Context:
${verseReferencesAndText}`).
        *   Call `getChatCompletionStream` with the prepared messages and API key.
        *   Immediately add an empty assistant message placeholder to the `messages` state to hold the streaming response. Store its ID.
        *   As chunks arrive from the stream:
            *   Update the content of the placeholder assistant message in the `messages` state by appending the chunk (`delta.content`).
            *   Ensure the `ScrollView` scrolls down as content is added.
        *   Handle stream completion: Finalize the assistant message state.
        *   Handle errors during the stream: Display an error message to the user.
        *   Set `isLoading` to `false` only after the stream is fully processed or an error occurs.
    5.  Remove the `setTimeout` simulation.

## 4. Persistent Chat History

*   **Objective:** Save and load chat conversations persistently.
*   **Challenge:** Deciding *how* to store history (e.g., one entry per chat, storing all messages in AsyncStorage, or a more robust DB solution like SQLite if chats become large).
*   **Option A (Simpler - AsyncStorage per chat):**
    1.  Modify `useMessages` hook or create a new hook (`useChatHistory`).
    2.  When a new chat is initiated (e.g., via `HeaderNewChatButton` or navigating to `/(chat)/` without an ID), generate a unique chat ID (e.g., `chat-${Date.now()}`).
    3.  Modify `useMessages` state to potentially hold `currentChatId`.
    4.  When messages are updated (`setMessages`), also save the entire message array to AsyncStorage under a key derived from `currentChatId` (e.g., `chatHistory_${currentChatId}`).
    5.  When the chat screen loads, check for a `chatId` parameter. If present, load messages from AsyncStorage using that ID. If not, start a new chat (generate ID, clear messages).
    6.  Implement a "History" screen (`app/(drawer)/(chat)/history.tsx`?):
        *   List stored chat sessions from AsyncStorage (scan keys matching `chatHistory_`).
        *   Allow tapping a session to navigate to `app/(drawer)/(chat)/index.tsx` with the corresponding `chatId` parameter.
*   **Option B (More Robust - SQLite):**
    1.  Extend the SQLite schema (`db/database.ts`) with `chats` and `chat_messages` tables.
    2.  Update `useMessages` or `useChatHistory` to save/load messages to/from SQLite, associated with a specific `chatId`.
    3.  Implement the History screen to query the `chats` table.
    *(Decision:* Start with Option A for simplicity, consider B later if needed).*

## 5. Refinements

*   **Error Handling:** Add user-friendly error messages (e.g., "Failed to connect to AI", "API key missing").
*   **Loading States:** Ensure smooth loading indicators while waiting for the first chunk.
*   **UI Polish:** Refine the appearance of messages and the verse context display.


This plan provides a clear roadmap for implementing the core chat functionality with AI integration and context handling. 