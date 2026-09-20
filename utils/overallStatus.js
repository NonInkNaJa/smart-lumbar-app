import { STATUS_WARN_RATIO } from '../config';

// สถานะภาพรวมบนหน้า Home คำนวณจากสถานะที่แอปมีอยู่แล้ว (ไม่เก็บข้อมูลเพิ่ม)
//   bad  (แดง)   = ควรปรับท่า        : กำลังเตือนท่านั่งไม่ดี หรือเตือนนั่งนานอยู่
//   warn (เหลือง) = ควรระวัง          : ใกล้ถึงเวลาเตือนนั่งนาน (ถึง STATUS_WARN_RATIO ของเวลาที่ตั้ง)
//   good (เขียว)  = ท่านั่งดี          : เชื่อมต่ออยู่และยังไม่มีอะไรต้องระวัง
//   idle (เทา)   = ยังไม่ได้เชื่อมต่อ / หยุดตรวจชั่วคราว : ยังไม่มีข้อมูลสดให้ตัดสิน (ไม่ใช้ "ท่านั่งดี" ทั้งที่ไม่ได้ตรวจ)
// nextAlertAt = เวลานั่ง (นาที) ที่จะเตือนนั่งนานครั้งถัดไป (หลังกด "ยืดเส้นแล้ว" จะขยับไปอีกรอบ)
// limitMinutes = เวลาเตือนนั่งนานที่ผู้ใช้ตั้ง (ความยาวของหนึ่งรอบ)
export const STATUS_META = {
  bad: { key: 'bad', level: 'bad', label: 'ควรปรับท่า', color: '#EF4444' },
  warn: { key: 'warn', level: 'warn', label: 'ควรระวัง', color: '#F59E0B' },
  good: { key: 'good', level: 'good', label: 'ท่านั่งดี', color: '#10B981' },
  idle: { key: 'idle', level: 'idle', label: 'ยังไม่ได้เชื่อมต่อ', color: '#6B7280' },
  paused: { key: 'paused', level: 'idle', label: 'หยุดตรวจชั่วคราว', color: '#6B7280' },
};

export function getOverallStatus({ isConnected, isPaused, postureAlert, isAlert, sittingTime, nextAlertAt, limitMinutes }) {
  if (postureAlert || isAlert) return STATUS_META.bad;
  if (!isConnected) return STATUS_META.idle;
  if (isPaused) return STATUS_META.paused;
  const warnAt = nextAlertAt - limitMinutes * (1 - STATUS_WARN_RATIO);
  if (sittingTime >= warnAt) return STATUS_META.warn;
  return STATUS_META.good;
}

// เตือนนั่งนาน = เชื่อมต่ออยู่ + นั่งถึงเวลาที่ตั้ง (และถ้าเคยกด "ยืดเส้นแล้ว" ต้องนั่งต่อถึงรอบใหม่ dismissedUntil)
// ใช้ทั้งตอนวาดหน้าจอและตอนคำนวณสถานะให้วิดเจ็ตจากข้อมูลเข็มขัด (ตอนอยู่เบื้องหลัง) จึงได้ผลตรงกันเสมอ
export function isSittingAlert({ isConnected, sittingTime, limitMinutes, dismissedUntil }) {
  return isConnected && sittingTime >= limitMinutes && (dismissedUntil === null || sittingTime >= dismissedUntil);
}
