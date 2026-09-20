import AsyncStorage from '@react-native-async-storage/async-storage';

// จำว่า "สรุปวันนี้" อัตโนมัติแสดงไปแล้วในวันไหน (เก็บเป็น dateKey เช่น "2026-09-20") เพื่อแสดงแค่ครั้งแรกของวัน
const SHOWN_KEY = 'daily-summary-shown';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadSummaryShownDate() {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    return typeof raw === 'string' && DATE_KEY_RE.test(raw) ? raw : null; // ข้อมูลเสีย = ถือว่ายังไม่เคยแสดง
  } catch (e) {
    return null;
  }
}

export async function saveSummaryShownDate(dateKey) {
  try {
    await AsyncStorage.setItem(SHOWN_KEY, dateKey);
  } catch (e) {
    console.log('บันทึกวันที่แสดงสรุปไม่สำเร็จ', e);
  }
}
