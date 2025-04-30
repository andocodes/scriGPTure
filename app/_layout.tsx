import "../global.css"
import { useEffect } from "react";
import { Stack } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { MessagesProvider } from "~/hooks/useMessages"
import { saveApiKeys, API_KEYS } from "~/utils/apiKeyManager"
import { useAppStore } from "~/store/store";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(drawer)",
}

// API Keys - REMOVE/REPLACE with a secure method before production
const OPENROUTER_API_KEY = "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";

export default function RootLayout() {
  // Effect to save API keys and initialize store
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Initialize the Zustand store (loads keys into state, etc.)
      console.log("Initializing app state...");
      try {
        // First try to initialize store which will load any existing keys
        await useAppStore.getState().initializeStore(); 
        console.log("App state initialized.");
        
        // Check if OpenRouter key exists, save if not
        const openRouterKey = useAppStore.getState().openRouterApiKey;
        if (!openRouterKey) {
          console.log("OpenRouter API key not found, saving default...");
          await saveApiKeys({
            OPENROUTER: OPENROUTER_API_KEY
          });
          // Reload keys into store
          await useAppStore.getState().loadApiKeys();
        }
      } catch (error) {
          console.error("CRITICAL: Failed to initialize app state:", error);
      }

      // TODO: Add any other essential async setup here
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
