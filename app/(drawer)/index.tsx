import { Stack, useRouter } from "expo-router"
import React, { useRef, useState } from 'react'
import { Text, View, StyleSheet } from "react-native"
import { Video, ResizeMode } from 'expo-av'
import { Button } from "~/components/Button"
import { Container } from "~/components/Container"
import { useMessages } from "~/hooks/useMessages"

export default function HomeScreen() {
  const router = useRouter()
  const { clearMessages } = useMessages()
  const videoRef = useRef<Video | null>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Handle video load success
  const onVideoLoad = () => {
    setVideoLoaded(true)
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }

  return (
    <>
      <Stack.Screen options={{ 
        headerTitle: "", // Remove the Home title from header
        headerTransparent: true,
        headerShadowVisible: false,
      }} />
      <Container style={styles.container} fullBleed>
        {/* Video Background */}
        <View style={styles.videoContainer} pointerEvents="box-none">
          <Video
            ref={videoRef}
            source={require("~/assets/background.mp4")} 
            style={styles.backgroundVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted={true}
            onLoad={onVideoLoad}
          />
          
          {/* Overlay to ensure text is readable */}
          <View style={styles.overlay} />
        </View>

        <View style={styles.contentContainer} pointerEvents="box-none">
          <Text style={styles.title}>
            scri<Text style={styles.highlightText}>GPT</Text>ure
          </Text>

          <Text style={styles.subtitle}>
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

const styles = StyleSheet.create({
  container: {
    padding: 0, // Remove any padding that might affect full screen display
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Reduce z-index to ensure it doesn't block interactions
    overflow: 'hidden', // Prevent video from spilling outside container
  },
  backgroundVideo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // Dark semi-transparent overlay
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1,
    paddingBottom: 50, // Add extra padding at bottom to ensure content isn't too close to edge
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#fff',
  },
  highlightText: {
    color: '#ff3b30', // Red color for GPT
  },
  subtitle: {
    fontSize: 18,
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 32,
  },
});
