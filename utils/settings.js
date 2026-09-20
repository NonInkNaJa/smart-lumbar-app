import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SITTING_ALERT_MINUTES, SITTING_ALERT_MIN_MINUTES, SITTING_ALERT_MAX_MINUTES } from '../config';

// การตั้งค่าของผู้ใช้ เก็บเป็น JSON ก้อนเดียวใน AsyncStorage
const SETTINGS_KEY = 'app-settings';

export const DEFAULT_SETTINGS = {
  sittingAlertMinutes: DEFAULT_SITTING_ALERT_MINUTES, // เตือนนั่งนานที่กี่นาที
  darkMode: false, // โหมดมืด
  backgroundService: true, // ทำงานเบื้องหลัง (foreground service) ตอนเชื่อมต่อเข็มขัด: ปิดจอ/สลับแอปแล้วยังรับข้อมูลและเตือนต่อ
};

// เวลาเตือนนั่งนานที่ใช้ได้: จำนวนเต็มระหว่าง MIN-MAX นาที
export function isValidSittingMinutes(n) {
  return Number.isInteger(n) && n >= SITTING_ALERT_MIN_MINUTES && n <= SITTING_ALERT_MAX_MINUTES;
}

// แปลงข้อความที่ผู้ใช้พิมพ์เป็นนาที: ต้องเป็นตัวเลขล้วน 1-3 หลักและอยู่ในช่วงที่กำหนด ไม่งั้นคืน null
// (ปฏิเสธ ว่าง, ติดลบ, ทศนิยม, ตัวอักษร, เกินช่วง)
export function parseSittingMinutes(text) {
  const s = String(text == null ? '' : text).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return isValidSittingMinutes(n) ? n : null;
}

// กรองค่าที่อ่านมา: ค่าที่ไม่ถูกต้อง (ข้อมูลเสีย/นอกช่วง) ใช้ค่าเริ่มต้นแทน
export function sanitizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    sittingAlertMinutes: isValidSittingMinutes(s.sittingAlertMinutes)
      ? s.sittingAlertMinutes
      : DEFAULT_SETTINGS.sittingAlertMinutes,
    darkMode: typeof s.darkMode === 'boolean' ? s.darkMode : DEFAULT_SETTINGS.darkMode,
    backgroundService: typeof s.backgroundService === 'boolean' ? s.backgroundService : DEFAULT_SETTINGS.backgroundService,
  };
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
  } catch (e) {
    console.log('บันทึกการตั้งค่าไม่สำเร็จ', e);
  }
}
