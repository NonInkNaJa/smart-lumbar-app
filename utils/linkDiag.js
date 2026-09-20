import AsyncStorage from '@react-native-async-storage/async-storage';

// บันทึกประวัติการเชื่อมต่อเข็มขัดเพื่อหาสาเหตุที่หลุด (แอปเดิมไม่เคยเก็บสาเหตุไว้เลย)
//   drop      = สายหลุดเอง (พร้อมรหัสสาเหตุจากระบบ + เชื่อมต่อมานานเท่าไหร่)
//   recovered = ต่อใหม่ได้เอง
//   gaveup    = ต่อใหม่ไม่ได้ภายในเวลาที่กำหนด
//   appclosed = เปิดแอปครั้งถัดมาแล้วพบว่ารอบก่อนไม่ได้ตัดการเชื่อมต่อตามปกติ = แอปถูกระบบ/ผู้ใช้ปิดขณะกำลังเชื่อมต่อ (แยกจาก "สายหลุด")
// เก็บสูงสุด MAX_EVENTS รายการล่าสุด; ทุกฟังก์ชันไม่โยน error (ล้มเหลวเงียบๆ แค่ไม่มีประวัติ)

const KEY = 'belt-link-diag';
export const MAX_LINK_EVENTS = 20;

// รหัส GATT status ของ Android ที่พบบ่อยตอนหลุด
const ANDROID_REASONS = {
  8: 'หมดเวลาการเชื่อมต่อ (สัญญาณหาย/อยู่ไกล/มือถือประหยัดพลังงาน)',
  19: 'เข็มขัดเป็นฝ่ายตัด (ไฟเลี้ยงดับ/รีเซ็ต)',
  22: 'มือถือเป็นฝ่ายตัดเอง',
  34: 'ลิงก์ Bluetooth หมดเวลา',
  62: 'ต่อไม่สำเร็จ',
  133: 'ข้อผิดพลาดทั่วไปของ Bluetooth',
};

// error = BleError จาก react-native-ble-plx (onDisconnected ส่งมาเมื่อหลุดเอง) หรือ null/undefined
export function describeDisconnect(error) {
  if (!error) return { code: 'NONE', androidCode: null, text: 'ไม่ทราบสาเหตุ (ระบบไม่ส่งรหัสมา)' };
  const androidCode = Number.isInteger(error.androidErrorCode) ? error.androidErrorCode : null;
  const code = String(error.errorCode !== undefined && error.errorCode !== null ? error.errorCode : error.code || 'UNKNOWN');
  const detail = androidCode !== null ? `GATT ${androidCode}` : `รหัส ${code}`;
  const reason = androidCode !== null ? ANDROID_REASONS[androidCode] : undefined;
  if (reason) return { code, androidCode, text: `${reason} [${detail}]` };
  const message = error.message ? ` ${String(error.message).slice(0, 60)}` : '';
  return { code, androidCode, text: `ไม่ทราบสาเหตุ [${detail}]${message}` };
}

const KIND_LABEL = {
  drop: 'หลุดการเชื่อมต่อ',
  recovered: 'ต่อใหม่ได้แล้ว',
  gaveup: 'ต่อใหม่ไม่ได้',
  appclosed: 'แอปถูกปิดขณะเชื่อมต่ออยู่',
};

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (ms) => {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '--:--' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ข้อความหนึ่งบรรทัดสำหรับแสดงในหน้าตั้งค่า เช่น "14:32 หลุดการเชื่อมต่อ (เชื่อมต่อมา 23 นาที) — หมดเวลา…"
export function formatLinkEvent(event) {
  if (!event || !KIND_LABEL[event.kind]) return '';
  const minutes = Math.floor((Number(event.afterMs) || 0) / 60000);
  const after = event.kind === 'drop' && minutes >= 0 ? ` (เชื่อมต่อมา ${minutes} นาที)` : event.kind === 'recovered' ? ` (ขาดไป ${Math.max(0, Math.round((Number(event.afterMs) || 0) / 1000))} วินาที)` : '';
  const text = event.text ? ` — ${event.text}` : '';
  return `${hhmm(event.at)} ${KIND_LABEL[event.kind]}${after}${text}`;
}

const emptyDiag = () => ({ events: [], session: { open: false, startedAt: 0, lastDataAt: 0 } });
const validEvent = (e) => e && typeof e === 'object' && KIND_LABEL[e.kind] && Number.isFinite(e.at);

function parseDiag(raw) {
  try {
    const v = JSON.parse(raw);
    const s = v && v.session && typeof v.session === 'object' ? v.session : {};
    return {
      events: Array.isArray(v && v.events) ? v.events.filter(validEvent).slice(-MAX_LINK_EVENTS) : [],
      session: { open: s.open === true, startedAt: Number(s.startedAt) || 0, lastDataAt: Number(s.lastDataAt) || 0 },
    };
  } catch (e) {
    return emptyDiag();
  }
}

export async function loadLinkDiag() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? parseDiag(raw) : emptyDiag();
  } catch (e) {
    return emptyDiag();
  }
}

// เขียนทีละคำสั่งตามลำดับ (อ่าน-แก้-เขียน) กันสองคำสั่งซ้อนกันแล้วทับกัน
let queue = Promise.resolve();
function update(fn) {
  const run = queue.then(async () => {
    const next = fn(await loadLinkDiag());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  queue = run.catch(() => {});
  return run.catch((e) => {
    console.log('บันทึกประวัติการเชื่อมต่อไม่สำเร็จ', e);
    return null;
  });
}

export function recordLinkEvent(event) {
  return update((d) => ({ ...d, events: [...d.events, event].slice(-MAX_LINK_EVENTS) }));
}

// session.open = true ระหว่างที่อยู่ในรอบการเชื่อมต่อ (ตัดการเชื่อมต่อตามปกติ/ต่อใหม่ไม่ได้ = false); lastDataAt = ข้อมูลเข็มขัดล่าสุด
export function setLinkSession(patch) {
  return update((d) => ({ ...d, session: { ...d.session, ...patch } }));
}

// เรียกตอนเปิดแอป: ถ้ารอบก่อนยังเปิดค้างอยู่ = แอปถูกปิดขณะกำลังเชื่อมต่อ บันทึกเป็นเหตุการณ์ appclosed แล้วปิดรอบนั้น
export function checkAbandonedSession(now = Date.now()) {
  return update((d) => {
    if (!d.session.open) return d;
    const event = {
      at: now,
      kind: 'appclosed',
      afterMs: Math.max(0, d.session.lastDataAt - d.session.startedAt),
      text: d.session.lastDataAt > 0 ? `ได้รับข้อมูลเข็มขัดครั้งสุดท้ายเวลา ${hhmm(d.session.lastDataAt)}` : 'ไม่ทราบเวลาข้อมูลสุดท้าย',
    };
    return { events: [...d.events, event].slice(-MAX_LINK_EVENTS), session: { open: false, startedAt: 0, lastDataAt: 0 } };
  });
}
