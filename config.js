// ===== เกณฑ์ตรวจท่านั่ง (ปรับตรงนี้ได้ถ้าต้องจูนทีหลัง) =====
// ค่าอ้างอิงที่วัดจริงจากเข็มขัด (pitch, roll เป็นองศา):
//   ดี:      หลังตรงไม่พิง 85/-50, หลังตรงพิงพนัก 75/25
//   ไม่ดี:   หลังค่อม 85/-140..-150, เอนหลังตูดไม่ชิดเบาะ 50-55/25-30
export const SLUMP_PITCH_THRESHOLD = 65; // pitch ต่ำกว่านี้ = เอนหลังไม่ดี (ตูดไม่ชิดเบาะ)
export const HUNCH_ROLL_THRESHOLD = -100; // roll ต่ำกว่านี้ = หลังค่อม
export const BAD_POSTURE_SECONDS = 10; // ท่าไม่ดีต่อเนื่องกี่วินาทีถึงจะเตือน
export const DEFAULT_SITTING_ALERT_MINUTES = 45; // ค่าเริ่มต้น: นั่งต่อเนื่องกี่นาทีถึงจะเตือนให้ลุก (ผู้ใช้ปรับเองได้ในหน้าตั้งค่า)
export const SITTING_ALERT_MIN_MINUTES = 10; // พิมพ์เวลาเตือนนั่งนานได้ต่ำสุด (นาที) กันพิมพ์ค่าประหลาด
export const SITTING_ALERT_MAX_MINUTES = 120; // พิมพ์ได้สูงสุด (นาที)
// ==========================================================

export const APP_NAME_TH = 'หลังเทพ';
export const APP_NAME_EN = 'Smart Lumbar Support';

// Bluetooth: ต้องตรงกับ firmware/smart_lumbar_belt/smart_lumbar_belt.ino
export const DEVICE_NAME = 'SmartLumbarBelt';
export const SERVICE_UUID = 'd5e630c8-e528-468a-a3ec-9386004b4327';
export const CHARACTERISTIC_UUID = '002cf995-2911-4bc5-9143-3991ef0d6cf6';

export const FLUSH_INTERVAL_MS = 15 * 1000; // เขียนข้อมูลท่านั่งลงเครื่องทุกๆ 15 วินาที

export const SCORE_ANIMATION_MS = 700; // ตัวเลขคะแนนนับขึ้น/ลงใช้เวลากี่มิลลิวินาที (0 = เปลี่ยนทันที)

// วิดเจ็ตหน้าจอหลัก: ส่งสถานะซ้ำอย่างน้อยทุกกี่ ms ตอนเชื่อมต่อเข็มขัดอยู่ (ให้วิดเจ็ตรู้ว่าแอปยังทำงานอยู่ ตัววิดเจ็ตถือว่า "เชื่อมต่อแล้ว" ได้ไม่เกิน 10 นาทีหลังส่งล่าสุด)
export const WIDGET_HEARTBEAT_MS = 5 * 60 * 1000;

// เชื่อมต่อเข็มขัดใหม่อัตโนมัติเมื่อสายหลุดเอง (ไม่ได้กดตัดการเชื่อมต่อเอง)
export const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // รอต่อใหม่ได้นานสุดกี่ ms ก่อนถือว่าหลุดจริง (ระหว่างนี้เวลานั่งและ service ค้างไว้ ไม่รีเซ็ต)
export const RECONNECT_RETRY_MS = 5000; // ต่อใหม่ไม่สำเร็จ (error) รอกี่ ms ก่อนลองอีกครั้ง (ตัวจับเวลา JS ทำงานเฉพาะตอนแอปอยู่หน้าจอ)
export const RECONNECT_QUICK_RETRIES = 3; // ต่อใหม่ไม่สำเร็จ ลองซ้ำทันทีกี่ครั้งก่อนเปลี่ยนไปรอตามตัวจับเวลา (ตอนอยู่เบื้องหลังตัวจับเวลาหยุด จึงต้องมีรอบลองทันที)

// การแจ้งเตือนถาวรของ foreground service (ตอนแอปรับข้อมูลจากเข็มขัดอยู่เบื้องหลัง)
export const SERVICE_VERIFY_DELAY_MS = 1500; // สั่งเริ่ม service แล้วรอกี่ ms ก่อนตรวจว่าขึ้นจริง (startForeground ทำงานแบบอะซิงก์)
export const BACKGROUND_SERVICE_TITLE = 'หลังเทพ กำลังทำงานอยู่';
export const BACKGROUND_SERVICE_TEXT = 'กำลังรับข้อมูลจากเข็มขัดและเตือนท่านั่ง';

// สถานะภาพรวมบน Home: นั่งถึงกี่ส่วนของเวลาเตือนนั่งนานแล้วเปลี่ยนเป็น "ควรระวัง" (0.8 = ถึง 80%)
export const STATUS_WARN_RATIO = 0.8;

// Confetti ฉลองเมื่อ streak เพิ่มเป็นวันใหม่
export const STREAK_CONFETTI_COUNT = 150; // จำนวนชิ้นกระดาษ
export const STREAK_CONFETTI_COLORS = ['#F97316', '#10B981', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444'];

// Animation ของการ์ด: ค่อยๆ ขึ้น (fade-in) ทีละใบตอนโหลดหน้า
export const CARD_FADE_MS = 350; // ใช้เวลาขึ้นกี่มิลลิวินาที
export const CARD_STAGGER_MS = 60; // การ์ดใบถัดไปเริ่มช้ากว่าใบก่อนกี่มิลลิวินาที

export const CHART_RANGES = [
  { key: '1d', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: 'mtd', label: 'เดือนนี้' },
];
