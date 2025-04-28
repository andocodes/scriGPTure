import React from "react"
import { Text, View } from "react-native"

interface MessageProps {
  content: string
  isUser: boolean
  timestamp?: Date
}

export const Message: React.FC<MessageProps> = ({ content, isUser, timestamp }) => {
  return (
    <View className={`flex-row ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <View
        className={`
          px-4 py-2 rounded-2xl max-w-[80%]
          ${isUser ? "bg-red-500" : "bg-gray-200"}
        `}
      >
        <Text
          className={`
            text-base
            ${isUser ? "text-white" : "text-gray-800"}
          `}
        >
          {content}
        </Text>
        {timestamp && (
          <Text
            className={`
              text-xs mt-1
              ${isUser ? "text-red-100" : "text-gray-500"}
            `}
          >
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>
    </View>
  )
}
