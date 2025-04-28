import { FlashList } from "@shopify/flash-list"
import { Text, View } from "react-native"
import { Button } from "~/components/Button"
import { Container } from "~/components/Container"

const FAVORITE_VERSES = [
  {
    id: "1",
    reference: "John 3:16",
    text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
  },
  {
    id: "2",
    reference: "Philippians 4:13",
    text: "I can do all things through Christ who strengthens me.",
  },
  {
    id: "3",
    reference: "Psalm 23:1",
    text: "The Lord is my shepherd; I shall not want.",
  },
]

export default function FavoritesScreen() {
  return (
    <Container>
      <FlashList
        data={FAVORITE_VERSES}
        estimatedItemSize={150}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="p-4 bg-white rounded-lg mb-2 shadow-sm">
            <Text className="text-lg font-semibold mb-2">{item.reference}</Text>
            <Text className="text-gray-600 mb-3">{item.text}</Text>
            <Button
              title="Remove from Favorites"
              className="bg-red-500 text-white"
              onPress={() => {
                // Handle removing from favorites
              }}
            />
          </View>
        )}
      />
    </Container>
  )
}
