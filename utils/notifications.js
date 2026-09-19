import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android: ป๊อปอัพแบบ heads-up ต้องใช้ channel ที่ importance = HIGH
// vibrationPattern [รอ, สั่น] (มิลลิวินาที) = สั่น 1 ครั้ง
// หมายเหตุ: Android ล็อกการตั้งค่า channel หลังสร้างครั้งแรก ถ้าจะเปลี่ยนรูปแบบสั่น ต้องเปลี่ยน CHANNEL_ID ใหม่
export const CHANNEL_ID = 'posture-alerts-v1';
const VIBRATE_ONCE = [0, 400];

// ให้แจ้งเตือนเด้งป๊อปอัพแม้เปิดแอปอยู่ (ค่าเริ่มต้นคือไม่แสดงตอนแอปอยู่หน้าจอ)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true, // Android: ถ้าปิดเสียง ป๊อปอัพ heads-up จะไม่เด้ง (ตามเอกสาร expo)
    shouldSetBadge: false,
  }),
});

// เรียกครั้งเดียวตอนเปิดแอป: สร้าง channel แล้วขอสิทธิ์ (Android 13+ ต้องสร้าง channel ก่อนขอสิทธิ์)
export async function setupNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'แจ้งเตือนท่านั่ง',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: VIBRATE_ONCE,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (e) {
    console.log('ตั้งค่าแจ้งเตือนไม่สำเร็จ', e);
    return false;
  }
}

async function fire(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { channelId: CHANNEL_ID }, // ส่งทันที ผ่าน channel ที่ตั้งให้สั่นและเด้งป๊อปอัพ
    });
  } catch (e) {
    console.log('ส่งแจ้งเตือนไม่สำเร็จ', e);
  }
}

// label = ชนิดท่าไม่ดี เช่น "หลังค่อม" หรือ "เอนหลังไม่ดี (ตูดไม่ชิดเบาะ)"
export function notifyBadPosture(label) {
  return fire('ท่านั่งไม่ดี', `${label ? `${label} — ` : ''}ลองปรับท่าหรือยืดเหยียด`);
}

export function notifySittingTooLong() {
  return fire('นั่งนานแล้ว', 'ควรลุกยืนหรือยืดเหยียด');
}
