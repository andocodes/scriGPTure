import { Stack, useRouter } from "expo-router"
import React, { useRef, useState } from 'react'
import { Text, View, StyleSheet, Dimensions } from "react-native"
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
      <Stack.Screen options={{ title: "Home" }} />
      <Container>
        {/* Video Background */}
        <View style={styles.videoContainer}>
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

        <View style={styles.contentContainer}>
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

const { width, height } = Dimensions.get('window')

const styles = StyleSheet.create({
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundVideo: {
    width: width,
    height: height,
    position: 'absolute',
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
