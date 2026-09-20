import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android: ป๊อปอัพแบบ heads-up ต้องใช้ channel ที่ importance = HIGH
// vibrationPattern [รอ, สั่น, หยุด, สั่น, หยุด, สั่น] (มิลลิวินาที) = สั่น-หยุด-สั่น 3 รอบ รวม ~1.2 วินาที (เดิมสั่นสั้นครั้งเดียวจนพลาดง่าย)
// เสียง: ใช้เสียงแจ้งเตือนมาตรฐานของระบบ (ไม่ต้องมีไฟล์เสียงเอง) ตามระดับเสียง "แจ้งเตือน" ของเครื่อง
// หมายเหตุ: Android ล็อกการตั้งค่า channel หลังสร้างครั้งแรก ถ้าจะเปลี่ยนเสียง/การสั่น ต้องเปลี่ยน CHANNEL_ID ใหม่
//   v1 = ป๊อปอัพ + สั่น, v2 = เพิ่มเสียงแจ้งเตือนของระบบอย่างชัดเจน, v3 = สั่นเป็นจังหวะ 3 รอบ (v1/v2 ถูกลบทิ้งตอนเปิดแอป)
export const CHANNEL_ID = 'posture-alerts-v3';
const OLD_CHANNEL_IDS = ['posture-alerts-v1', 'posture-alerts-v2'];
export const VIBRATION_PATTERN = [0, 300, 150, 300, 150, 300];
// แจ้งเตือนสายเข็มขัดหลุด: channel แยก (ความสำคัญปกติ = มีเสียง ไม่เด้งป๊อปอัพ ไม่สั่นแรงเหมือนเตือนท่านั่ง)
export const LINK_CHANNEL_ID = 'belt-link-v1';

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
        vibrationPattern: VIBRATION_PATTERN,
        // เสียง: ห้ามใส่ sound: 'default' เด็ดขาด — ฝั่ง native ตีความค่า sound ที่เป็นข้อความว่าเป็น "ชื่อไฟล์เสียง"
        // จึงหาไฟล์ชื่อ default ไม่เจอและกลายเป็นไม่มีเสียง; การ "ไม่ส่ง key sound" ต่างหากคือ "ใช้เสียงแจ้งเตือนเริ่มต้นของระบบ"
        // audioAttributes ระบุให้เป็นเสียงประเภทแจ้งเตือน (ดังตามระดับเสียงแจ้งเตือน ไม่ใช่เสียงสื่อ)
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
      // channel ของแจ้งเตือนสายหลุด (แยก try/catch: สร้างไม่สำเร็จต้องไม่ขวาง channel หลักและการขอสิทธิ์)
      try {
        await Notifications.setNotificationChannelAsync(LINK_CHANNEL_ID, {
          name: 'สถานะการเชื่อมต่อเข็มขัด',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      } catch (e) {
        console.log('สร้าง channel แจ้งเตือนสายหลุดไม่สำเร็จ (ข้ามได้)', e);
      }
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

// คืน id ของแจ้งเตือน (ไว้ลบทีหลัง) หรือ null ถ้าส่งไม่สำเร็จ
async function fire(title, body, channelId = CHANNEL_ID) {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default', // เสียงแจ้งเตือนมาตรฐานของระบบ (Android 8+ ใช้ค่าจาก channel; Android รุ่นเก่าใช้ค่านี้)
        priority: Notifications.AndroidNotificationPriority.HIGH, // Android รุ่นเก่าที่ไม่มี channel: ให้เด้งป๊อปอัพ
      },
      trigger: { channelId }, // ส่งทันที ผ่าน channel ที่ตั้งให้สั่นเป็นจังหวะ มีเสียง และเด้งป๊อปอัพ
    });
  } catch (e) {
    console.log('ส่งแจ้งเตือนไม่สำเร็จ', e);
    return null;
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

// สายเข็มขัดหลุดเอง (ตอนอยู่เบื้องหลัง ผู้ใช้จะได้รู้ ไม่หลุดเงียบๆ) / ต่อใหม่ไม่ได้
export const BELT_LOST_MESSAGE = 'เข็มขัดหลุดการเชื่อมต่อ กำลังลองต่อใหม่ให้อัตโนมัติ';
export const BELT_GAVE_UP_MESSAGE = 'ต่อเข็มขัดใหม่ไม่ได้ เปิดแอปแล้วกดเชื่อมต่ออีกครั้งน้า';

export function notifyBeltLost() {
  return fire('เข็มขัดหลุดการเชื่อมต่อ', BELT_LOST_MESSAGE, LINK_CHANNEL_ID);
}

export function notifyBeltGaveUp() {
  return fire('ต่อเข็มขัดไม่ได้', BELT_GAVE_UP_MESSAGE, LINK_CHANNEL_ID);
}

// ลบแจ้งเตือนที่เคยส่ง (เช่น ต่อกลับได้แล้ว ไม่ต้องให้ค้างว่าหลุด) ไม่โยน error
export async function dismissNotification(id) {
  if (!id) return;
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch (e) {
    console.log('ลบแจ้งเตือนไม่สำเร็จ (ข้ามได้)', e);
  }
}
