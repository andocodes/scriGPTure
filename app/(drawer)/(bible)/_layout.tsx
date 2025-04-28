import { Tabs } from "expo-router"
import { TabBarIcon } from "~/components/TabBarIcon"

export default function BibleScreenLayout() {
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
          title: "Bible",
          tabBarIcon: ({ color }) => <TabBarIcon name="book-sharp" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color }) => <TabBarIcon name="heart-sharp" color={color} />,
        }}
      />
    </Tabs>
  )
}
