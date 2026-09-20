import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Animation พื้นฐานของแอป (ใช้ react-native-reanimated)
// หมายเหตุ: Reanimated เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของเครื่องอยู่แล้ว (ผู้ใช้ที่ปิด animation จะไม่เห็นการเด้ง/ค่อยๆ ขึ้น)

export const PRESS_SCALE = 0.94; // ตอนกดปุ่มจะยุบเหลือ 94%
export const PRESS_SPRING = { damping: 40, stiffness: 400 }; // ยุบลงเร็ว แน่น ไม่เด้ง (อัตราหน่วง = damping / (2*sqrt(stiffness*mass)) = 1 พอดี)
export const RELEASE_SPRING = { damping: 7, stiffness: 300, mass: 0.6 }; // ปล่อยแล้วเด้งกลับ: หน่วงน้อย = เลยจุด 100% เล็กน้อยแล้วนิ่ง (bounce เบาๆ)

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// เครื่องเปิด "ลดการเคลื่อนไหว" ไว้หรือไม่: null = ยังอ่านค่าไม่เสร็จ, true/false = ทราบแล้ว
// (ใช้กับ animation ที่เราเขียนเอง; ของ Reanimated เคารพค่านี้ให้อยู่แล้ว)
export function useReduceMotionStatus() {
  const [reduce, setReduce] = useState(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(!!v));
    return () => {
      alive = false;
      if (sub && sub.remove) sub.remove();
    };
  }, []);
  return reduce;
}

// แบบ true/false ล้วน (ยังอ่านไม่เสร็จนับเป็น false)
export function useReduceMotion() {
  return useReduceMotionStatus() === true;
}

// ใช้แทน TouchableOpacity ทุกปุ่มในแอป: หน้าตาและการทำงานเหมือนเดิม เพิ่มแค่การยุบ-เด้งตอนกด
// ปุ่มที่ disabled จะไม่ยุบ (ไม่ตอบสนอง)
export function BounceTouchable({ style, onPressIn, onPressOut, disabled, children, ...rest }) {
  const scale = useSharedValue(1);
  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      {...rest}
      disabled={disabled}
      style={[style, bounceStyle]}
      onPressIn={(e) => {
        if (!disabled) scale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
        if (onPressIn) onPressIn(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, RELEASE_SPRING);
        if (onPressOut) onPressOut(e);
      }}
    >
      {children}
    </AnimatedTouchable>
  );
}
