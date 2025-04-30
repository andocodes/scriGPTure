# scriGPTure

An AI-powered Bible study companion mobile application that combines Bible reading with AI-assisted study and exploration.

## Features

- **Bible Reader**: Access multiple Bible translations with a clean, easy-to-navigate interface
- **AI Chat**: Ask questions about scripture and receive AI-powered responses through OpenRouter API
- **Verse Context**: Add verse references directly to your chats for better AI responses
- **Favorites**: Save your favorite verses for quick reference
- **Chat History**: Review and continue previous conversations

## Technology Stack

- **Frontend**: React Native with Expo
- **Database**: SQLite (local storage for Bible data and chat history)
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **AI Integration**: OpenRouter API
- **Language**: TypeScript

## Project Structure

- `/app`: Main application screens and navigation
- `/components`: Reusable UI components
- `/hooks`: Custom React hooks, including chat management
- `/services`: API service integrations
- `/db`: Database operations and schema
- `/store`: Zustand store configuration
- `/utils`: Utility functions
- `/config`: Configuration files and constants

## Getting Started

### Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (or physical device for testing)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/scripture.git
   cd scripture
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Configure API keys:
   - Create an account at [OpenRouter](https://openrouter.ai/) to obtain an API key
   - Update the API key in the app (see `app/_layout.tsx`) or use the settings screen

4. Start the development server:
   ```
   npx expo start
   ```

5. Run on your device or emulator:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan the QR code with the Expo Go app on your physical device

## Usage

- **Home Screen**: Start a new chat or access other features
- **Bible Screen**: Read Bible passages and add them to your chat context
- **Chat Screen**: Ask questions about scripture and receive AI-powered responses
- **Favorites Screen**: View and manage your saved verses
- **Settings Screen**: Configure app settings and API keys

## Offline Support

The app downloads Bible translations locally to enable offline reading. The chat functionality requires an internet connection to communicate with the AI service.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Bible translations provided through local SQLite databases
- AI responses powered by OpenRouter API 
