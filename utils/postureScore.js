// ===== ค่าที่ปรับได้ของคะแนนความพร้อม =====
// คะแนน 0-100: ยิ่งสูง = ท่านั่งดี = พร้อมออกกำลังกาย (สูงขึ้นเมื่อนั่งท่าดีมาก, ต่ำลงเมื่อนั่งท่าไม่ดีมาก)
export const RECENCY_DECAY = 0.85; // วันเก่าลงไปทีละวัน น้ำหนักลดเหลือ 85% ของวันถัดมา
export const PRIOR_SECONDS = 3600; // เติมข้อมูล "สมมติ" ท่าดี 50/50 รวม 1 ชั่วโมงเสมอ: ข้อมูลน้อย = คะแนนเข้าใกล้ 50, ข้อมูลมาก = คะแนนสะท้อนความจริง
export const READY_MIN_SCORE = 70; // คะแนน >= นี้ = พร้อม (tier 'low', สีเขียว)
export const CAUTION_MIN_SCORE = 45; // คะแนน >= นี้ = ควรวอร์มอัพเพิ่ม (tier 'moderate', สีเหลือง) ต่ำกว่านี้ = ควรพักฟื้น (tier 'high', สีแดง)
export const LOW_DATA_SECONDS = 3600; // ข้อมูลรวมน้อยกว่านี้ ถือว่า "ข้อมูลยังน้อย" (ใช้แสดงข้อความเตือนว่าคะแนนยังไม่แม่น)
// Self-report (วันนี้หลังตึงแค่ไหน 1-5): ตึงมาก (1-2) หักคะแนนความพร้อมของวันนั้น; 3 (เฉยๆ), 4-5 (สบายดี) และไม่ได้กรอก = ไม่ปรับ
export const SELF_REPORT_STRAINED_MAX = 2; // รายงาน <= นี้ = ตึงมาก
export const SELF_REPORT_PENALTY = 10; // หักกี่คะแนน (ไม่ต่ำกว่า 0)
// ==========================================

function tierFromScore(score) {
  return score >= READY_MIN_SCORE ? 'low' : score >= CAUTION_MIN_SCORE ? 'moderate' : 'high';
}

function penaltyFor(selfRating) {
  return selfRating >= 1 && selfRating <= SELF_REPORT_STRAINED_MAX ? SELF_REPORT_PENALTY : 0;
}

// คะแนนจากเซนเซอร์ล้วน 0-100 (ยังไม่หัก self-report): สัดส่วนท่าดีถ่วงด้วยข้อมูลสมมติ 50/50
// ระยะเวลาที่นั่งจริงยิ่งมาก ยิ่งกลบค่าสมมติ (ข้อมูลน้อยจะเข้าใกล้ 50 ไม่ใช่ 100 หรือ 0)
function sensorScoreOf(goodSeconds, badSeconds) {
  return ((goodSeconds + PRIOR_SECONDS / 2) / (goodSeconds + badSeconds + PRIOR_SECONDS)) * 100;
}

// คะแนนความพร้อมของ "วันเดียว" (ใช้กับแท่งกราฟ): คะแนนเซนเซอร์ แล้วหักตาม self-report ของวันนั้น
// day: { hasData, goodSeconds, badSeconds, selfRating? } -- วันที่ไม่มีข้อมูลเซนเซอร์ ไม่มีคะแนน (ไม่มีอะไรให้หัก)
export function calculateDayScore(day) {
  if (!day.hasData) return { score: null, sensorScore: null, penalty: 0, tier: 'no-data' };
  const sensor = sensorScoreOf(day.goodSeconds || 0, day.badSeconds || 0);
  const penalty = penaltyFor(day.selfRating);
  const score = Math.round(Math.max(0, sensor - penalty));
  return { score, sensorScore: Math.round(sensor), penalty, tier: tierFromScore(score) };
}

// ใส่คะแนนรายวัน (หลังหัก self-report แล้ว) ให้แต่ละแท่งกราฟ; selfReportLog = { 'YYYY-MM-DD': 1-5 }
export function applyDayScores(series, selfReportLog = {}) {
  return series.map((bucket) => {
    const selfRating = (bucket.dateKey && selfReportLog[bucket.dateKey]) || null;
    return { ...bucket, selfRating, ...calculateDayScore({ ...bucket, selfRating }) };
  });
}

// dailyData: [{ hasData, goodSeconds, badSeconds, selfRating? }] เรียงจากเก่า -> ใหม่ (วันล่าสุดอยู่ท้ายสุด)
// tier ใช้ชื่อเดิม (low/moderate/high) หมายถึง "ระดับความเสี่ยง": low = เสี่ยงต่ำ = พร้อมดี, high = เสี่ยงสูง = ควรพักฟื้น
export function calculateWeeklyScore(dailyData) {
  let goodWeighted = 0;
  let badWeighted = 0;
  let trackedSeconds = 0;
  let penaltyWeighted = 0;
  let weightSum = 0;

  dailyData.forEach((day, index) => {
    if (!day.hasData) return;
    const good = day.goodSeconds || 0;
    const bad = day.badSeconds || 0;
    const weight = Math.pow(RECENCY_DECAY, dailyData.length - 1 - index); // วันที่จริง ไม่ใช่ลำดับของวันที่มีข้อมูล
    goodWeighted += good * weight;
    badWeighted += bad * weight;
    trackedSeconds += good + bad;
    penaltyWeighted += penaltyFor(day.selfRating) * weight;
    weightSum += weight;
  });

  if (trackedSeconds === 0) return { score: null, tier: 'no-data', trackedSeconds: 0, lowData: false, sensorScore: null, adjustment: 0 };

  // คะแนนเซนเซอร์ทั้งสัปดาห์ (ถ่วงวันล่าสุดมากกว่า + ถ่วงระยะเวลาที่นั่ง) แล้วหักตามสัดส่วนวันที่รายงานว่าตึงมาก
  // (ถ่วงน้ำหนักวันล่าสุดมากกว่าเช่นกัน: ตึงทุกวัน = หักเต็ม 10, ตึงวันเดียวจาก 7 วัน = หักน้อยกว่า)
  const sensor = sensorScoreOf(goodWeighted, badWeighted);
  const score = Math.round(Math.max(0, sensor - penaltyWeighted / weightSum));
  const sensorScore = Math.round(sensor);

  return {
    score,
    tier: tierFromScore(score),
    trackedSeconds,
    lowData: trackedSeconds < LOW_DATA_SECONDS,
    sensorScore,
    adjustment: sensorScore - score, // จำนวนคะแนนที่ถูกหักเพราะ self-report (0 = ไม่มีการหัก)
  };
}

export function getReadinessMessage(tier) {
  switch (tier) {
    case 'low':
      return { label: 'พร้อมออกกำลังกาย', color: '#10B981', advice: 'สัปดาห์นี้ท่านั่งอยู่ในเกณฑ์ดี ออกกำลังกายตามแผนได้ตามปกติ' };
    case 'moderate':
      return { label: 'ควรวอร์มอัพเพิ่ม', color: '#F59E0B', advice: 'แนะนำยืดสะโพกและหลังส่วนล่าง 5-10 นาทีก่อนเริ่มออกกำลังกาย' };
    case 'high':
      return { label: 'ควรเน้นพักฟื้น', color: '#EF4444', advice: 'สัปดาห์นี้นั่งท่าไม่ดีสะสมมาก แนะนำเน้นยืดเหยียดเบาๆ แทนท่าหนัก' };
    default:
      return { label: 'ยังไม่มีข้อมูล', color: '#6B7280', advice: 'ยังไม่มีข้อมูลเพียงพอ สวมเข็มขัดสักสัปดาห์เพื่อดูคะแนน' };
  }
}

export function getTrainingAdjustment(tier, plannedIntensity) {
  if (!plannedIntensity) return null;
  if (tier === 'high' && plannedIntensity === 'heavy') {
    return { level: 'warn', message: 'แนะนำลดความหนักลงเป็นระดับกลาง หรือสลับเป็นวันพักแทน' };
  }
  if (tier === 'high' && plannedIntensity === 'medium') {
    return { level: 'caution', message: 'ควรเน้นวอร์มอัพและยืดเหยียดให้มากกว่าปกติก่อนเริ่ม' };
  }
  if (tier === 'moderate' && plannedIntensity === 'heavy') {
    return { level: 'caution', message: 'วอร์มอัพเพิ่ม 10 นาทีก่อนเริ่มท่าหนัก' };
  }
  return { level: 'ok', message: 'แผนฝึกวันนี้เหมาะสมกับสภาพร่างกายสัปดาห์นี้' };
}

// ท่ายืดเหยียดสำหรับพนักงานออฟฟิศ (หลัก ergonomics) 4 ท่า เรียงตามลำดับความสำคัญ
// ทุก tier ใช้ท่าเหล่านี้ "ต่อท้ายชุดเดิม" ของ tier นั้น: ต่ำ = 2 ท่าแรก, กลาง = 3 ท่าแรก, สูง = ครบ 4 ท่า
const OFFICE_STRETCHES = [
  { name: 'ยืดกล้ามเนื้อคอและบ่า', detail: 'เอียงศีรษะไปด้านข้าง ใช้มือช่วยกดเบาๆ ค้าง 15-20 วินาที สลับข้าง' },
  { name: 'ยืดอกและไหล่ (Chest Opener)', detail: 'ประสานมือด้านหลัง ยืดอกขึ้น ค้าง 15-20 วินาที' },
  { name: 'ยืดสะโพก (Hip Flexors)', detail: 'ยืนก้าวขาไปด้านหลัง ย่อเข่าหน้า ดันสะโพกไปข้างหน้า ค้าง 15-20 วินาที' },
  { name: 'ยืดหลังส่วนล่าง (Forward Bend)', detail: 'ก้มตัวช้าๆ มือแตะปลายเท้า ค้าง 15 วินาที' },
];

// ชุดท่าเดิมของแต่ละ tier (ข้อความเดิมทุกตัวอักษร)
// ตัดออก 1 ท่าที่ซ้ำความหมายกับท่าใหม่: 'Hip Flexor Stretch' (30 วินาที/ข้าง, tier กลาง) ซ้ำกับ 'ยืดสะโพก (Hip Flexors)'
// จึงเก็บไว้แค่ตัวใหม่ (มีวิธีทำครบกว่า)
const CLASSIC_STRETCHES = {
  low: [
    { name: 'Cat-Cow', detail: '10 ครั้ง' },
    { name: "World's Greatest Stretch", detail: '5 ครั้ง/ข้าง' },
    { name: 'Glute Bridge', detail: '15 ครั้ง' },
  ],
  moderate: [
    { name: "Child's Pose", detail: '30 วินาที' },
    { name: 'Thoracic Extension (โฟมโรลเลอร์)', detail: '10 ครั้ง' },
    { name: 'Cat-Cow', detail: '10 ครั้ง' },
  ],
  high: [
    { name: "Child's Pose", detail: '60 วินาที' },
    { name: '90/90 Hip Stretch', detail: '45 วินาที/ข้าง' },
    { name: 'Prone Press-up (McKenzie)', detail: '10 ครั้ง' },
    { name: 'Deep Breathing + Decompression Hang', detail: '30 วินาที' },
  ],
};

// แถวคำเตือนท้ายชุดของ tier สูง (ไม่ใช่ท่า ไม่มีรายละเอียด) วางไว้บรรทัดสุดท้ายเสมอ
const HIGH_CAUTION = { name: '⚠️ หลีกเลี่ยงท่า loaded spinal flexion วันนี้' };

// ชุดที่แสดงจริงต่อ tier (ยิ่งเสี่ยงยิ่งแสดงมาก): ต่ำ 5 ท่า, กลาง 6 ท่า, สูง 8 ท่า + แถวคำเตือน
// tier อื่น (เช่น no-data ที่ยังไม่มีข้อมูล) ไม่แสดงท่า
const ROUTINES = {
  low: [...CLASSIC_STRETCHES.low, ...OFFICE_STRETCHES.slice(0, 2)],
  moderate: [...CLASSIC_STRETCHES.moderate, ...OFFICE_STRETCHES.slice(0, 3)],
  high: [...CLASSIC_STRETCHES.high, ...OFFICE_STRETCHES.slice(0, 4), HIGH_CAUTION],
};

export function getRecommendedRoutine(tier) {
  if (!Object.prototype.hasOwnProperty.call(ROUTINES, tier)) return [];
  return ROUTINES[tier].map((s) => ({ ...s }));
}
