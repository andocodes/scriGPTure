import { Stack, useRouter } from "expo-router"

import { Image, Text, View } from "react-native"
import { Button } from "~/components/Button"
import { Container } from "~/components/Container"
import { useMessages } from "~/hooks/useMessages"

export default function HomeScreen() {
  const router = useRouter()
  const { clearMessages } = useMessages()
  return (
    <>
      <Stack.Screen options={{ title: "Home" }} />
      <Container>
        <View className="flex-1 items-center justify-center p-6">
          <Image
            source={require("~/assets/icon.png")}
            className="w-32 h-32 mb-8"
            style={{ width: "100%", height: 100 }}
            resizeMode="cover"
          />

          <Text className="text-3xl font-bold text-center mb-4">scriGPTure</Text>

          <Text className="text-gray-600 text-center mb-8 text-lg">
            Your AI-powered Bible study companion
          </Text>

          <Button
            title="Get started"
            onPress={() => {
              clearMessages() // Clear messages before navigating to new chat
              router.push("/(drawer)/(chat)/")
            }}
          />
        </View>
      </Container>
    </>
  )
}
