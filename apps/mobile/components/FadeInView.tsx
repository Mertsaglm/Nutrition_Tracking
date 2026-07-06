import { useEffect } from 'react'
import { ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'

type Props = {
  children: React.ReactNode
  delay?: number
  duration?: number
  style?: ViewStyle
  slideUp?: boolean
}

export function FadeInView({ children, delay = 0, duration = 400, style, slideUp = false }: Props) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(slideUp ? 20 : 0)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }))
    if (slideUp) {
      translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.quad) }))
    }
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  )
}
