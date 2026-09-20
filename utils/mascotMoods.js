// อารมณ์/ท่าทางของมาสคอตตามระดับ (tier) ของคะแนนความพร้อม
// ตอนนี้มีภาพมาสคอตสีหน้าเดียว (ยิ้ม) จึงสื่ออารมณ์ด้วยการเคลื่อนไหว สีขอบ และป้ายอีโมจิ
// (ถ้ามีภาพสีหน้าจริงเพิ่ม ให้ใส่ใน MASCOT_IMAGES_BY_TIER ของ utils/images.js)
//
// low      = เสี่ยงต่ำ = พร้อมออกกำลังกาย : ร่าเริง เด้งสูงเร็ว
// moderate = ควรวอร์มอัพเพิ่ม            : ปกติ เด้งเบาๆ
// high     = เสี่ยงสูง = ควรพักฟื้น        : เป็นห่วง เด้งเตี้ยช้า เอียงตัว มีหยดเหงื่อ
// no-data  = ยังไม่มีข้อมูล                : ทักทายเฉยๆ
export const MASCOT_MOODS = {
  low: { label: 'ยิ้มแย้ม', emoji: '😊', extra: null, ring: '#10B981', bounceHeight: 8, bounceMs: 700, tilt: 0 },
  moderate: { label: 'ปกติ', emoji: '🙂', extra: null, ring: '#F59E0B', bounceHeight: 5, bounceMs: 1000, tilt: 0 },
  high: { label: 'เป็นห่วง', emoji: '😟', extra: '💦', ring: '#EF4444', bounceHeight: 3, bounceMs: 1500, tilt: -5 },
  'no-data': { label: 'ทักทาย', emoji: '👋', extra: null, ring: '#6B7280', bounceHeight: 5, bounceMs: 1000, tilt: 0 },
};

// tier ที่ไม่รู้จักใช้แบบ "ยังไม่มีข้อมูล"
export function getMascotMood(tier) {
  return Object.prototype.hasOwnProperty.call(MASCOT_MOODS, tier) ? MASCOT_MOODS[tier] : MASCOT_MOODS['no-data'];
}
