import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { MEAL_TYPES } from '@nutrition/core'

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch (_e) {
  // expo-notifications remote push not supported in Expo Go on SDK 53+
}

const REMINDER_IDS_KEY = 'meal_reminder_ids'

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('ogun-hatirlatma', {
          name: 'Öğün Hatırlatmaları',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        })
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      if (existingStatus === 'granted') return true
      const { status } = await Notifications.requestPermissionsAsync()
      return status === 'granted'
    } catch (_e) {
      return false
    }
  },

  async scheduleAllMealReminders(mealCount: number = 3): Promise<void> {
    try {
      await this.cancelAllMealReminders()
      const granted = await this.requestPermission()
      if (!granted) return
      const mealTypes = Object.values(MEAL_TYPES)
      const selectedMeals = mealTypes.slice(0, mealCount)
      for (const meal of selectedMeals) {
        const [hour, minute] = meal.time.split(':').map(Number)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🍽️ ${meal.name} Zamanı!`,
            body: `Günlük kalori hedefine ulaşmak için ${meal.name.toLowerCase()} öğününü eklemeyi unutma.`,
            data: { mealType: meal.name },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
        })
      }
    } catch (_e) {
      // silently ignore notification scheduling errors in Expo Go
    }
  },

  async cancelAllMealReminders(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
    } catch (_e) {}
  },

  async getScheduledCount(): Promise<number> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync()
      return scheduled.length
    } catch (_e) {
      return 0
    }
  },

  async sendTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Bildirimler Aktif!',
          body: 'Öğün hatırlatmaların başarıyla ayarlandı.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
      })
    } catch (_e) {}
  },
}
