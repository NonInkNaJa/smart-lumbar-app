// สูตร animation ตัวเลข (ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมีหน้าจอ)

// เริ่มเร็วแล้วค่อยๆ ช้าลงจนหยุดนิ่ง (นับได้ลื่นตา ไม่กระตุกตอนจบ)
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ค่าตัวเลข ณ ความคืบหน้า progress (0-1) ระหว่าง from -> to ปัดเป็นจำนวนเต็มเสมอ
// progress ≥ 1 ได้ค่าปลายทางเป๊ะ (ไม่เพี้ยนจากการปัดเศษ)
export function valueAtProgress(from, to, progress) {
  if (!(progress > 0)) return Math.round(from);
  if (progress >= 1) return Math.round(to);
  return Math.round(from + (to - from) * easeOutCubic(progress));
}
