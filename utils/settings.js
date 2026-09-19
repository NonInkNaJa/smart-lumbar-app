import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SITTING_ALERT_MINUTES, SITTING_ALERT_OPTIONS } from '../config';

// การตั้งค่าของผู้ใช้ เก็บเป็น JSON ก้อนเดียวใน AsyncStorage
const SETTINGS_KEY = 'app-settings';

export const DEFAULT_SETTINGS = {
  sittingAlertMinutes: DEFAULT_SITTING_ALERT_MINUTES, // เตือนนั่งนานที่กี่นาที
  darkMode: false, // โหมดมืด
};

// กรองค่าที่อ่านมา: ค่าที่ไม่ถูกต้อง (ข้อมูลเสีย/ตัวเลือกที่ไม่มีแล้ว) ใช้ค่าเริ่มต้นแทน
export function sanitizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    sittingAlertMinutes: SITTING_ALERT_OPTIONS.includes(s.sittingAlertMinutes)
      ? s.sittingAlertMinutes
      : DEFAULT_SETTINGS.sittingAlertMinutes,
    darkMode: typeof s.darkMode === 'boolean' ? s.darkMode : DEFAULT_SETTINGS.darkMode,
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
