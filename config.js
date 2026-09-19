// ===== เกณฑ์ตรวจท่านั่ง (ปรับตรงนี้ได้ถ้าต้องจูนทีหลัง) =====
// ค่าอ้างอิงที่วัดจริงจากเข็มขัด (pitch, roll เป็นองศา):
//   ดี:      หลังตรงไม่พิง 85/-50, หลังตรงพิงพนัก 75/25
//   ไม่ดี:   หลังค่อม 85/-140..-150, เอนหลังตูดไม่ชิดเบาะ 50-55/25-30
export const SLUMP_PITCH_THRESHOLD = 65; // pitch ต่ำกว่านี้ = เอนหลังไม่ดี (ตูดไม่ชิดเบาะ)
export const HUNCH_ROLL_THRESHOLD = -100; // roll ต่ำกว่านี้ = หลังค่อม
export const BAD_POSTURE_SECONDS = 10; // ท่าไม่ดีต่อเนื่องกี่วินาทีถึงจะเตือน
export const DEFAULT_SITTING_ALERT_MINUTES = 45; // ค่าเริ่มต้น: นั่งต่อเนื่องกี่นาทีถึงจะเตือนให้ลุก (ผู้ใช้ปรับเองได้ในหน้าตั้งค่า)
export const SITTING_ALERT_OPTIONS = [20, 30, 45, 60]; // ตัวเลือกในหน้าตั้งค่า (นาที)
// ==========================================================

export const APP_NAME_TH = 'หลังเทพ';
export const APP_NAME_EN = 'Smart Lumbar Support';

// Bluetooth: ต้องตรงกับ firmware/smart_lumbar_belt/smart_lumbar_belt.ino
export const DEVICE_NAME = 'SmartLumbarBelt';
export const SERVICE_UUID = 'd5e630c8-e528-468a-a3ec-9386004b4327';
export const CHARACTERISTIC_UUID = '002cf995-2911-4bc5-9143-3991ef0d6cf6';

export const FLUSH_INTERVAL_MS = 15 * 1000; // เขียนข้อมูลท่านั่งลงเครื่องทุกๆ 15 วินาที

export const CHART_RANGES = [
  { key: '1d', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: 'mtd', label: 'เดือนนี้' },
];
