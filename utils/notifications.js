import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android: ป๊อปอัพแบบ heads-up ต้องใช้ channel ที่ importance = HIGH
// vibrationPattern [รอ, สั่น] (มิลลิวินาที) = สั่น 1 ครั้ง
// เสียง: ใช้เสียงแจ้งเตือนมาตรฐานของระบบ (ไม่ต้องมีไฟล์เสียงเอง) ตามระดับเสียง "แจ้งเตือน" ของเครื่อง
// หมายเหตุ: Android ล็อกการตั้งค่า channel หลังสร้างครั้งแรก ถ้าจะเปลี่ยนเสียง/การสั่น ต้องเปลี่ยน CHANNEL_ID ใหม่
//   v1 = ป๊อปอัพ + สั่น, v2 = เพิ่มเสียงแจ้งเตือนของระบบอย่างชัดเจน (v1 ถูกลบทิ้งตอนเปิดแอป)
export const CHANNEL_ID = 'posture-alerts-v2';
const OLD_CHANNEL_IDS = ['posture-alerts-v1'];
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
      // ลบ channel รุ่นเก่า (แยก try/catch: ลบไม่สำเร็จต้องไม่ขวางการสร้าง channel ใหม่และการขอสิทธิ์)
      for (const oldId of OLD_CHANNEL_IDS) {
        try {
          await Notifications.deleteNotificationChannelAsync(oldId);
        } catch (e) {
          console.log('ลบ channel แจ้งเตือนเก่าไม่สำเร็จ (ข้ามได้)', e);
        }
      }
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'แจ้งเตือนท่านั่ง',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: VIBRATE_ONCE,
        // เสียง: ห้ามใส่ sound: 'default' เด็ดขาด — ฝั่ง native ตีความค่า sound ที่เป็นข้อความว่าเป็น "ชื่อไฟล์เสียง"
        // จึงหาไฟล์ชื่อ default ไม่เจอและกลายเป็นไม่มีเสียง; การ "ไม่ส่ง key sound" ต่างหากคือ "ใช้เสียงแจ้งเตือนเริ่มต้นของระบบ"
        // audioAttributes ระบุให้เป็นเสียงประเภทแจ้งเตือน (ดังตามระดับเสียงแจ้งเตือน ไม่ใช่เสียงสื่อ)
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
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
      content: {
        title,
        body,
        sound: 'default', // เสียงแจ้งเตือนมาตรฐานของระบบ (Android 8+ ใช้ค่าจาก channel; Android รุ่นเก่าใช้ค่านี้)
        priority: Notifications.AndroidNotificationPriority.HIGH, // Android รุ่นเก่าที่ไม่มี channel: ให้เด้งป๊อปอัพ
      },
      trigger: { channelId: CHANNEL_ID }, // ส่งทันที ผ่าน channel ที่ตั้งให้สั่นและเด้งป๊อปอัพ
    });
  } catch (e) {
    console.log('ส่งแจ้งเตือนไม่สำเร็จ', e);
  }
}

// ข้อความแจ้งเตือน (เนื้อความเก็บประโยคเต็ม; หัวเรื่องบอกรายละเอียดสั้น ๆ กันประโยคยาวถูกตัดตอนเด้งป๊อปอัพ)
export const BAD_POSTURE_MESSAGE = 'หลังเทพเตือนนะคะ ลองขยับท่านั่งนิดนึงน้า 😊';
export const SITTING_TOO_LONG_MESSAGE = 'นั่งมานานละน้า ลุกยืดเส้นยืดสายกันหน่อยไหม 🙆';

// label = ชนิดท่าไม่ดี เช่น "หลังค่อม" หรือ "เอนหลังไม่ดี (ตูดไม่ชิดเบาะ)"
export function notifyBadPosture(label) {
  return fire(label ? `ท่านั่งไม่ดี: ${label}` : 'ท่านั่งไม่ดี', BAD_POSTURE_MESSAGE);
}

export function notifySittingTooLong() {
  return fire('นั่งนานแล้ว', SITTING_TOO_LONG_MESSAGE);
}
