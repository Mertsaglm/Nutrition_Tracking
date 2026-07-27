import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'
import { selectMealTypes } from '@nutrition/core'

// ============================================================================
// Expo Go (SDK 53+) artık bildirim native modülünü içermiyor; bu ortamda
// `expo-notifications` import edilince modül yükleme anında konsola ERROR basar.
// Bu yüzden modülü YALNIZCA desteklenen ortamlarda (development / production build)
// lazy olarak yüklüyoruz. Expo Go'da tüm servis metotları sessizce no-op çalışır ve
// hiçbir hata basılmaz. Gerçek bir build'de bildirimler normal şekilde çalışır.
// ============================================================================
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

type NotificationsModule = typeof import('expo-notifications')

let Notifications: NotificationsModule | null = null

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications') as NotificationsModule
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
    Notifications = null
  }
}

export const notificationService = {
  /** Bildirimlerin bu ortamda desteklenip desteklenmediği (Expo Go'da `false`). */
  get isSupported(): boolean {
    return Notifications !== null
  },

  async requestPermission(): Promise<boolean> {
    if (!Notifications) return false
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
    if (!Notifications) return
    try {
      await this.cancelAllMealReminders()
      const granted = await this.requestPermission()
      if (!granted) return
      // Hatırlatmalar, kullanıcının beslenme planındaki öğünlerle AYNI olmalı
      // (tek kaynak: @nutrition/core). Önceden ilk N öğün alınıyordu ve 3
      // öğünlük planda Akşam yerine Kuşluk için hatırlatma kuruluyordu.
      const selectedMeals = selectMealTypes(mealCount)
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
      // silently ignore notification scheduling errors
    }
  },

  async cancelAllMealReminders(): Promise<void> {
    if (!Notifications) return
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
    } catch (_e) {}
  },

  async getScheduledCount(): Promise<number> {
    if (!Notifications) return 0
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync()
      return scheduled.length
    } catch (_e) {
      return 0
    }
  },

  async sendTestNotification(): Promise<void> {
    if (!Notifications) return
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
