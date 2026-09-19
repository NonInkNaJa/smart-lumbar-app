// ส่วนคำนวณสถิติท่านั่ง (ไม่แตะ AsyncStorage/React Native เพื่อให้ทดสอบได้ง่าย)
//
// ข้อมูลรายวันเก็บเป็น { goodSeconds, badSeconds, hunchedSeconds, slumpedSeconds }
// key ของแต่ละวันคือวันที่ตามเวลาเครื่อง (ไม่ใช่ UTC) เช่น "2026-09-19"

export const MIN_TRACKED_SECONDS = 60; // มีข้อมูลน้อยกว่านี้ในช่วงนั้น ถือว่า "ยังไม่มีข้อมูล"

const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function emptyDay() {
  return { goodSeconds: 0, badSeconds: 0, hunchedSeconds: 0, slumpedSeconds: 0 };
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// รวมหลายวันเป็นหนึ่งแท่งกราฟ
function summarize(label, keys, recordsByKey) {
  let good = 0;
  let bad = 0;
  keys.forEach((k) => {
    const r = recordsByKey[k];
    if (r) {
      good += r.goodSeconds || 0;
      bad += r.badSeconds || 0;
    }
  });
  const total = good + bad;
  return {
    label,
    hasData: total >= MIN_TRACKED_SECONDS,
    badPostureRatio: total > 0 ? bad / total : 0, // สัดส่วนเวลาที่นั่งท่าไม่ดี 0-1
    goodSeconds: good,
    badSeconds: bad,
  };
}

// วันที่ล่าสุดอยู่ท้ายสุดเสมอ (เก่า -> ใหม่)
function lastNDays(today, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

function firstDayOfMonthsAgo(today, monthsAgo) {
  return new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
}

// range: '7d' = 7 วันล่าสุดรายวัน, '4w' = 4 สัปดาห์ล่าสุดรายสัปดาห์, '6m' = 6 เดือนล่าสุดรายเดือน
export function keysNeeded(range, today = new Date()) {
  if (range === '7d') return lastNDays(today, 7).map(getLocalDateKey);
  if (range === '4w') return lastNDays(today, 28).map(getLocalDateKey);
  if (range === '6m') {
    const start = firstDayOfMonthsAgo(today, 5);
    const keys = [];
    for (let d = start; d <= today; d = addDays(d, 1)) keys.push(getLocalDateKey(d));
    return keys;
  }
  return [];
}

export function buildSeries(range, recordsByKey, today = new Date()) {
  if (range === '7d') {
    return lastNDays(today, 7).map((d) => summarize(THAI_WEEKDAYS[d.getDay()], [getLocalDateKey(d)], recordsByKey));
  }

  if (range === '4w') {
    const days = lastNDays(today, 28);
    const series = [];
    for (let w = 0; w < 4; w++) {
      const group = days.slice(w * 7, w * 7 + 7);
      const start = group[0];
      series.push(summarize(`${start.getDate()}/${start.getMonth() + 1}`, group.map(getLocalDateKey), recordsByKey));
    }
    return series;
  }

  if (range === '6m') {
    const series = [];
    for (let i = 5; i >= 0; i--) {
      const first = firstDayOfMonthsAgo(today, i);
      const keys = [];
      for (let d = first; d.getMonth() === first.getMonth() && d <= today; d = addDays(d, 1)) {
        keys.push(getLocalDateKey(d));
      }
      series.push(summarize(THAI_MONTHS[first.getMonth()], keys, recordsByKey));
    }
    return series;
  }

  return [];
}
