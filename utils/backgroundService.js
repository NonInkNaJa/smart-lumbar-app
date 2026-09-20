import { Platform } from 'react-native';
import BeltServiceNative from '../modules/belt-service';
import { BACKGROUND_SERVICE_TITLE, BACKGROUND_SERVICE_TEXT } from '../config';

// ตัวห่อ foreground service ฝั่ง JS: "ไม่โยน error เด็ดขาด" ไม่ว่าจะเกิดอะไรขึ้น (ไม่มีโมดูล, ระบบไม่อนุญาต, สิทธิ์ไม่พอ)
// คืนผลเป็น object { ok, ... } ให้ผู้เรียกดูเอง แอปหลักจึงทำงานเหมือนเดิมเสมอ ถ้า service ขึ้นไม่ได้ก็แค่ไม่ได้รับการคุ้มครองตอนอยู่เบื้องหลัง
// native = ตัวโมดูลที่ส่งเข้ามา (ให้ทดสอบด้วยตัวจำลองได้); platform = ระบบปฏิบัติการ

const errorInfo = (e) => ({ code: String((e && e.code) || (e && e.name) || 'UNKNOWN'), message: String((e && e.message) || e || 'ไม่ทราบสาเหตุ') });

// รองรับเฉพาะ Android ที่มีโมดูลอยู่ในแอป
export function isBackgroundServiceAvailable(native = BeltServiceNative, platform = Platform.OS) {
  return platform === 'android' && !!native && typeof native.start === 'function';
}

export async function startBackgroundService({ title = BACKGROUND_SERVICE_TITLE, text = BACKGROUND_SERVICE_TEXT } = {}, native = BeltServiceNative, platform = Platform.OS) {
  if (!isBackgroundServiceAvailable(native, platform)) return { ok: false, reason: 'unavailable' };
  try {
    await native.start(String(title), String(text));
    return { ok: true };
  } catch (e) {
    const info = errorInfo(e);
    console.warn('[BG] start failed', info.code, info.message);
    return { ok: false, reason: 'error', ...info };
  }
}

export async function stopBackgroundService(native = BeltServiceNative, platform = Platform.OS) {
  if (!isBackgroundServiceAvailable(native, platform)) return { ok: false, reason: 'unavailable' };
  try {
    await native.stop();
    return { ok: true };
  } catch (e) {
    const info = errorInfo(e);
    console.warn('[BG] stop failed', info.code, info.message);
    return { ok: false, reason: 'error', ...info };
  }
}

// service ขึ้นจริงไหม (startForeground สำเร็จแล้ว) — false เสมอถ้าไม่มีโมดูล/เรียกไม่สำเร็จ
export function isBackgroundServiceRunning(native = BeltServiceNative, platform = Platform.OS) {
  if (!isBackgroundServiceAvailable(native, platform) || typeof native.isRunning !== 'function') return false;
  try {
    return native.isRunning() === true;
  } catch (e) {
    return false;
  }
}

// เปิดหน้าตั้งค่าการประหยัดแบตเตอรี่ของเครื่อง (ให้ผู้ใช้เลือกไม่จำกัดแบตให้แอปนี้)
export async function openBatterySettings(native = BeltServiceNative, platform = Platform.OS) {
  if (platform !== 'android' || !native || typeof native.openBatterySettings !== 'function') return { ok: false, reason: 'unavailable' };
  try {
    const target = await native.openBatterySettings();
    return { ok: true, target };
  } catch (e) {
    const info = errorInfo(e);
    console.warn('[BG] openBatterySettings failed', info.code, info.message);
    return { ok: false, reason: 'error', ...info };
  }
}
