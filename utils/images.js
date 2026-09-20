// รูปทั้งหมดของแอปรวมไว้ที่เดียว (Metro ต้องการ require ที่เป็นข้อความตายตัว จึงสร้างรายการแบบวนลูปไม่ได้)
//
// หมายเหตุเรื่องชื่อไฟล์: รูปในโฟลเดอร์ assets เป็นไฟล์ JPEG ที่ตั้งชื่อลงท้าย ".png.jpg" (Windows ซ่อนนามสกุลไว้ เลยดูเหมือน .png)
// ต้องอ้างชื่อตามไฟล์จริงทุกตัวอักษร ถ้าเปลี่ยนชื่อไฟล์ ต้องมาแก้ที่นี่ด้วย

// พื้นหลังของทุกหน้า (ภาพแนวนอนโทนเขียวอ่อน ใช้ resizeMode=cover) สลับเป็น app_background_2.png.jpg ได้ถ้าอยากลอง
export const BACKGROUND_IMAGE = require('../assets/app_background_1.png.jpg');

// ตัวการ์ตูนต้อนรับบนสุดของหน้า Home
export const MASCOT_IMAGE = require('../assets/app_mascot_1.png.jpg');

// ภาพมาสคอตตามระดับ (tier): ตอนนี้ใช้ภาพเดียวกัน (สีหน้ายิ้ม) ทุกระดับ อารมณ์ต่างกันด้วยการเคลื่อนไหว/สีขอบ/ป้ายอีโมจิ
// ถ้ามีภาพสีหน้าเป็นห่วง/ปกติ ให้ require ภาพใหม่ใส่ที่ high / moderate ตรงนี้ได้เลย (ไม่ต้องแก้ที่อื่น)
// หมายเหตุ: app_mascot_2 เป็นคนละตัวละคร (หัวใจ) ไม่ใช่สีหน้าอีกแบบของตัวนี้ จึงไม่ได้ใช้
export const MASCOT_IMAGES_BY_TIER = {
  low: MASCOT_IMAGE,
  moderate: MASCOT_IMAGE,
  high: MASCOT_IMAGE,
  'no-data': MASCOT_IMAGE,
};

export function getMascotImage(tier) {
  return Object.prototype.hasOwnProperty.call(MASCOT_IMAGES_BY_TIER, tier) ? MASCOT_IMAGES_BY_TIER[tier] : MASCOT_IMAGE;
}

// รูปประกอบท่ายืดเหยียด: key = ชื่อท่าใน utils/postureScore.js (ต้องตรงทุกตัวอักษร)
// ท่าที่ยังไม่มีรูป (ตอนนี้: 'ยืดสะโพก (Hip Flexors)') ไม่ต้องใส่ในรายการนี้ หน้าจอจะแสดงกรอบว่างแทน
const STRETCH_IMAGES = {
  'Cat-Cow': require('../assets/stretches/stretch_cat_cow.png.jpg'),
  "World's Greatest Stretch": require('../assets/stretches/stretch_worlds_greatest.png.jpg'),
  'Glute Bridge': require('../assets/stretches/stretch_glute_bridge.png.jpg'),
  "Child's Pose": require('../assets/stretches/stretch_childs_pose.png.jpg'),
  'Thoracic Extension (โฟมโรลเลอร์)': require('../assets/stretches/stretch_thoracic_extension.png.jpg'),
  '90/90 Hip Stretch': require('../assets/stretches/stretch_90_90_hip.png.jpg'),
  'Prone Press-up (McKenzie)': require('../assets/stretches/stretch_prone_pressup.png.jpg'),
  'Deep Breathing + Decompression Hang': require('../assets/stretches/stretch_deep_breathing.png.jpg'),
  'ยืดกล้ามเนื้อคอและบ่า': require('../assets/stretches/stretch_neck_shoulder.png.jpg'),
  'ยืดอกและไหล่ (Chest Opener)': require('../assets/stretches/stretch_chest_opener.png.jpg'),
  'ยืดหลังส่วนล่าง (Forward Bend)': require('../assets/stretches/stretch_forward_bend.png.jpg'),
};

// คืนรูปของท่านั้น หรือ null ถ้าท่านั้นยังไม่มีรูป
export function getStretchImage(name) {
  return Object.prototype.hasOwnProperty.call(STRETCH_IMAGES, name) ? STRETCH_IMAGES[name] : null;
}
