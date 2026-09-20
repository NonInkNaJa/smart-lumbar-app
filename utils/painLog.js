import AsyncStorage from '@react-native-async-storage/async-storage';

// บันทึกอาการปวดแบบ body map: เก็บแยกจาก self-report แบบอิโมจิเดิม (ไม่แตะของเดิม) รายวันตามวันที่จริง
// รูปแบบ: { "2026-09-20": ["neck", "lower_back"], "2026-09-21": [] }
//   - รายการ = จุดที่ปวดของวันนั้น
//   - [] (อาร์เรย์ว่าง) = ผู้ใช้กดบันทึกว่า "วันนี้ไม่มีอาการปวด" (ต่างจากไม่มีรายการของวันนั้นเลย = ยังไม่ได้บันทึก)
const PAIN_LOG_KEY = 'pain-log';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// จุดที่เลือกได้ (เรียงจากบนลงล่าง) — key ใช้เก็บ, label ใช้แสดง
export const PAIN_REGIONS = [
  { key: 'neck', label: 'คอ' },
  { key: 'shoulders', label: 'บ่า' },
  { key: 'upper_back', label: 'หลังบน' },
  { key: 'lower_back', label: 'หลังล่าง' },
  { key: 'hips', label: 'สะโพก' },
];
const REGION_ORDER = PAIN_REGIONS.map((r) => r.key);
const isRegion = (k) => REGION_ORDER.includes(k);

export function regionLabel(key) {
  const r = PAIN_REGIONS.find((x) => x.key === key);
  return r ? r.label : '';
}

// กรองข้อมูลที่อ่านมา: เก็บเฉพาะวันที่ถูกรูปแบบ + จุดที่รู้จัก (ไม่ซ้ำ เรียงตามลำดับกายวิภาค); ข้อมูลเสียถูกทิ้ง
export function sanitizePainLog(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach((k) => {
    if (!DATE_KEY_RE.test(k) || !Array.isArray(raw[k])) return;
    out[k] = REGION_ORDER.filter((r) => raw[k].includes(r));
  });
  return out;
}

// จุดที่ปวดของวันนั้น: อาร์เรย์ ([] = บันทึกว่าไม่ปวด) หรือ null = ยังไม่ได้บันทึกอะไร
export function regionsOf(log, dateKey) {
  return Array.isArray(log[dateKey]) ? log[dateKey] : null;
}

// แตะจุด: มีอยู่แล้วเอาออก ไม่มีก็เพิ่ม (จุดที่ไม่รู้จักไม่ทำอะไร); ไม่แก้ log เดิม
export function toggleRegion(log, dateKey, region) {
  if (!isRegion(region)) return log;
  const current = regionsOf(log, dateKey) || [];
  const next = current.includes(region) ? current.filter((r) => r !== region) : REGION_ORDER.filter((r) => r === region || current.includes(r));
  return { ...log, [dateKey]: next };
}

// "วันนี้ไม่มีอาการปวด": บันทึกอาร์เรย์ว่าง (ล้างจุดที่เลือกไว้ทั้งหมดของวันนั้น)
export function setNoPain(log, dateKey) {
  return { ...log, [dateKey]: [] };
}

export async function loadPainLog() {
  try {
    const raw = await AsyncStorage.getItem(PAIN_LOG_KEY);
    return sanitizePainLog(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return {};
  }
}

export async function savePainLog(log) {
  try {
    await AsyncStorage.setItem(PAIN_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.log('บันทึกอาการปวดไม่สำเร็จ', e);
  }
}
