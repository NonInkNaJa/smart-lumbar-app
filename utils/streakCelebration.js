import AsyncStorage from '@react-native-async-storage/async-storage';

// ฉลอง (confetti) เมื่อ streak เพิ่มขึ้นเป็นวันใหม่ — ไม่ยิงทุกครั้งที่เปิดแอป
// จำ 2 อย่างไว้ในเครื่อง: streak ล่าสุดที่เห็น (baseline) และวันที่ (dateKey) ที่ฉลองไปแล้วล่าสุด
const CELEBRATION_KEY = 'streak-celebration';

// ตัดสินใจว่าควรฉลองหรือไม่ (ฟังก์ชันล้วน ทดสอบง่าย)
// - saved = null (เปิดครั้งแรก): แค่จำ streak ปัจจุบันเป็น baseline ไม่ฉลอง (กันยิงตอนอัปเดตแอปทั้งที่ streak เดิมมีอยู่แล้ว)
// - ฉลองเมื่อ streak มากกว่า baseline "และ" วันนี้ยังไม่เคยฉลอง (กัน streak แกว่งขึ้นลงในวันเดียวแล้วยิงซ้ำ)
// - baseline ตาม streak ปัจจุบันเสมอ (streak ขาด -> baseline ลดลง -> เริ่มนับใหม่แล้วฉลองวันแรกได้อีก)
export function decideCelebration(streak, saved, todayKey) {
  const current = Number.isInteger(streak) && streak >= 0 ? streak : 0;
  if (!saved) return { celebrate: false, next: { streak: current, celebratedOn: null } };
  const celebrate = current > saved.streak && saved.celebratedOn !== todayKey;
  return { celebrate, next: { streak: current, celebratedOn: celebrate ? todayKey : saved.celebratedOn } };
}

// อ่านข้อมูลที่เก็บไว้: ข้อมูลเสีย/รูปแบบผิด = ถือว่าไม่มี (เหมือนเปิดครั้งแรก)
export function sanitizeCelebrationState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Number.isInteger(raw.streak) || raw.streak < 0) return null;
  return { streak: raw.streak, celebratedOn: typeof raw.celebratedOn === 'string' ? raw.celebratedOn : null };
}

export async function loadCelebrationState() {
  try {
    const raw = await AsyncStorage.getItem(CELEBRATION_KEY);
    return sanitizeCelebrationState(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return null;
  }
}

export async function saveCelebrationState(state) {
  try {
    await AsyncStorage.setItem(CELEBRATION_KEY, JSON.stringify(state));
  } catch (e) {
    console.log('บันทึกสถานะการฉลอง streak ไม่สำเร็จ', e);
  }
}
