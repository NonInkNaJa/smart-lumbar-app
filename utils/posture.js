import { SLUMP_PITCH_THRESHOLD, HUNCH_ROLL_THRESHOLD } from '../config';

// เช็คท่านั่งจากมุมเอียงหนึ่งค่า: หลังค่อม (roll) และ/หรือ เอนหลังไม่ดี (pitch)
export function getPostureStatus(tilt) {
  if (!tilt) return { isHunched: false, isSlumped: false, isBadPosture: false, label: null };
  const isHunched = tilt.roll < HUNCH_ROLL_THRESHOLD;
  const isSlumped = tilt.pitch < SLUMP_PITCH_THRESHOLD;
  const labels = [];
  if (isHunched) labels.push('หลังค่อม');
  if (isSlumped) labels.push('เอนหลังไม่ดี (ตูดไม่ชิดเบาะ)');
  return { isHunched, isSlumped, isBadPosture: isHunched || isSlumped, label: labels.join(' + ') };
}
