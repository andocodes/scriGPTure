import React from "react"
import { SafeAreaView, View, StyleProp, ViewStyle } from "react-native"

export const Container = ({ 
  children,
  style,
  fullBleed = false
}: { 
  children: React.ReactNode,
  style?: StyleProp<ViewStyle>,
  fullBleed?: boolean
}) => {
  if (fullBleed) {
    return (
      <View style={[{ flex: 1 }, style]}>
        {children}
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-4" style={style}>{children}</View>
    </SafeAreaView>
  )
}
