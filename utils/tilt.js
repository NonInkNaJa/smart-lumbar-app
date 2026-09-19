// แปลงค่าที่เฟิร์มแวร์ส่งมา (base64 ของข้อความ "pitch,roll" เช่น "12.3,-4.5")
// react-native-ble-plx ส่ง characteristic.value มาเป็น base64 เสมอ
export function parseTiltPayload(base64Value) {
  if (!base64Value) return null;

  let text;
  try {
    text = atob(base64Value);
  } catch (e) {
    return null;
  }

  const parts = text.split(',');
  if (parts.length !== 2) return null;

  const pitch = parseFloat(parts[0]);
  const roll = parseFloat(parts[1]);
  if (!Number.isFinite(pitch) || !Number.isFinite(roll)) return null;

  return { pitch, roll };
}
