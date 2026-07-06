import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../lib/constants'

type Props = {
  label: string
  value: number
  unit: string
  color: string
}

export function MacroChip({ label, value, unit, color }: Props) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '15' }]}>
      <Text style={[styles.val, { color }]}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center', borderRadius: 8, padding: 8 },
  val: { fontSize: 14, fontWeight: '700' },
  unit: { fontSize: 10, color: THEME.colors.textMuted },
  label: { fontSize: 10, color: THEME.colors.textSecondary, marginTop: 1 },
})
