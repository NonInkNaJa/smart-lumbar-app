import React from 'react';
import { Image, View } from 'react-native';
import { MASCOT_IMAGE } from '../utils/images';

// รูปมาสคอตต้นฉบับเป็นภาพแนวนอน 1408x768 พื้นครีม (ไม่โปร่งใส) ตัวการ์ตูนอยู่กลางภาพและเล็ก
// จึงครอปเป็นวงกลมเฉพาะตัวมาสคอต (พิกัดเป็นพิกเซลของภาพต้นฉบับ: ศูนย์กลาง cx,cy รัศมี r ที่คลุมทั้งตัวรวมผ้าคลุมและเท้า)
const SRC_W = 1408;
const SRC_H = 768;
const CROP = { cx: 716, cy: 380, r: 330 };

export function Mascot({ size = 132 }) {
  const k = size / (2 * CROP.r); // อัตราย่อ (เท่ากันทั้งสองแกน ภาพไม่บิดเบี้ยว)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignSelf: 'center',
        marginBottom: 12,
        backgroundColor: '#F6F6F2', // เท่าสีพื้นของรูป
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <Image
        source={MASCOT_IMAGE}
        accessibilityLabel="มาสคอตหลังเทพ"
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: SRC_W * k,
          height: SRC_H * k,
          left: -(CROP.cx - CROP.r) * k,
          top: -(CROP.cy - CROP.r) * k,
        }}
      />
    </View>
  );
}
