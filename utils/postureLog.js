import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey, emptyDay, keysNeeded, keysForLastDays, buildSeries, computeStreak, periodOfHour, periodField } from './postureStats';

const KEY_PREFIX = 'posture-log-'; // เช่น "posture-log-2026-09-19"

// นับสะสมในหน่วยความจำก่อน แล้วค่อยเขียนลง AsyncStorage เป็นรอบ (flushPostureLog)
// เพื่อไม่ต้องอ่าน-เขียนดิสก์ทุกวินาที
const pending = {}; // dateKey -> { goodSeconds, badSeconds, hunchedSeconds, slumpedSeconds }
let writeQueue = Promise.resolve(); // เขียนทีละงาน ไม่ให้ข้อมูลทับกัน

// เรียกทุกครั้งที่ได้ค่า pitch/roll ใหม่ (ประมาณวินาทีละครั้ง) = นับเวลา 1 วินาที
export function recordPostureSample(status, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return; // เวลาไม่ถูกต้อง: ไม่นับ (กันบันทึกลงคีย์วันที่มั่ว)
  const key = getLocalDateKey(now);
  const day = pending[key] || (pending[key] = emptyDay());
  const period = periodOfHour(now.getHours()); // ช่วงเวลาของวัน (เช้า/บ่าย/เย็น/ดึก) ตามเวลาเครื่อง ณ ตอนนับ; เวลาผิดปกติ = ไม่แยกช่วง
  if (status.isBadPosture) {
    day.badSeconds += 1;
    if (period) day[periodField('bad', period)] += 1;
    if (status.isHunched) day.hunchedSeconds += 1;
    if (status.isSlumped) day.slumpedSeconds += 1;
  } else {
    day.goodSeconds += 1;
    if (period) day[periodField('good', period)] += 1;
  }
}

function mergeInto(target, source) {
  Object.keys(source).forEach((f) => {
    target[f] = (target[f] || 0) + source[f];
  });
}

// ล้างข้อมูลทั้งหมดในเครื่อง: ล้าง AsyncStorage ทั้งหมด + ทิ้งค่าท่านั่งที่ค้างในหน่วยความจำ (ประวัติ, self-report, ตั้งค่า, streak ฯลฯ)
// ทำผ่านคิวเดียวกับการเขียน จึงรอให้งานเขียนที่ค้างอยู่เสร็จก่อน และไม่มีงานเขียนเก่ามาเขียนทับหลังล้าง
export function wipeAllStoredData() {
  const run = writeQueue.then(async () => {
    await AsyncStorage.clear();
    Object.keys(pending).forEach((k) => delete pending[k]); // ทิ้งหลังล้างสำเร็จเท่านั้น (ล้างไม่สำเร็จ = ข้อมูลที่ค้างไม่หาย)
  });
  writeQueue = run.catch(() => {}); // ล้มเหลวไม่ทำให้คิวตาย (ผู้เรียกยังได้รับ error จาก run)
  return run;
}

export function flushPostureLog() {
  writeQueue = writeQueue.then(async () => {
    const keys = Object.keys(pending);
    if (keys.length === 0) return;

    // ย้ายออกจาก pending ก่อน เผื่อมีค่าใหม่เข้ามาระหว่างที่กำลังเขียน
    const snapshot = {};
    keys.forEach((k) => {
      snapshot[k] = pending[k];
      delete pending[k];
    });

    try {
      for (const k of keys) {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + k);
        let stored = emptyDay();
        if (raw) {
          try {
            stored = { ...emptyDay(), ...JSON.parse(raw) };
          } catch (e) {
            // ข้อมูลของวันนั้นเสีย เริ่มนับใหม่
          }
        }
        mergeInto(stored, snapshot[k]);
        await AsyncStorage.setItem(KEY_PREFIX + k, JSON.stringify(stored));
        delete snapshot[k];
      }
    } catch (e) {
      // เขียนไม่สำเร็จ: คืนค่าที่ยังไม่ได้เขียนกลับไปรอรอบถัดไป ไม่ให้ข้อมูลหาย
      Object.keys(snapshot).forEach((k) => {
        mergeInto(pending[k] || (pending[k] = emptyDay()), snapshot[k]);
      });
    }
  });
  return writeQueue;
}

// อ่านข้อมูลจริงมาสร้างชุดข้อมูลกราฟ (รวมค่าที่ยังไม่ได้เขียนลงดิสก์ด้วย)
// อ่านข้อมูลรายวันตาม key ที่ต้องการ รวมค่าที่ยังไม่ได้เขียนลงดิสก์ด้วย
async function readRecords(keys) {
  const pairs = await AsyncStorage.multiGet(keys.map((k) => KEY_PREFIX + k));

  const recordsByKey = {};
  pairs.forEach(([, value], i) => {
    if (!value) return;
    try {
      recordsByKey[keys[i]] = JSON.parse(value);
    } catch (e) {
      // ข้ามข้อมูลที่เสีย
    }
  });

  Object.keys(pending).forEach((k) => {
    if (!keys.includes(k)) return;
    const merged = { ...emptyDay(), ...(recordsByKey[k] || {}) };
    mergeInto(merged, pending[k]);
    recordsByKey[k] = merged;
  });

  return recordsByKey;
}

// range: '1d' (วันนี้) | '7d' (7 วันล่าสุด) | 'mtd' (ต้นเดือนถึงวันนี้)
export async function loadSeries(range, today = new Date()) {
  const recordsByKey = await readRecords(keysNeeded(range, today));
  return buildSeries(range, recordsByKey, today);
}

// จำนวนวันดีติดต่อกัน (streak) จากข้อมูลจริง: โหลดย้อนหลัง 30 วันก่อน ถ้าดีเกือบเต็มช่วงจึงขยายเป็น 400 วัน
export async function loadStreak(today = new Date()) {
  let days = 30;
  for (;;) {
    const streak = computeStreak(await readRecords(keysForLastDays(days, today)), today);
    if (streak < days - 1 || days >= 400) return streak;
    days = 400;
  }
}
