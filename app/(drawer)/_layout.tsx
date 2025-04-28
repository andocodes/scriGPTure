import { Ionicons, MaterialIcons } from "@expo/vector-icons"
import { Link } from "expo-router"
import { Drawer } from "expo-router/drawer"

import { HeaderButton } from "~/components/HeaderButton"
import { HeaderNewChatButton } from "~/components/chat/HeaderNewChatButton"

const HomeScreenLayout = () => (
  <Drawer
    screenOptions={{
      headerTintColor: "red", // This changes the burger menu color
      drawerActiveTintColor: "red", // Active item text/icon color
    }}
  >
    <Drawer.Screen
      name="index"
      options={{
        headerTitle: "Home",
        drawerLabel: "Home",
        drawerIcon: ({ size, color }) => <Ionicons name="home-sharp" size={size} color={color} />,
        headerRight: () => <HeaderNewChatButton />,
      }}
    />
    <Drawer.Screen
      name="(chat)"
      options={{
        title: "Chat",
        drawerLabel: "Chat",
        drawerIcon: ({ size, color }) => (
          <Ionicons name="chatbubbles-sharp" size={size} color={color} />
        ),
        headerRight: () => <HeaderNewChatButton />,
      }}
    />
    <Drawer.Screen
      name="(bible)"
      options={{
        headerTitle: "Bible",
        drawerLabel: "Bible",
        drawerIcon: ({ size, color }) => <Ionicons name="book-sharp" size={size} color={color} />,
        headerRight: () => <HeaderNewChatButton />,
      }}
    />
    <Drawer.Screen
      name="settings"
      options={{
        headerTitle: "Settings",
        drawerLabel: "Settings",
        drawerIcon: ({ size, color }) => <Ionicons name="settings-sharp" size={size} color={color} />,
      }}
    />
  </Drawer>
)

export default HomeScreenLayout
