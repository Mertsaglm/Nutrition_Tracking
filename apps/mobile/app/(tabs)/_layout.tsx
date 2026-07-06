import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '@nutrition/tokens'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Ana Sayfa" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="➕" label="Öğün Ekle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Tarihçe" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="weight"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚖️" label="Kilo" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profil" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: THEME.colors.bgCard,
    borderTopColor: THEME.colors.border,
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabIcon: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabIconFocused: {
    backgroundColor: `${THEME.colors.primary}20`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 10, color: THEME.colors.textMuted, marginTop: 2 },
  tabLabelFocused: { color: THEME.colors.primary },
})
