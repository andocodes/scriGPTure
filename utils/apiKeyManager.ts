import * as SecureStore from 'expo-secure-store';

const OPENROUTER_KEY_NAME = 'openRouterApiKey';
const APIBIBLE_KEY_NAME = 'apiBibleApiKey';

export async function saveApiKeys(openRouterKey: string, apiBibleKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(OPENROUTER_KEY_NAME, openRouterKey);
    await SecureStore.setItemAsync(APIBIBLE_KEY_NAME, apiBibleKey);
    console.log('API keys saved successfully.');
  } catch (error) {
    console.error('Error saving API keys:', error);
    // Handle error appropriately, maybe re-throw or return a status
    throw error;
  }
}

export async function loadApiKeys(): Promise<{ openRouterKey: string | null; apiBibleKey: string | null }> {
  try {
    const openRouterKey = await SecureStore.getItemAsync(OPENROUTER_KEY_NAME);
    const apiBibleKey = await SecureStore.getItemAsync(APIBIBLE_KEY_NAME);
    console.log(`[apiKeyManager] Loaded API Bible Key: ${apiBibleKey ? '***' + apiBibleKey.slice(-4) : 'null'}`);
    console.log(`[apiKeyManager] Loaded OpenRouter Key: ${openRouterKey ? '***' + openRouterKey.slice(-4) : 'null'}`);
    return { openRouterKey, apiBibleKey };
  } catch (error) {
    console.error('Error loading API keys:', error);
    // Handle error appropriately
    return { openRouterKey: null, apiBibleKey: null };
  }
}

export async function clearApiKeys(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(OPENROUTER_KEY_NAME);
    await SecureStore.deleteItemAsync(APIBIBLE_KEY_NAME);
    console.log('API keys cleared.');
  } catch (error) {
    console.error('Error clearing API keys:', error);
    throw error;
  }
} 