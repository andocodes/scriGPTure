import { Tabs } from "expo-router"
import { useColorScheme } from "react-native"
import { TabBarIcon } from "~/components/TabBarIcon"

export default function ChatScreenLayout() {
  useColorScheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "red",
        tabBarStyle: {
          backgroundColor: "#1a1a1a",
          borderTopColor: "#333",
        },
        tabBarInactiveTintColor: "#666",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <TabBarIcon name="chatbubbles-sharp" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <TabBarIcon name="time-sharp" color={color} />,
        }}
      />
      <Tabs.Screen
        name="[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}
