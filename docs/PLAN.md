# scriGPTure Project Plan

This document outlines the development plan for the scriGPTure Bible app.

## API Keys (For Reference)

*   **OpenRouter:** `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`
*   **API.Bible:** `6514da84cf38ee1d734031669a5c400d`

**Note:** These keys should be stored securely in the application using `expo-secure-store` and ideally not committed directly into version control in a real-world scenario (e.g., use environment variables or a build-time process).

## Development Phases

**Phase 1: Core Data Layer & Bible Reading (Using API.Bible)**

1.  **Setup:**
    *   Install and configure `expo-sqlite`.
    *   Install and configure `zustand`.
    *   Install `expo-secure-store` (for API keys).
    *   Install `axios` (or decide to use `fetch`) for API calls.
2.  **API Keys:**
    *   Implement logic to securely store and retrieve API keys using `expo-secure-store`.
3.  **Database:**
    *   Define SQLite schema (translations, books, chapters, verses).
    *   Create database initialization logic.
4.  **API Service (API.Bible):**
    *   Create an API service module for `API.Bible`.
    *   Implement logic to fetch available translations using the API key.
    *   Implement logic to fetch the *entire content* of a selected translation and store it efficiently in SQLite. Provide user feedback during download.
5.  **State Management (Zustand):**
    *   Set up Zustand store: Selected Translation, Current Location, Downloaded Translations status, API Keys (retrieved from secure store), chat messages (for Phase 2).
6.  **Reading View:**
    *   Create/update the main Bible reading screen (`app/(drawer)/(bible)/index.tsx`).
    *   Implement Book/Chapter selection UI.
    *   Fetch and display verse text from SQLite using `FlashList`.
    *   Connect UI to Zustand store.
7.  **Translation Selection:**
    *   Implement UI to view/select available/downloaded translations from `API.Bible`.
    *   Allow switching between downloaded translations via Zustand.

**Phase 2: LLM Chat Feature (Using OpenRouter)**

1.  **Setup:**
    *   Configure API service module for OpenRouter using its API key from the store.
2.  **UI:**
    *   Integrate existing chat components (`components/chat/`) into the `app/(drawer)/(chat)/index.tsx` screen.
    *   Connect UI elements (input, message list) to Zustand state.
3.  **Logic:**
    *   Define the desired "personality" in a system prompt.
    *   Implement the function to:
        *   Take user input from `ChatInput`.
        *   Send the system prompt + conversation history + user input to a selected free model via OpenRouter.
        *   Handle the streaming or complete response.
        *   Update the message list in Zustand.
        *   Display loading indicators (`LoadingMessage`).

**Phase 3: Search Functionality**

1.  **UI:** Design and implement a search input screen/component.
2.  **Logic:** Implement search function using SQLite `LIKE` queries or potentially Full-Text Search (FTS extension if needed for performance) against the `verses` table. Search across the currently selected translation.
3.  **Results:** Display search results (verse reference + text snippet) and allow navigation to the selected verse in the reading view.

**Phase 4: User Annotations (Bookmarks & Notes)**

1.  **Database:** Extend SQLite schema for `bookmarks` and `notes` tables, linking them to verses.
2.  **Bookmarks:**
    *   Add UI elements (e.g., icon button per verse or in header) to add/remove bookmarks for the current verse or a selected verse.
    *   Create a screen (`app/(drawer)/(bible)/favourites.tsx` seems like a candidate) to list bookmarked verses.
    *   Allow navigation from the bookmark list back to the verse in the reading view.
3.  **Notes:**
    *   Add UI elements to verses to indicate/add/view notes.
    *   Implement a modal or screen to write/edit notes for a specific verse.
    *   Store notes in SQLite.
    *   Optionally, create a separate screen to list all notes.

**Phase 5: Enhancements (Audio & Daily Readings)**

1.  **Audio Playback:**
    *   Research APIs or sources providing Bible audio aligned with text (requires investigation, `bible-api.com` doesn't seem to offer it directly).
    *   Integrate an audio player (`expo-av`?) into the reading view.
    *   Implement controls (play/pause, progress). Sync playback with verse highlighting if possible.
2.  **Daily Readings:**
    *   Define reading plan structures (e.g., M'Cheyne, chronological). Store plans potentially in JSON or SQLite.
    *   Implement UI to select and track progress in a reading plan.
    *   Display the current day's reading passage(s).
    *   (Optional Stretch) Use `expo-notifications` and `expo-task-manager` for daily reminder notifications.

**Phase 6: Refinement & Polish**

1.  **UI/UX:** Refine styling using NativeWind, ensure consistency, improve transitions, add font size/theme options, etc.
2.  **Error Handling:** Add robust error handling for API calls, database operations, etc.
3.  **Performance:** Optimize list rendering, database queries, and startup time.
4.  **Testing:** Add unit/integration tests. 