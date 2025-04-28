import { SafeAreaView, View } from "react-native"

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-4">{children}</View>
    </SafeAreaView>
  )
}
