import Ionicons from "@expo/vector-icons/Ionicons"
import { StyleSheet } from "react-native"

export const TabBarIcon = (props: {
  name: React.ComponentProps<typeof Ionicons>["name"]
  color: string
}) => {
  return <Ionicons size={18} style={styles.tabBarIcon} {...props} />
}

export const styles = StyleSheet.create({
  tabBarIcon: {
    marginBottom: -3,
  },
})
