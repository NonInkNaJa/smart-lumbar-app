// สิ่งที่วิดเจ็ตหน้าจอหลักแสดง ตัดสินใจทั้งหมดฝั่ง JS จากสถานะที่แอปมีอยู่แล้ว (ไม่คำนวณใหม่) ฝั่ง Kotlin แค่วาดตามที่ได้รับ
// 3 ส่วน: (1) สถานะท่านั่ง ใช้ badge ตัวเดียวกับหน้า Home  (2) เวลานั่งต่อเนื่อง  (3) คะแนนความพร้อม (แท่งสีเล็กๆ ส่วนเสริม)
// ฟังก์ชันล้วน ไม่แตะ React Native จึงทดสอบได้

export const WIDGET_SITTING_WARN_MINUTES = 5; // เวลานั่งเข้าเขตเตือนล่วงหน้าเมื่อเหลือไม่เกินกี่นาทีก่อนถึงเวลาเตือนนั่งนาน
export const WIDGET_LIVE_MS = 10 * 60 * 1000; // สถานะที่บอกว่ากำลังเชื่อมต่อ/นั่งอยู่ เชื่อถือได้ไม่เกินกี่ ms หลังส่งล่าสุด (เกินแล้ววิดเจ็ตแสดง "ไม่มีข้อมูล")
export const WIDGET_SCORE_MS = 36 * 60 * 60 * 1000; // แท่งคะแนนแสดงได้ไม่เกินกี่ ms หลังส่งล่าสุด (คะแนนเป็นค่าสะสมหลายวัน เก่าได้นานกว่า)

// สถานะที่ "ต้องสด" (บอกว่าแอปกำลังทำงานกับเข็มขัดอยู่): ถ้าข้อมูลเก่าเกิน WIDGET_LIVE_MS ไม่เชื่อถือ
// "ยังไม่ได้เชื่อมต่อ" (idle) ไม่หมดอายุ เพราะเป็นความจริงต่อไปจนกว่าแอปจะส่งสถานะใหม่ (แอปส่งทุกครั้งที่เชื่อมต่อ)
const LIVE_KEYS = ['good', 'warn', 'bad', 'paused', 'reconnecting'];

// isConnected = เชื่อมต่อจริงและมีข้อมูลสดเท่านั้น (ตอนกำลังต่อใหม่ต้องเป็น false จึงไม่โชว์เวลานั่งที่ไม่ขยับ)
// overallStatus = ผลของ getOverallStatus (ตัวเดียวกับป้ายสถานะบนหน้า Home): { key, label, color }
// nextAlertAt = เวลานั่ง (นาที) ที่จะเตือนนั่งนานครั้งถัดไป (ขยับเมื่อกด "ยืดเส้นแล้ว")
export function buildWidgetState({ overallStatus, isConnected, isPaused, sittingTime, nextAlertAt, score, tierColor }) {
  const status = overallStatus || { key: 'idle', label: 'ยังไม่ได้เชื่อมต่อ', color: '#6B7280' };
  // ส่วนที่ 2: เวลานั่งแสดงเฉพาะตอนเชื่อมต่ออยู่และไม่ได้หยุดชั่วคราว
  const showSitting = isConnected === true && isPaused !== true && Number.isFinite(sittingTime) && sittingTime >= 0;
  const sittingMinutes = showSitting ? Math.floor(sittingTime) : -1;
  return {
    statusKey: status.key,
    // "ท่านั่งดี ✓" ตามสเปกของวิดเจ็ต (ป้ายบน Home ไม่มีเครื่องหมายถูก); ป้ายอื่นใช้ตามป้ายบน Home ทุกตัวอักษร
    statusLabel: status.key === 'good' ? `${status.label} ✓` : status.label,
    statusColor: status.color,
    live: LIVE_KEYS.includes(status.key),
    sittingMinutes,
    // ใกล้ครบเวลาเตือน (ภายใน 5 นาทีสุดท้าย รวมถึงเลยเวลาแล้ว) = เปลี่ยนสีเตือน
    sittingWarn: showSitting && Number.isFinite(nextAlertAt) && sittingTime >= nextAlertAt - WIDGET_SITTING_WARN_MINUTES,
    // ส่วนที่ 3: คะแนน (score = ตัวเลข 0-100 หรือ null = ยังไม่มีข้อมูล), tierColor = สีตามระดับเดิม (เขียว/เหลือง/แดง)
    score: typeof score === 'number' && Number.isFinite(score) ? score : null,
    tierColor,
  };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const GRAY = '#6B7280';

// แปลงสถานะเป็นข้อมูลที่ส่งให้ Kotlin (JSON): ปรับค่าให้ปลอดภัย + ใส่เวลาหมดอายุ (Kotlin เทียบกับเวลาปัจจุบันเองตอนวาด)
export function toWidgetPayload(state, now = Date.now()) {
  const s = state || {};
  const hasScore = typeof s.score === 'number' && Number.isFinite(s.score);
  const sittingOk = Number.isInteger(s.sittingMinutes) && s.sittingMinutes >= 0;
  const sittingMinutes = sittingOk ? Math.min(s.sittingMinutes, 24 * 60) : -1;
  return {
    statusLabel: typeof s.statusLabel === 'string' ? s.statusLabel.slice(0, 40) : '',
    statusColor: typeof s.statusColor === 'string' && HEX.test(s.statusColor) ? s.statusColor : GRAY,
    live: s.live === true,
    sittingMinutes,
    sittingWarn: s.sittingWarn === true && sittingMinutes >= 0,
    hasScore,
    score: hasScore ? Math.max(0, Math.min(100, Math.round(s.score))) : 0,
    tierColor: typeof s.tierColor === 'string' && HEX.test(s.tierColor) ? s.tierColor : GRAY,
    updatedAt: now,
    liveUntil: now + WIDGET_LIVE_MS,
    scoreUntil: now + WIDGET_SCORE_MS,
  };
}
