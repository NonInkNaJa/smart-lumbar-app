export function calculateWeeklyScore(dailyData) {
  const validDays = dailyData.filter((d) => d.hasData);
  if (validDays.length === 0) return { score: null, tier: 'no-data' };

  let weightedSum = 0;
  let weightTotal = 0;
  validDays.forEach((day, index) => {
    const daysFromToday = validDays.length - 1 - index;
    const weight = Math.pow(0.85, daysFromToday);
    weightedSum += day.badPostureRatio * weight;
    weightTotal += weight;
  });

  const score = Math.round((weightedSum / weightTotal) * 100);
  const tier = score < 30 ? 'low' : score < 55 ? 'moderate' : 'high';

  return { score, tier };
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
export function getRecommendedRoutine(tier) {
  const routines = {
    low: [
      { name: 'Cat-Cow', detail: '10 ครั้ง' },
      { name: "World's Greatest Stretch", detail: '5 ครั้ง/ข้าง' },
      { name: 'Glute Bridge', detail: '15 ครั้ง' },
    ],
    moderate: [
      { name: "Child's Pose", detail: '30 วินาที' },
      { name: 'Hip Flexor Stretch', detail: '30 วินาที/ข้าง' },
      { name: 'Thoracic Extension (โฟมโรลเลอร์)', detail: '10 ครั้ง' },
      { name: 'Cat-Cow', detail: '10 ครั้ง' },
    ],
    high: [
      { name: "Child's Pose", detail: '60 วินาที' },
      { name: '90/90 Hip Stretch', detail: '45 วินาที/ข้าง' },
      { name: 'Prone Press-up (McKenzie)', detail: '10 ครั้ง' },
      { name: 'Deep Breathing + Decompression Hang', detail: '30 วินาที' },
      { name: '⚠️ หลีกเลี่ยงท่า loaded spinal flexion วันนี้' },
    ],
  };
  return routines[tier] || [];
}
