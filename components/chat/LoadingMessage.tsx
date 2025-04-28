import { View } from "react-native"

export function LoadingMessage() {
  return (
    <View className="flex-row justify-start mb-2">
      <View className="px-4 py-2 bg-gray-100 rounded-2xl">
        <View className="flex-row items-center">
          <View className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-bounce" />
          <View className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-bounce delay-100" />
          <View className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
        </View>
      </View>
    </View>
  )
}
