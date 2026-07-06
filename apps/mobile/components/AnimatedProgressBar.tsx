import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { THEME } from '@nutrition/tokens'

type Props = {
  value: number
  max: number
  color: string
  height?: number
  animated?: boolean
}

export function AnimatedProgressBar({ value, max, color, height = 8, animated = true }: Props) {
  const progress = useSharedValue(0)
  const pct = max > 0 ? Math.min(value / max, 1) : 0

  useEffect(() => {
    if (animated) {
      progress.value = withTiming(pct, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    } else {
      progress.value = pct
    }
  }, [pct])

  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  return (
    <View style={[styles.track, { height, backgroundColor: color + '20', borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, animStyle, { height, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  )
}

type CalorieBarProps = {
  consumed: number
  target: number
}

export function AnimatedCalorieBar({ consumed, target }: CalorieBarProps) {
  const progress = useSharedValue(0)
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const barColor = pct > 1 ? THEME.colors.danger : pct > 0.85 ? THEME.colors.warning : THEME.colors.primary

  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    })
  }, [pct])

  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  return (
    <View style={[styles.track, { height: 8, backgroundColor: THEME.colors.border, borderRadius: 4 }]}>
      <Animated.View style={[styles.fill, animStyle, { height: 8, backgroundColor: barColor, borderRadius: 4 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: {},
})
