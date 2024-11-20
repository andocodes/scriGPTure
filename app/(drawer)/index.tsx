import { Stack } from "expo-router"

import { Container } from "~/components/Container"
import { ScreenContent } from "~/components/ScreenContent"

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Home" }} />
      <Container>
        <ScreenContent path="app/(drawer)/index.tsx" title="Home" />
      </Container>
    </>
  )
}
