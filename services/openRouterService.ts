import { create } from 'zustand';

/**
 * Types for OpenRouter API interactions
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Updated types based on OpenRouter documentation
export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
    native_finish_reason: string | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Gets a chat completion from OpenRouter and simulates streaming on client side
 */
export async function getChatCompletionStream(
  messages: OpenRouterMessage[],
  apiKey: string,
  signal?: AbortSignal,
  onChunk?: (content: string) => void,
  onFullResponse?: (fullContent: string) => void
): Promise<ReadableStream<Uint8Array> | null> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  // Using deepseek model as confirmed in OpenRouter logs
  const model = 'deepseek/deepseek-chat-v3-0324:free';

  try {
    console.log('[OpenRouter] Making API request to OpenRouter...');
    
    // For debugging - log the first few characters of the API key
    if (apiKey.length > 8) {
      console.log(`[OpenRouter] Using API key starting with: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    }
    
    // CHANGED: Request as non-streaming to avoid React Native streaming issues
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://scrigpture.org',
        'X-Title': 'ScriGPTure Bible App',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false, // CHANGED: Using non-streaming mode
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal,
    });

    console.log(`[OpenRouter] Response status: ${response.status}`);
    
    // Diagnostic information about the response object
    console.log('[OpenRouter] Response headers:', JSON.stringify(Object.fromEntries([...response.headers])));
    console.log('[OpenRouter] Response type:', response.type);
    console.log('[OpenRouter] Response properties:', 
      JSON.stringify({
        ok: response.ok,
        redirected: response.redirected,
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        url: response.url,
        bodyUsed: response.bodyUsed,
        hasBody: !!response.body
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    // CHANGED: Parse the JSON response instead of trying to read the stream
    let responseData: OpenRouterResponse;
    try {
      const jsonResponse = await response.json();
      console.log('[OpenRouter] Received JSON response:', JSON.stringify(jsonResponse).substring(0, 200) + '...');
      responseData = jsonResponse;
    } catch (error) {
      console.error('[OpenRouter] Error parsing response JSON:', error);
      throw new Error('Failed to parse API response');
    }

    // Get the content from the response
    const content = responseData.choices[0]?.message?.content || '';
    if (!content) {
      throw new Error('No content received from API');
    }

    console.log(`[OpenRouter] Complete response received, length: ${content.length} chars`);
    
    // Call the full response handler immediately if provided
    if (onFullResponse) {
      try {
        onFullResponse(content);
      } catch (error) {
        console.error('[OpenRouter] Error in full response handler:', error);
      }
    }
    
    // Create an artificial stream by chunking the response
    return createArtificialStream(content, onChunk);
  } catch (error) {
    console.error('Error in getChatCompletionStream:', error);
    throw error;
  }
}

/**
 * Creates an artificial stream from a complete text by chunking it
 */
function createArtificialStream(
  completeText: string, 
  onChunk?: (content: string) => void
): ReadableStream<Uint8Array> {
  // Chunk the text into smaller pieces (10-20 chars per chunk)
  const chunkSize = Math.floor(Math.random() * 10) + 10; // Random size between 10-20
  const chunks: string[] = [];
  
  for (let i = 0; i < completeText.length; i += chunkSize) {
    chunks.push(completeText.slice(i, i + chunkSize));
  }
  
  console.log(`[OpenRouter] Created ${chunks.length} artificial chunks`);
  
  return new ReadableStream({
    async start(controller) {
      try {
        // Add slight delays between chunks to simulate streaming
        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
          
          if (onChunk) {
            onChunk(chunk);
          }
          
          // Convert string to Uint8Array
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(chunk));
        }
        
        controller.close();
      } catch (e) {
        console.error('[OpenRouter] Error in artificial stream:', e);
        controller.error(e);
      }
    }
  });
}

/**
 * Gets a complete chat completion from OpenRouter without streaming
 * This is useful when you need the entire response at once
 */
export async function getChatCompletion(
  messages: OpenRouterMessage[],
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  // Using deepseek model as confirmed in OpenRouter logs
  const model = 'deepseek/deepseek-chat-v3-0324:free';

  try {
    console.log('[OpenRouter] Making API request for complete response...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://scrigpture.org',
        'X-Title': 'ScriGPTure Bible App',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    // Parse the JSON response
    let responseData: OpenRouterResponse;
    try {
      responseData = await response.json();
    } catch (error) {
      console.error('[OpenRouter] Error parsing response JSON:', error);
      throw new Error('Failed to parse API response');
    }

    // Get the content from the response
    const content = responseData.choices[0]?.message?.content || '';
    if (!content) {
      throw new Error('No content received from API');
    }

    console.log(`[OpenRouter] Complete response received, length: ${content.length} chars`);
    
    return content;
  } catch (error) {
    console.error('Error in getChatCompletion:', error);
    throw error;
  }
} 