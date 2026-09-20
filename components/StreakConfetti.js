import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { STREAK_CONFETTI_COUNT, STREAK_CONFETTI_COLORS } from '../config';
import { useBelt } from '../context/BeltContext';
import { useReduceMotionStatus } from './motion';

// ชั้นฉลองเมื่อ streak เพิ่มเป็นวันใหม่: วางทับทั้งแอป (อยู่ระดับ root จึงเห็นได้ทุกแท็บ) กดทะลุได้
// ยิงจากกลางล่างของจอ พุ่งขึ้นแล้วร่วงลง; เล่นจบแล้วถอดออกจากจอ
// ผู้ใช้ที่เปิด "ลดการเคลื่อนไหว" ในเครื่องจะไม่เห็นเอฟเฟกต์นี้
export function StreakConfetti() {
  const { confettiKey } = useBelt();
  const reduceMotion = useReduceMotionStatus(); // รออ่านค่าให้เสร็จก่อนเสมอ กันชิ้นกระดาษวาบขึ้นมาในเครื่องที่ปิดการเคลื่อนไหว
  const { width } = useWindowDimensions();
  const [finishedKey, setFinishedKey] = useState(0); // confettiKey ล่าสุดที่เล่นจบแล้ว

  if (!confettiKey || reduceMotion !== false || finishedKey === confettiKey) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ConfettiCannon
        key={confettiKey}
        count={STREAK_CONFETTI_COUNT}
        origin={{ x: width / 2, y: 0 }}
        colors={STREAK_CONFETTI_COLORS}
        fadeOut
        onAnimationEnd={() => setFinishedKey(confettiKey)}
      />
    </View>
  );
}
