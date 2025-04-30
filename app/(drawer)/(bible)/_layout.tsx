import React from 'react';
import { Tabs, Stack } from "expo-router"
import { TabBarIcon } from "~/components/TabBarIcon"

// This layout defines the Stack navigator for the (bible) section
export default function BibleStackLayout() {
  return (
    <Stack
      // Set header tint color for the Stack navigator
      screenOptions={{ headerTintColor: 'red' }}
    >
      {/* Define a screen that will render the Tabs layout */}
      {/* Expo Router implicitly knows to use the Tabs config for this route */}
      {/* We might need to define the Tabs layout in a specific file like `tabs.tsx` */}
      {/* or adjust naming if this doesn't work implicitly. */}
      <Stack.Screen name="index" options={{ headerShown: false }}/>
      {/* Favourites is now in the main drawer, not within bible section */}
      <Stack.Screen name="[bookId]" options={{ headerShown: true }} /> 
      <Stack.Screen name="chapter/[chapterId]" options={{ headerShown: true }} /> 
    </Stack>
  );
} 

/* 
  Comment out or remove the old Tabs layout definition for now.
  Expo Router should handle the Tabs presentation based on the Stack definition 
  and the presence of `index.tsx` and `favourites.tsx`.
  The `Stack.Screen` options for `index` and `favourites` hide the Stack header
  for those specific screens, allowing the Tab navigator UI to be the main focus.
  The `[bookId]` and `chapter/[chapterId]` screens will use the Stack navigator's 
  header by default (including the back button).
*/

// const BibleTabsLayout = () => {
//   return (
//     <Tabs
//       screenOptions={{
//         headerShown: false, // Keep this false for Tabs internal header
//         tabBarActiveTintColor: "red",
//         tabBarStyle: {
//           backgroundColor: "#1a1a1a",
//           borderTopColor: "#333",
//         },
//         tabBarInactiveTintColor: "#666",
//       }}
//     >
//       <Tabs.Screen
//         name="index"
//         options={{
//           title: "Bible",
//           tabBarIcon: ({ color }) => <TabBarIcon name="book-sharp" color={color} />,
//         }}
//       />
//       <Tabs.Screen
//         name="favourites"
//         options={{
//           title: "Favourites",
//           tabBarIcon: ({ color }) => <TabBarIcon name="heart-sharp" color={color} />,
//         }}
//       />
//       {/* Add screens for dynamic routes and hide them from the tab bar */}
//       <Tabs.Screen 
//         name="[bookId]" 
//         options={{ href: null }}
//       />
//       <Tabs.Screen 
//         name="chapter/[chapterId]" 
//         options={{ href: null }}
//       />
//     </Tabs>
//   )
// }
