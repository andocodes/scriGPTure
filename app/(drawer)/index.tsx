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

  const onVideoLoad = () => {
    setVideoLoaded(true)
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }

  return (
    <>
      <Stack.Screen options={{ 
        headerTitle: "",
        headerTransparent: true,
        headerShadowVisible: false,
      }} />
      <Container style={styles.container} fullBleed>
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
              clearMessages()
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
    padding: 0,
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1,
    paddingBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#fff',
  },
  highlightText: {
    color: '#ff3b30',
  },
  subtitle: {
    fontSize: 18,
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 32,
  },
});
