import { requireOptionalNativeModule } from 'expo-modules-core';

// ตัว native module (Kotlin) ของ foreground service; เป็น null ถ้าแอปนี้ไม่มีโมดูล (เช่น Expo Go, เว็บ, หรือ APK รุ่นเก่า)
// ห้ามเรียกใช้ตรงๆ ให้ผ่าน utils/backgroundService.js ซึ่งดัก error ทุกกรณี
export default requireOptionalNativeModule('BeltService');
