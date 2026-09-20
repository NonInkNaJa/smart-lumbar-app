import { Platform } from 'react-native';
import BeltWidgetNative from '../modules/belt-widget';
import { toWidgetPayload } from './widgetState';

// ส่งสถานะล่าสุดไปให้วิดเจ็ตหน้าจอหลัก แบบ "ไม่โยน error เด็ดขาด" (ไม่มีโมดูล, ระบบไม่ให้ทำ ฯลฯ = ผลลัพธ์ ok:false)
// วิดเจ็ตเป็นแค่ส่วนแสดงผลเสริม: ล้มเหลวเมื่อไหร่ แอปหลักและ background service ต้องทำงานเหมือนเดิมทุกอย่าง
// สิ่งที่แสดงและการตัดสินใจทั้งหมดอยู่ใน utils/widgetState.js; ที่นี่ส่งเป็นข้อความ JSON ชิ้นเดียวให้ฝั่ง Kotlin
// native/platform/now เป็นพารามิเตอร์ให้ทดสอบด้วยตัวจำลองได้

const errorInfo = (e) => ({ code: String((e && e.code) || (e && e.name) || 'UNKNOWN'), message: String((e && e.message) || e || 'ไม่ทราบสาเหตุ') });

export function isHomeWidgetAvailable(native = BeltWidgetNative, platform = Platform.OS) {
  return platform === 'android' && !!native && typeof native.update === 'function';
}

export async function updateHomeWidget(state, native = BeltWidgetNative, platform = Platform.OS, now = Date.now()) {
  if (!isHomeWidgetAvailable(native, platform)) return { ok: false, reason: 'unavailable' };
  try {
    const widgets = await native.update(JSON.stringify(toWidgetPayload(state, now)));
    return { ok: true, widgets: typeof widgets === 'number' ? widgets : null };
  } catch (e) {
    const info = errorInfo(e);
    console.warn('[WIDGET] update failed', info.code, info.message);
    return { ok: false, reason: 'error', ...info };
  }
}
