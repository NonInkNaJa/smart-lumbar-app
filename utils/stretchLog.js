import AsyncStorage from '@react-native-async-storage/async-storage';

// จำนวนครั้งที่ผู้ใช้กด "ยืดเส้น/ลุกแล้ว" ตอนโดนเตือนนั่งนาน เก็บรายวัน: { "2026-09-20": 3, ... }
const STRETCH_LOG_KEY = 'stretch-log';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// กรองข้อมูลที่อ่านมา: เก็บเฉพาะ key วันที่ที่ถูกต้อง + จำนวนเต็มบวก (ข้อมูลเสียถูกทิ้ง)
export function sanitizeStretchLog(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach((k) => {
    const v = raw[k];
    if (DATE_KEY_RE.test(k) && Number.isInteger(v) && v > 0) out[k] = v;
  });
  return out;
}

// เพิ่มหนึ่งครั้งในวันนั้น (ไม่แก้ log เดิม)
export function addStretch(log, dateKey) {
  return { ...log, [dateKey]: (log[dateKey] || 0) + 1 };
}

// รวมจำนวนครั้งของวันที่ระบุ (dateKeys อาจมี null ปนได้ เช่น แท่งกราฟที่รวมหลายวัน)
export function countInKeys(log, dateKeys) {
  return (dateKeys || []).reduce((sum, k) => sum + ((k && log[k]) || 0), 0);
}

export async function loadStretchLog() {
  try {
    const raw = await AsyncStorage.getItem(STRETCH_LOG_KEY);
    return sanitizeStretchLog(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return {};
  }
}

export async function saveStretchLog(log) {
  try {
    await AsyncStorage.setItem(STRETCH_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.log('บันทึกจำนวนครั้งที่ลุกยืดเส้นไม่สำเร็จ', e);
  }
}
