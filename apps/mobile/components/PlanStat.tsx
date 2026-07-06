import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../lib/constants'

type Props = {
  value: number
  unit: string
  label: string
  color: string
}

export function PlanStat({ value, unit, label, color }: Props) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '700' },
  unit: { fontSize: 11, color: THEME.colors.textMuted },
  label: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
})
