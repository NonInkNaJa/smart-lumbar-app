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

// ช่วงเวลาของวัน (ตามเวลาเครื่อง) สำหรับวิเคราะห์ว่าท่าไม่ดีเกิดบ่อยช่วงไหน: เช้า 6-12, บ่าย 12-18, เย็น/ค่ำ 18-24
// (ดึก 0-6 เก็บไว้ด้วยเพื่อไม่ให้ข้อมูลหาย แต่แสดงเมื่อมีข้อมูลพอเท่านั้น)
export const PERIODS = [
  { key: 'night', label: 'ดึก (0-6)', from: 0, to: 6 },
  { key: 'morning', label: 'เช้า (6-12)', from: 6, to: 12 },
  { key: 'afternoon', label: 'บ่าย (12-18)', from: 12, to: 18 },
  { key: 'evening', label: 'เย็น/ค่ำ (18-24)', from: 18, to: 24 },
];
export const PERIOD_MIN_SECONDS = 10 * 60; // ช่วงเวลาหนึ่งต้องมีข้อมูลอย่างน้อย 10 นาที ถึงจะนำมาเปรียบเทียบ
export const PERIOD_MIN_TOTAL_SECONDS = 60 * 60; // รวมทุกช่วงต้องมีอย่างน้อย 1 ชั่วโมง
export const PERIOD_MIN_COUNT = 2; // ต้องมีอย่างน้อย 2 ช่วงเวลาที่ข้อมูลพอ (ไม่งั้นไม่มีอะไรให้เปรียบเทียบ)
export const PERIOD_TIE_POINTS = 2; // ช่วงที่สูงสุดห่างจากอันดับสองไม่เกินกี่จุดเปอร์เซ็นต์ ถือว่าใกล้เคียงกัน

// ชั่วโมง (0-23) -> key ของช่วงเวลา; ค่าไม่ถูกต้อง -> null
export function periodOfHour(hour) {
  if (typeof hour !== 'number' || !Number.isFinite(hour) || hour < 0 || hour >= 24) return null;
  const h = Math.floor(hour);
  const p = PERIODS.find((x) => h >= x.from && h < x.to);
  return p ? p.key : null;
}

// ชื่อฟิลด์ในบันทึกรายวัน เช่น goodSeconds_morning / badSeconds_morning
export const periodField = (kind, key) => `${kind}Seconds_${key}`;

// ค่าวินาทีที่ใช้ได้ (ตัวเลขจำกัด >= 0) ค่าอื่น/ข้อมูลเสีย = 0 (กันข้อความต่อกันแทนการบวก)
const secs = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function emptyDay() {
  const day = { goodSeconds: 0, badSeconds: 0, hunchedSeconds: 0, slumpedSeconds: 0 };
  PERIODS.forEach((p) => {
    day[periodField('good', p.key)] = 0;
    day[periodField('bad', p.key)] = 0;
  });
  return day;
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
  const periods = {}; // แยกตามช่วงเวลาของวัน (ข้อมูลเก่าก่อนมีการแยกช่วงเวลา = 0)
  PERIODS.forEach((p) => {
    periods[p.key] = { goodSeconds: 0, badSeconds: 0 };
  });
  keys.forEach((k) => {
    const r = recordsByKey[k];
    if (r) {
      good += r.goodSeconds || 0;
      bad += r.badSeconds || 0;
      hunched += r.hunchedSeconds || 0;
      slumped += r.slumpedSeconds || 0;
      PERIODS.forEach((p) => {
        periods[p.key].goodSeconds += secs(r[periodField('good', p.key)]);
        periods[p.key].badSeconds += secs(r[periodField('bad', p.key)]);
      });
    }
  });
  const total = good + bad;
  return {
    label,
    periods,
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

// วิเคราะห์ว่าท่าไม่ดีเกิดบ่อยช่วงไหนของวัน จากข้อมูลที่บันทึกแยกช่วงเวลาไว้ (buckets = ผลของ buildSeries ของช่วงที่เลือก)
// เปรียบเทียบด้วย "% ท่าไม่ดีภายในช่วงเวลานั้นเอง" (badPercent = bad / (good+bad) ของช่วงนั้น) ไม่ใช่สัดส่วนของท่าไม่ดีทั้งหมด
// เพื่อไม่ให้ช่วงที่ใส่เข็มขัดนานกว่าดูเหมือนแย่กว่า
// เงื่อนไข "ข้อมูลพอ": ช่วงเวลาที่นับต้องมีข้อมูล >= PERIOD_MIN_SECONDS, รวมกัน >= PERIOD_MIN_TOTAL_SECONDS, และมีอย่างน้อย PERIOD_MIN_COUNT ช่วง
// ผลลัพธ์: { enough, reason, totalSeconds, qualifyingCount, rows[{key,label,seconds,hasEnough,badPercent,isTop}], topKey, tie, allGood }
//   reason: 'ok' | 'too-little-total' | 'too-few-periods'; topKey = ช่วงที่ท่าไม่ดีบ่อยสุด (null = ไม่มี/ท่าดีทุกช่วง); tie = ใกล้เคียงกันจนบอกไม่ได้
export function summarizePeriods(buckets) {
  const list = Array.isArray(buckets) ? buckets : [];
  const sums = {};
  PERIODS.forEach((p) => {
    sums[p.key] = { good: 0, bad: 0 };
  });
  list.forEach((b) => {
    if (!b || !b.periods) return;
    PERIODS.forEach((p) => {
      const x = b.periods[p.key];
      if (x) {
        sums[p.key].good += secs(x.goodSeconds);
        sums[p.key].bad += secs(x.badSeconds);
      }
    });
  });
  const all = PERIODS.map((p) => {
    const seconds = sums[p.key].good + sums[p.key].bad;
    const hasEnough = seconds >= PERIOD_MIN_SECONDS;
    return { key: p.key, label: p.label, seconds, hasEnough, badPercent: seconds > 0 ? Math.round((sums[p.key].bad / seconds) * 100) : 0, isTop: false };
  });
  const totalSeconds = all.reduce((a, r) => a + r.seconds, 0);
  const qualifying = all.filter((r) => r.hasEnough);
  // แสดงเช้า/บ่าย/เย็นเสมอ; ดึกแสดงเมื่อมีข้อมูลพอเท่านั้น
  const rows = all.filter((r) => r.key !== 'night' || r.hasEnough);
  const qualifyingSeconds = qualifying.reduce((a, r) => a + r.seconds, 0);
  let reason = 'ok';
  if (qualifyingSeconds < PERIOD_MIN_TOTAL_SECONDS) reason = 'too-little-total';
  else if (qualifying.length < PERIOD_MIN_COUNT) reason = 'too-few-periods';
  const enough = reason === 'ok';
  let topKey = null;
  let tie = false;
  let allGood = false;
  if (enough) {
    const ranked = [...qualifying].sort((a, b) => b.badPercent - a.badPercent);
    if (ranked[0].badPercent === 0) {
      allGood = true;
    } else {
      tie = ranked[0].badPercent - ranked[1].badPercent <= PERIOD_TIE_POINTS;
      if (!tie) topKey = ranked[0].key;
    }
    rows.forEach((r) => {
      r.isTop = r.key === topKey;
    });
  }
  return { enough, reason, totalSeconds, qualifyingSeconds, qualifyingCount: qualifying.length, rows, topKey, tie, allGood };
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
  if (range === 'prev7d') return lastNDays(addDays(today, -7), 7);
  if (range === '30d') return lastNDays(today, 30); // ใช้หาวันล่าสุดที่มีข้อมูลสำหรับหน้าสรุปวันนี้ // 7 วันก่อนหน้าช่วง 7d (ใช้เทียบกับสัปดาห์ก่อน)
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
  if (range === 'mtd' || range === '30d') return days.map((d) => summarize(String(d.getDate()), [getLocalDateKey(d)], recordsByKey));
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
