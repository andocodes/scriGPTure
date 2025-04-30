import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function SettingsLayout() {
  const router = useRouter();
  
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
          headerTitle: "Settings",
        }}
      />
      <Stack.Screen 
        name="reading" 
        options={{ 
          headerTitle: "Reading Preferences",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#f44336" />
            </TouchableOpacity>
          )
        }}
      />
      <Stack.Screen 
        name="translations" 
        options={{ 
          headerTitle: "Translations",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => {
                // Simplified navigation - just go back
                router.back();
              }}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#f44336" />
            </TouchableOpacity>
          )
        }}
      />
    </Stack>
  );
} 