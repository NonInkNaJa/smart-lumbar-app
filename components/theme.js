import { useBelt } from '../context/BeltContext';

// ชุดสีของแอป: ทุกหน้าดึงสีจากที่นี่ที่เดียว (โหมดสว่าง/มืด สลับได้ในหน้าตั้งค่า)
// สีสื่อความหมาย (เขียว/เหลือง/แดง ของคะแนน, สีปุ่ม) ไม่เปลี่ยนตามโหมด อยู่ใน COLORS ของ components/ui.js
export const LIGHT = {
  isDark: false,
  bg: '#F3F4F6', // พื้นหลังหน้าจอ (สีสำรองใต้รูปพื้นหลัง)
  bgOverlay: 'rgba(255,255,255,0)', // ชั้นเคลือบทับรูปพื้นหลัง: โหมดสว่างไม่เคลือบ เห็นรูปเต็ม
  card: '#FFFFFF', // พื้นการ์ด
  text: '#111827', // ข้อความหลัก
  text2: '#374151', // ข้อความรอง (หัวการ์ด)
  muted: '#6B7280', // ข้อความจาง
  faint: '#9CA3AF', // ข้อความจางมาก / คำอธิบาย
  number: '#1D4ED8', // ตัวเลขเด่น (เวลา, มุมเอียง)
  surface: '#F3F4F6', // ปุ่มตัวเลือกที่ไม่ได้เลือก
  surface2: '#E5E7EB', // ปุ่มช่วงเวลา / badge ที่ไม่ได้เลือก
  selected: '#DBEAFE', // ปุ่มที่เลือกอยู่ (อ่อน)
  border: '#F3F4F6', // เส้นคั่น
  barEmpty: '#D1D5DB', // แท่งกราฟที่ยังไม่มีข้อมูล
  alertBg: '#FEE2E2', // กล่องเตือน
  alertText: '#EF4444',
  tabBar: '#FFFFFF',
  tabBorder: '#E5E7EB',
};

export const DARK = {
  isDark: true,
  bg: '#111827',
  bgOverlay: 'rgba(17,24,39,0.35)', // โหมดมืดมีรูปพื้นหลังเวอร์ชันสีเข้มของตัวเอง เคลือบเบาๆ ให้ตัวอักษรบนพื้นหลังคมชัด (วัดแล้ว: ข้อความหลัก >= 7.4:1 ทั้งภาพ)
  card: '#1F2937',
  text: '#F9FAFB',
  text2: '#E5E7EB',
  muted: '#9CA3AF',
  faint: '#8B95A5',
  number: '#60A5FA',
  surface: '#374151',
  surface2: '#374151',
  selected: '#1E3A8A',
  border: '#374151',
  barEmpty: '#4B5563',
  alertBg: '#7F1D1D',
  alertText: '#FCA5A5',
  tabBar: '#1F2937',
  tabBorder: '#374151',
};

// ชุดสีที่ใช้อยู่ตามการตั้งค่า dark mode ของผู้ใช้
export function useTheme() {
  const { settings } = useBelt();
  return settings.darkMode ? DARK : LIGHT;
}
