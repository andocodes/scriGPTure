import { Ionicons, MaterialIcons } from "@expo/vector-icons"
import { Link } from "expo-router"
import { Drawer } from "expo-router/drawer"
import React from 'react';

import { HeaderButton } from "~/components/HeaderButton"
import { HeaderNewChatButton } from "~/components/chat/HeaderNewChatButton"

const HomeScreenLayout = () => (
  <Drawer
    screenOptions={{
      drawerActiveTintColor: "red", // Active item text/icon color
      headerTitleStyle: {
        color: "black" // Header title color
      },
      headerTintColor: "red", // Make ALL burger menu icons red across the app
      drawerActiveBackgroundColor: "#f8e8e8" // Light red background for active item
    }}
  >
    <Drawer.Screen
      name="index"
      options={{
        headerTitle: "Home",
        drawerLabel: "Home",
        drawerIcon: ({ size, color }) => <Ionicons name="home-sharp" size={size} color={color} />,
        // Remove the headerRight button
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
      name="(favourites)"
      options={{
        headerTitle: "Favourites",
        drawerLabel: "Favourites",
        drawerIcon: ({ size, color }) => <MaterialIcons name="favorite" size={size} color={color} />,
        headerShown: false, // Hide the drawer header for favourites
      }}
    />
    <Drawer.Screen
      name="(settings)"
      options={{
        headerTitle: "Settings",
        drawerLabel: "Settings",
        drawerIcon: ({ size, color }) => <Ionicons name="settings-sharp" size={size} color={color} />,
        headerShown: false // Hide the drawer header for settings
      }}
    />
  </Drawer>
)

export default HomeScreenLayout
