// ส่วนคำนวณสถิติท่านั่ง (ไม่แตะ AsyncStorage/React Native เพื่อให้ทดสอบได้ง่าย)
//
// ข้อมูลรายวันเก็บเป็น { goodSeconds, badSeconds, hunchedSeconds, slumpedSeconds }
// key ของแต่ละวันคือวันที่ตามเวลาเครื่อง (ไม่ใช่ UTC) เช่น "2026-09-19"

export const MIN_TRACKED_SECONDS = 60; // มีข้อมูลน้อยกว่านี้ในช่วงนั้น ถือว่า "ยังไม่มีข้อมูล"
export const GOOD_DAY_MAX_BAD_RATIO = 0.3; // วันที่นั่งท่าไม่ดีต่ำกว่า 30% ของเวลา = "วันดี" (ใช้นับ streak)

const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

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
  let hunched = 0;
  let slumped = 0;
  keys.forEach((k) => {
    const r = recordsByKey[k];
    if (r) {
      good += r.goodSeconds || 0;
      bad += r.badSeconds || 0;
      hunched += r.hunchedSeconds || 0;
      slumped += r.slumpedSeconds || 0;
    }
  });
  const total = good + bad;
  return {
    label,
    dateKey: keys.length === 1 ? keys[0] : null, // แท่งของวันเดียว: ใช้จับคู่กับ self-report ของวันนั้น
    hasData: total >= MIN_TRACKED_SECONDS,
    badPostureRatio: total > 0 ? bad / total : 0, // สัดส่วนเวลาที่นั่งท่าไม่ดี 0-1
    goodSeconds: good,
    badSeconds: bad,
    hunchedSeconds: hunched, // วินาทีที่หลังค่อม (roll) — คนละตัวกับเอนหลัง: ช่วงเดียวกันอาจเป็นทั้งสองแบบพร้อมกัน
    slumpedSeconds: slumped, // วินาทีที่เอนหลังไม่ดี (pitch)
  };
}

// สาเหตุท่านั่งไม่ดีของช่วงที่เลือก เป็น % ของเวลาที่ตรวจวัดได้ทั้งช่วง (ไม่ใช่ % ของเฉพาะเวลาที่ท่าไม่ดี)
// หลังค่อมกับเอนหลังนับแยกกัน และบางวินาทีเป็นทั้งสองอย่างพร้อมกันได้ ผลรวมสองค่าจึงอาจมากกว่าท่าไม่ดีทั้งหมด (overlap = true)
// buckets: ผลของ buildSeries; ตรวจวัดรวมน้อยกว่า MIN_TRACKED_SECONDS = hasData false (ยังไม่มีข้อมูล)
export function summarizeCauses(buckets) {
  const list = Array.isArray(buckets) ? buckets : [];
  let good = 0;
  let bad = 0;
  let hunched = 0;
  let slumped = 0;
  list.forEach((b) => {
    good += b.goodSeconds || 0;
    bad += b.badSeconds || 0;
    hunched += b.hunchedSeconds || 0;
    slumped += b.slumpedSeconds || 0;
  });
  const total = good + bad;
  if (total < MIN_TRACKED_SECONDS) return { hasData: false, hunchedPercent: 0, slumpedPercent: 0, overlap: false };
  return {
    hasData: true,
    hunchedPercent: Math.round((hunched / total) * 100),
    slumpedPercent: Math.round((slumped / total) * 100),
    overlap: hunched + slumped > bad,
  };
}

// วันที่ล่าสุดอยู่ท้ายสุดเสมอ (เก่า -> ใหม่)
function lastNDays(today, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

// ตั้งแต่วันที่ 1 ของเดือนถึงวันนี้
function monthToDate(today) {
  const out = [];
  for (let d = new Date(today.getFullYear(), today.getMonth(), 1); d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

function daysOfRange(range, today) {
  if (range === '1d') return [today];
  if (range === '7d') return lastNDays(today, 7);
  if (range === 'prev7d') return lastNDays(addDays(today, -7), 7); // 7 วันก่อนหน้าช่วง 7d (ใช้เทียบกับสัปดาห์ก่อน)
  if (range === 'mtd') return monthToDate(today);
  return [];
}

// range: '1d' = วันนี้, '7d' = 7 วันล่าสุด, 'prev7d' = 7 วันก่อนหน้านั้น, 'mtd' = ต้นเดือนถึงวันนี้ (แท่งละวัน)
export function keysNeeded(range, today = new Date()) {
  return daysOfRange(range, today).map(getLocalDateKey);
}

export function buildSeries(range, recordsByKey, today = new Date()) {
  const days = daysOfRange(range, today);
  if (range === '1d') return [summarize('วันนี้', [getLocalDateKey(today)], recordsByKey)];
  if (range === '7d' || range === 'prev7d') return days.map((d) => summarize(THAI_WEEKDAYS[d.getDay()], [getLocalDateKey(d)], recordsByKey));
  if (range === 'mtd') return days.map((d) => summarize(String(d.getDate()), [getLocalDateKey(d)], recordsByKey));
  return [];
}

// key ของ n วันล่าสุด (สำหรับโหลดข้อมูลมาคิด streak)
export function keysForLastDays(n, today = new Date()) {
  return lastNDays(today, n).map(getLocalDateKey);
}

function isGoodDay(record, maxBadRatio) {
  if (!record) return false;
  const good = record.goodSeconds || 0;
  const bad = record.badSeconds || 0;
  const total = good + bad;
  return total >= MIN_TRACKED_SECONDS && bad / total < maxBadRatio;
}

// streak = จำนวน "วันดี" ที่ต่อเนื่องกันไม่ขาดตอน นับถอยหลังจากวันนี้
// วันนี้ยังไม่จบ: ถ้าวันนี้ยังไม่ใช่วันดี (ยังไม่มีข้อมูล/ยังนั่งท่าไม่ดีเยอะ) จะไม่ตัด streak ของเมื่อวาน แค่ยังไม่นับวันนี้
// วันที่ไม่มีข้อมูล (ไม่ได้ใส่เข็มขัด) ถือว่าขาดตอน
export function computeStreak(recordsByKey, today = new Date(), maxBadRatio = GOOD_DAY_MAX_BAD_RATIO) {
  let streak = isGoodDay(recordsByKey[getLocalDateKey(today)], maxBadRatio) ? 1 : 0;
  for (let d = addDays(today, -1); isGoodDay(recordsByKey[getLocalDateKey(d)], maxBadRatio); d = addDays(d, -1)) {
    streak++;
  }
  return streak;
}
