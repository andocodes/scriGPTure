import * as SecureStore from 'expo-secure-store';

// Define key names as constants for reference
export const API_KEYS = {
  OPENROUTER: 'openRouterApiKey',
};

// Define types for better type safety
export type ApiKeyName = keyof typeof API_KEYS;
export type ApiKeys = Partial<Record<ApiKeyName, string>>;

/**
 * Saves API keys to secure storage
 * @param keys - Object containing API keys to save, with keys matching ApiKeyName
 */
export async function saveApiKeys(keys: ApiKeys): Promise<void> {
  try {
    const savePromises = Object.entries(keys).map(async ([keyName, value]) => {
      if (keyName in API_KEYS && value) {
        const storageKey = API_KEYS[keyName as ApiKeyName];
        await SecureStore.setItemAsync(storageKey, value);
        console.log(`[apiKeyManager] Saved API key: ${keyName}`);
      }
    });
    
    await Promise.all(savePromises);
    console.log('[apiKeyManager] All API keys saved successfully.');
  } catch (error) {
    console.error('[apiKeyManager] Error saving API keys:', error);
    throw error;
  }
}

/**
 * Loads all API keys from secure storage
 * @returns Object containing loaded API keys
 */
export async function loadApiKeys(): Promise<ApiKeys> {
  try {
    const result: ApiKeys = {};
    
    const loadPromises = Object.entries(API_KEYS).map(async ([keyName, storageKey]) => {
      const value = await SecureStore.getItemAsync(storageKey);
      if (value) {
        result[keyName as ApiKeyName] = value;
        console.log(`[apiKeyManager] Loaded ${keyName} key: ***${value.slice(-4)}`);
      }
    });
    
    await Promise.all(loadPromises);
    return result;
  } catch (error) {
    console.error('[apiKeyManager] Error loading API keys:', error);
    return {};
  }
}

/**
 * Clears all API keys from secure storage
 */
export async function clearApiKeys(): Promise<void> {
  try {
    const clearPromises = Object.values(API_KEYS).map(storageKey => 
      SecureStore.deleteItemAsync(storageKey)
    );
    
    await Promise.all(clearPromises);
    console.log('[apiKeyManager] All API keys cleared.');
  } catch (error) {
    console.error('[apiKeyManager] Error clearing API keys:', error);
    throw error;
  }
} 