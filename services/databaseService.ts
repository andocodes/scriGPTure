import * as SQLite from 'expo-sqlite';
import { Message } from '~/hooks/useMessages';

// Define the database name
const DATABASE_NAME = 'bible_chat.db';

// Get or create a database connection
const db = SQLite.openDatabase(DATABASE_NAME);

// Initialize the database by creating necessary tables
export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      // Create chats table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT 'New Chat',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
        [],
        () => {
          // Create messages table with foreign key to chats
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY NOT NULL,
              chat_id TEXT NOT NULL,
              content TEXT NOT NULL,
              is_user INTEGER NOT NULL,
              timestamp TEXT NOT NULL,
              context TEXT,
              FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
            )`,
            [],
            () => {
              console.log('[Database] Database initialized successfully');
              resolve();
            },
            (_, error) => {
              console.error('[Database] Error creating messages table:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('[Database] Error creating chats table:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Save a chat with its title and timestamps
export const saveChat = (chatId: string, title: string) => {
  return new Promise<void>((resolve, reject) => {
    const now = Date.now();
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO chats (id, title, created_at, updated_at) 
         VALUES (?, ?, ?, ?)`,
        [chatId, title, now, now],
        (_, result) => {
          console.log(`[Database] Saved/updated chat: ${chatId}`);
          resolve();
        },
        (_, error) => {
          console.error(`[Database] Error saving chat ${chatId}:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Update a chat's title and updated_at timestamp
export const updateChatTitle = (chatId: string, title: string) => {
  return new Promise<void>((resolve, reject) => {
    const now = Date.now();
    
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`,
        [title, now, chatId],
        (_, result) => {
          if (result.rowsAffected > 0) {
            console.log(`[Database] Updated title for chat ${chatId}`);
            resolve();
          } else {
            console.log(`[Database] No chat found with ID ${chatId}`);
            reject(new Error(`No chat found with ID: ${chatId}`));
          }
        },
        (_, error) => {
          console.error(`[Database] Error updating chat title for ${chatId}:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Save a message to the database
export const saveMessage = (message: Message, chatId: string) => {
  return new Promise<void>((resolve, reject) => {
    const contextJSON = message.context ? JSON.stringify(message.context) : null;
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO messages (id, chat_id, content, is_user, timestamp, context)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [message.id, chatId, message.content, message.isUser ? 1 : 0, message.timestamp, contextJSON],
        (_, result) => {
          console.log(`[Database] Saved message ${message.id} for chat ${chatId}`);
          
          // Also update the chat's updated_at timestamp
          tx.executeSql(
            `UPDATE chats SET updated_at = ? WHERE id = ?`,
            [Date.now(), chatId],
            () => resolve(),
            (_, error) => {
              console.error(`[Database] Error updating chat timestamp:`, error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error(`[Database] Error saving message:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Get all messages for a specific chat
export const getChatMessages = (chatId: string) => {
  return new Promise<Message[]>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`,
        [chatId],
        (_, result) => {
          const messages: Message[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            messages.push({
              id: row.id,
              content: row.content,
              isUser: row.is_user === 1,
              timestamp: row.timestamp,
              context: row.context ? JSON.parse(row.context) : undefined
            });
          }
          console.log(`[Database] Retrieved ${messages.length} messages for chat ${chatId}`);
          resolve(messages);
        },
        (_, error) => {
          console.error(`[Database] Error getting messages for chat ${chatId}:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Get a chat's metadata
export const getChatMetadata = (chatId: string) => {
  return new Promise<{ id: string; title: string; createdAt: number; updatedAt: number } | null>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM chats WHERE id = ?`,
        [chatId],
        (_, result) => {
          if (result.rows.length > 0) {
            const chat = result.rows.item(0);
            resolve({
              id: chat.id,
              title: chat.title,
              createdAt: chat.created_at,
              updatedAt: chat.updated_at
            });
          } else {
            resolve(null);
          }
        },
        (_, error) => {
          console.error(`[Database] Error getting chat metadata for ${chatId}:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Get all chats
export const getAllChats = () => {
  return new Promise<Array<{ id: string; title: string; createdAt: number; updatedAt: number }>>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM chats ORDER BY updated_at DESC`,
        [],
        (_, result) => {
          const chats = [];
          for (let i = 0; i < result.rows.length; i++) {
            const chat = result.rows.item(i);
            chats.push({
              id: chat.id,
              title: chat.title,
              createdAt: chat.created_at,
              updatedAt: chat.updated_at
            });
          }
          console.log(`[Database] Retrieved ${chats.length} chats`);
          resolve(chats);
        },
        (_, error) => {
          console.error('[Database] Error getting all chats:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Delete a chat and all its messages
export const deleteChat = (chatId: string) => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      // With CASCADE, this should also delete all messages
      tx.executeSql(
        `DELETE FROM chats WHERE id = ?`,
        [chatId],
        (_, result) => {
          if (result.rowsAffected > 0) {
            console.log(`[Database] Deleted chat ${chatId} and its messages`);
            resolve();
          } else {
            console.log(`[Database] No chat found with ID ${chatId}`);
            reject(new Error(`No chat found with ID: ${chatId}`));
          }
        },
        (_, error) => {
          console.error(`[Database] Error deleting chat ${chatId}:`, error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Get a preview of the first user message in each chat
export const getChatPreviews = () => {
  return new Promise<Array<{ chatId: string; preview: string }>>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT chat_id, content FROM messages WHERE is_user = 1 
         AND id IN (
           SELECT min(id) FROM messages WHERE is_user = 1 GROUP BY chat_id
         )`,
        [],
        (_, result) => {
          const previews = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            previews.push({
              chatId: row.chat_id,
              preview: row.content.length > 40 
                ? `${row.content.substring(0, 40)}...` 
                : row.content
            });
          }
          console.log(`[Database] Retrieved ${previews.length} chat previews`);
          resolve(previews);
        },
        (_, error) => {
          console.error('[Database] Error getting chat previews:', error);
          reject(error);
          return false;
        }
      );
    });
  });
}; 