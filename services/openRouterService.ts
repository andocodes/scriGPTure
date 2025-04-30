import { create } from 'zustand';

/**
 * Types for OpenRouter API interactions
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason: null | string;
  }[];
}

/**
 * Gets a streaming chat completion from OpenRouter
 */
export async function getChatCompletionStream(
  messages: OpenRouterMessage[],
  apiKey: string,
  signal?: AbortSignal,
  onChunk?: (content: string) => void
): Promise<ReadableStream<Uint8Array> | null> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  // Select a suitable free model - adjust as needed
  const model = 'deepseek/deepseek-chat-v3-0324:free';

  try {
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
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    // Create a readable stream that will be consumed by our callback
    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk
              .split('\n')
              .filter(line => line.trim().startsWith('data:') && line.trim() !== 'data: [DONE]');
            
            for (const line of lines) {
              try {
                const jsonStr = line.replace(/^data: /, '').trim();
                if (!jsonStr) continue;
                
                const data: OpenRouterStreamChunk = JSON.parse(jsonStr);
                const content = data.choices[0]?.delta?.content || '';
                
                if (content && onChunk) {
                  onChunk(content);
                }
                
                controller.enqueue(value);
              } catch (e) {
                console.error('Error parsing stream chunk:', e);
                // Continue with other chunks even if one fails
              }
            }
          }
        } catch (e) {
          controller.error(e);
        }
      }
    });
  } catch (error) {
    console.error('Error in getChatCompletionStream:', error);
    throw error;
  }
} 