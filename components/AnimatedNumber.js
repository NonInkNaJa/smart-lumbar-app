import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { SCORE_ANIMATION_MS } from '../config';
import { valueAtProgress } from '../utils/animation';
import { useReduceMotion } from './motion';

const raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const caf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

// ตัวเลขที่นับขึ้น/ลงแบบ smooth เวลาค่าเปลี่ยน (แทนการเปลี่ยนกระทันหัน)
// - value เป็น null = ยังไม่มีค่า แสดง nullText; พอมีค่าครั้งแรกจะนับขึ้นจาก 0
// - ค่าเปลี่ยนกลางทาง: นับต่อจากตัวเลขที่เห็นอยู่ตอนนั้น (ไม่กระโดดกลับ)
// - เครื่องเปิด "ลดการเคลื่อนไหว": เปลี่ยนทันที
export function AnimatedNumber({ value, format = String, nullText = '--', style }) {
  const reduceMotion = useReduceMotion();
  const [display, setDisplay] = useState(value);
  const shownRef = useRef(value); // ตัวเลขที่แสดงอยู่ล่าสุด
  const frameRef = useRef(null);

  useEffect(() => {
    const cancel = () => {
      if (frameRef.current !== null) caf(frameRef.current);
      frameRef.current = null;
    };
    cancel();

    if (value === null || value === undefined || !Number.isFinite(value)) {
      shownRef.current = null;
      setDisplay(null);
      return cancel;
    }

    const from = shownRef.current === null || shownRef.current === undefined ? 0 : shownRef.current;
    const duration = reduceMotion ? 0 : SCORE_ANIMATION_MS;
    if (duration <= 0 || from === value) {
      shownRef.current = value;
      setDisplay(value);
      return cancel;
    }

    const startedAt = Date.now();
    const step = () => {
      const progress = (Date.now() - startedAt) / duration;
      const v = valueAtProgress(from, value, progress);
      shownRef.current = v;
      setDisplay(v);
      frameRef.current = progress < 1 ? raf(step) : null;
    };
    frameRef.current = raf(step); // เฟรมแรกเริ่มในรอบถัดไป: ระหว่างนี้ยังโชว์ตัวเลขเดิม
    return cancel;
  }, [value, reduceMotion]);

  return <Text style={style}>{display === null || display === undefined ? nullText : format(display)}</Text>;
}
