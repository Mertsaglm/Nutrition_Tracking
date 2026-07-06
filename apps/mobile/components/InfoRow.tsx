import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '@nutrition/tokens'

type Props = {
  icon: string
  label: string
  value: string
}

export function InfoRow({ icon, label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border,
  },
  icon: { fontSize: 16, marginRight: 10, width: 24, textAlign: 'center' },
  label: { flex: 1, fontSize: 14, color: THEME.colors.textSecondary },
  value: { fontSize: 14, color: THEME.colors.text, fontWeight: '500' },
})
