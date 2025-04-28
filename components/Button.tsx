import { forwardRef } from "react"
import { Text, TouchableOpacity, TouchableOpacityProps } from "react-native"

type ButtonProps = {
  title: string
} & TouchableOpacityProps

// @ts-ignore
export const Button = forwardRef<TouchableOpacity, ButtonProps>(
  ({ title, ...touchableProps }, ref) => {
    return (
      <TouchableOpacity
        ref={ref}
        {...touchableProps}
        className={`${styles.button} ${touchableProps.className}`}
      >
        <Text className={styles.buttonText}>{title}</Text>
      </TouchableOpacity>
    )
  }
)

const styles = {
  button: "items-center bg-red-500 rounded-sm shadow-md p-4",
  buttonText: "text-red text-white text-lg font-semibold text-center",
}
