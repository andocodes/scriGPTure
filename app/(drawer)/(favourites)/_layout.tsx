import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function FavouritesLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerTintColor: '#f44336', // Use the app's primary color
        headerLeft: () => <DrawerToggleButton tintColor="#f44336" />,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          headerTitle: "Favourites",
        }}
      />
    </Stack>
  );
} 