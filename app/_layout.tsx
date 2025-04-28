import "../global.css"
import { useEffect } from "react";
import { Stack } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { MessagesProvider } from "~/hooks/useMessages"
import { loadApiKeys, saveApiKeys } from "~/utils/apiKeyManager"
import { initializeStore } from "~/store/store";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(drawer)",
}

// API Keys - REMOVE/REPLACE with a secure method before production
const OPENROUTER_API_KEY = "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";
const APIBIBLE_API_KEY = "6514da84cf38ee1d734031669a5c400d";

export default function RootLayout() {
  // Effect to save API keys and initialize store
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Check and save API keys if needed
      const { openRouterKey, apiBibleKey } = await loadApiKeys();
      if (!openRouterKey || !apiBibleKey) {
        console.log("API keys not found, attempting to save...");
        try {
          await saveApiKeys(OPENROUTER_API_KEY, APIBIBLE_API_KEY);
        } catch (error) {
          console.error("Failed to save API keys on initial load:", error);
          // Decide if app should proceed without keys?
        }
      } else {
        console.log("API keys already stored.");
      }

      // 2. Initialize the Zustand store (loads keys into state, etc.)
      console.log("Initializing app state...");
      await initializeStore();
      console.log("App state initialized.");

      // TODO: Add any other essential async setup here (e.g., check DB connection)
    };

    initializeApp();
  }, []); // Run only once on mount

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MessagesProvider>
        <Stack screenOptions={{ headerTitleAlign: "center" }}>
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          {/*<Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />*/}
        </Stack>
      </MessagesProvider>
    </GestureHandlerRootView>
  )
}
