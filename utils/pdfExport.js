// ขั้นตอนส่งออกรายงาน PDF แยกออกมาให้ "เห็นข้อผิดพลาดจริง" และไม่ค้างเงียบ
//   1) check  : เครื่องแชร์ไฟล์ได้ไหม (มีเวลาจำกัด)
//   2) render : สร้างไฟล์ PDF ด้วย expo-print (มีเวลาจำกัด ถ้าค้างจะหมดเวลาแล้วรายงานเป็น error แทนการเงียบ)
//              ลองแบบเต็มก่อน ถ้าไม่สำเร็จลองแบบเรียบง่าย (HTML/CSS น้อยที่สุด) เผื่อปัญหามาจากเนื้อหารายงาน
//   3) share  : เปิดหน้าต่างแชร์ของระบบ (ไม่จำกัดเวลา เพราะผู้ใช้เปิดหน้าต่างค้างไว้ได้)
// รับ print/sharing เข้ามาเป็นพารามิเตอร์ (ทดสอบด้วยตัวจำลองได้) และเขียน log ขึ้นต้น "[PDF]" ให้ดูใน logcat ได้ (adb logcat -s ReactNativeJS)

export const PDF_STEPS = {
  check: 'ตรวจสอบว่าเครื่องแชร์ไฟล์ได้',
  render: 'สร้างไฟล์ PDF',
  renderSimple: 'สร้างไฟล์ PDF (แบบเรียบง่าย)',
  share: 'เปิดหน้าต่างแชร์',
};

export class PdfExportError extends Error {
  constructor(step, code, message, attempts = []) {
    super(message);
    this.name = 'PdfExportError';
    this.step = step; // คีย์ใน PDF_STEPS
    this.code = code; // เช่น TIMEOUT, UNAVAILABLE, MODULE_MISSING, หรือรหัสจาก native (ERR_...)
    this.attempts = attempts; // ผลแต่ละครั้งที่พยายามสร้างไฟล์: [{ name, ok, code, message, ms }]
  }
}

// รอ promise แต่ไม่เกิน ms มิลลิวินาที หมดเวลา = reject ด้วย code 'TIMEOUT'
function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const codeOf = (e) => (e && (e.code || e.name)) || 'UNKNOWN';
const messageOf = (e) => String((e && e.message) || e || 'ไม่ทราบสาเหตุ');

// variants: [{ key: 'render' | 'renderSimple', html }] เรียงจากที่อยากได้มากสุด; options: { width, height } ของหน้ากระดาษ
export async function exportPdf({ variants, page, print, sharing, timeouts, onStep = () => {}, log = () => {}, now = Date.now, dialogTitle }) {
  const step = (key) => {
    log(`[PDF] step=${key}`);
    onStep(key);
  };

  // 1) ตรวจว่าใช้งานได้
  step('check');
  if (!print || typeof print.printToFileAsync !== 'function') {
    throw new PdfExportError('check', 'MODULE_MISSING', 'ไม่พบ expo-print ในแอปนี้ (ต้อง build แอปใหม่หลังติดตั้งแพ็กเกจ)');
  }
  if (!sharing || typeof sharing.shareAsync !== 'function') {
    throw new PdfExportError('check', 'MODULE_MISSING', 'ไม่พบ expo-sharing ในแอปนี้');
  }
  let available;
  try {
    available = await withTimeout(sharing.isAvailableAsync(), timeouts.check, () => new PdfExportError('check', 'TIMEOUT', `ตรวจการแชร์ไม่ตอบภายใน ${timeouts.check / 1000} วินาที`));
  } catch (e) {
    if (e instanceof PdfExportError) throw e;
    throw new PdfExportError('check', codeOf(e), messageOf(e));
  }
  if (!available) throw new PdfExportError('check', 'UNAVAILABLE', 'อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');

  // 2) สร้างไฟล์ PDF: ลองทีละแบบจนกว่าจะสำเร็จ
  const attempts = [];
  let uri = null;
  for (const variant of variants) {
    step(variant.key);
    const started = now();
    const limit = variant.key === 'render' ? timeouts.render : timeouts.renderSimple;
    log(`[PDF] render variant=${variant.key} htmlLength=${variant.html.length} timeoutMs=${limit}`);
    try {
      const result = await withTimeout(
        print.printToFileAsync({ html: variant.html, width: page.width, height: page.height }),
        limit,
        () => new PdfExportError(variant.key, 'TIMEOUT', `สร้างไฟล์ไม่เสร็จภายใน ${limit / 1000} วินาที`)
      );
      if (!result || typeof result.uri !== 'string' || !result.uri) {
        throw new PdfExportError(variant.key, 'NO_URI', 'expo-print ไม่ได้ส่งที่อยู่ไฟล์กลับมา');
      }
      attempts.push({ name: variant.key, ok: true, ms: now() - started });
      log(`[PDF] render ok variant=${variant.key} uri=${result.uri} pages=${result.numberOfPages} ms=${now() - started}`);
      uri = result.uri;
      break;
    } catch (e) {
      const failure = { name: variant.key, ok: false, code: codeOf(e), message: messageOf(e), ms: now() - started };
      attempts.push(failure);
      log(`[PDF] render failed variant=${variant.key} code=${failure.code} message=${failure.message}`);
    }
  }
  if (uri === null) {
    const last = attempts[attempts.length - 1];
    throw new PdfExportError(last.name, last.code, last.message, attempts);
  }

  // 3) เปิดหน้าต่างแชร์
  step('share');
  try {
    await sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } catch (e) {
    log(`[PDF] share failed code=${codeOf(e)} message=${messageOf(e)}`);
    throw new PdfExportError('share', codeOf(e), messageOf(e), attempts);
  }
  log('[PDF] done');
  return { uri, attempts };
}

// ข้อความอธิบายข้อผิดพลาดสำหรับผู้ใช้/ผู้พัฒนา (ขั้นตอน + รหัส + ข้อความ + ผลของแต่ละครั้งที่ลอง)
export function describePdfError(e) {
  if (!(e instanceof PdfExportError)) return `ข้อผิดพลาดที่ไม่คาดคิด: ${messageOf(e)}`.slice(0, 400);
  let text = `ขั้นตอน: ${PDF_STEPS[e.step] || e.step}\nรหัส: ${e.code}\n${e.message}`;
  if (e.attempts.length > 1) {
    text += '\nที่ลองแล้ว: ' + e.attempts.map((a) => `${PDF_STEPS[a.name] || a.name} ${a.ok ? 'สำเร็จ' : 'ไม่สำเร็จ (' + a.code + ')'}`).join(', ');
  }
  return text.slice(0, 500);
}
