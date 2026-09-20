import { Platform } from 'react-native';
import BeltWidgetNative from '../modules/belt-widget';

// ส่งคะแนน/สถานะเชื่อมต่อล่าสุดไปให้วิดเจ็ตหน้าจอหลัก แบบ "ไม่โยน error เด็ดขาด" (ไม่มีโมดูล, ระบบไม่ให้ทำ ฯลฯ = ผลลัพธ์ ok:false)
// วิดเจ็ตเป็นแค่ส่วนแสดงผลเสริม: ล้มเหลวเมื่อไหร่ แอปหลักและ background service ต้องทำงานเหมือนเดิมทุกอย่าง
// native/platform เป็นพารามิเตอร์ให้ทดสอบด้วยตัวจำลองได้

const errorInfo = (e) => ({ code: String((e && e.code) || (e && e.name) || 'UNKNOWN'), message: String((e && e.message) || e || 'ไม่ทราบสาเหตุ') });

export function isHomeWidgetAvailable(native = BeltWidgetNative, platform = Platform.OS) {
  return platform === 'android' && !!native && typeof native.update === 'function';
}

// แปลงสถานะของแอปเป็นค่าที่ส่งให้วิดเจ็ต:
//  score = คะแนนความพร้อม (0-100) หรือ null (ยังไม่มีข้อมูล); tierLabel/tierColor = ป้ายและสีของระดับ (#RRGGBB); connected = เชื่อมต่อเข็มขัดอยู่
export function toWidgetPayload({ score, tierLabel, tierColor, connected }) {
  const hasScore = typeof score === 'number' && Number.isFinite(score);
  return {
    hasScore,
    score: hasScore ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    tierLabel: typeof tierLabel === 'string' ? tierLabel : '',
    tierColor: typeof tierColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(tierColor) ? tierColor : '#6B7280',
    connected: connected === true,
  };
}

export async function updateHomeWidget(state, native = BeltWidgetNative, platform = Platform.OS) {
  if (!isHomeWidgetAvailable(native, platform)) return { ok: false, reason: 'unavailable' };
  try {
    const p = toWidgetPayload(state || {});
    const widgets = await native.update(p.hasScore, p.score, p.tierLabel, p.tierColor, p.connected);
    return { ok: true, widgets: typeof widgets === 'number' ? widgets : null };
  } catch (e) {
    const info = errorInfo(e);
    console.warn('[WIDGET] update failed', info.code, info.message);
    return { ok: false, reason: 'error', ...info };
  }
}
