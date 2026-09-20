import { requireOptionalNativeModule } from 'expo-modules-core';

// native module (Kotlin) ของวิดเจ็ตหน้าจอหลัก; เป็น null ถ้าแอปนี้ไม่มีโมดูล (Expo Go, เว็บ, APK รุ่นเก่า)
// ห้ามเรียกตรงๆ ให้ผ่าน utils/homeWidget.js ซึ่งดัก error ทุกกรณี
export default requireOptionalNativeModule('BeltWidget');
