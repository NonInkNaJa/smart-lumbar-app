import { getLocalDateKey, MIN_TRACKED_SECONDS } from './postureStats';
import { getReadinessMessage } from './postureScore';

// สรุปประจำวัน (หน้า "สรุปวันนี้"): สรุปผลของ "เมื่อวาน" หรือวันล่าสุดที่มีข้อมูล จากข้อมูลที่แอปเก็บอยู่แล้วทั้งหมด ไม่เก็บข้อมูลใหม่
// ฟังก์ชันล้วน (ไม่แตะ React Native/AsyncStorage) ทดสอบง่าย

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// "2026-09-17" -> "17 ก.ย." ; รูปแบบผิด -> ''
export function formatThaiShortDate(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return '';
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return '';
  return `${parseInt(m[3], 10)} ${THAI_MONTHS_SHORT[month - 1]}`;
}

// วันที่ของ "เมื่อวาน" เทียบกับ todayKey (จัดการข้ามเดือน/ข้ามปีด้วยวันที่จริง)
export function yesterdayKeyOf(todayKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayKey || ''));
  if (!m) return null;
  return getLocalDateKey(new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10) - 1));
}

// เลือกวันที่จะสรุป: วันล่าสุดที่ "มีข้อมูล" ก่อนวันนี้ (buckets เรียงเก่า -> ใหม่; ไม่เอาวันนี้เพราะวันนี้ยังไม่จบ)
export function pickSummaryDay(buckets, todayKey) {
  const list = Array.isArray(buckets) ? buckets : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (b && b.hasData && b.dateKey && b.dateKey < todayKey) return b;
  }
  return null;
}

// สาเหตุท่าไม่ดีที่พบบ่อยสุดของวันนั้น (% ของเวลาที่ตรวจวัดทั้งวัน)
//   none    = ไม่มีท่าไม่ดีเลย
//   unknown = มีท่าไม่ดีแต่ไม่มีข้อมูลแยกชนิด (ข้อมูลเก่าก่อนมีการแยก)
//   hunched / slumped / both = หลังค่อม / เอนหลังไม่ดี / พอๆ กัน
export function topCause(bucket) {
  const good = (bucket && bucket.goodSeconds) || 0;
  const bad = (bucket && bucket.badSeconds) || 0;
  const total = good + bad;
  if (total < MIN_TRACKED_SECONDS || bad === 0) return { kind: 'none', hunchedPercent: 0, slumpedPercent: 0 };
  const h = bucket.hunchedSeconds || 0;
  const s = bucket.slumpedSeconds || 0;
  const hunchedPercent = Math.round((h / total) * 100);
  const slumpedPercent = Math.round((s / total) * 100);
  if (h === 0 && s === 0) return { kind: 'unknown', hunchedPercent, slumpedPercent };
  return { kind: h > s ? 'hunched' : s > h ? 'slumped' : 'both', hunchedPercent, slumpedPercent };
}

// รวมทุกอย่างที่หน้าสรุปต้องแสดง
export function buildDailySummary({ bucket, streak, stretchCount, todayKey }) {
  const readiness = getReadinessMessage(bucket.tier);
  return {
    dateKey: bucket.dateKey,
    isYesterday: bucket.dateKey === yesterdayKeyOf(todayKey),
    dateLabel: formatThaiShortDate(bucket.dateKey),
    score: typeof bucket.score === 'number' ? bucket.score : null,
    tier: bucket.tier,
    readinessLabel: readiness.label,
    readinessColor: readiness.color,
    streak: Number.isInteger(streak) && streak > 0 ? streak : 0,
    stretchCount: Number.isInteger(stretchCount) && stretchCount > 0 ? stretchCount : 0,
    cause: topCause(bucket),
  };
}
