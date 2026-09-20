import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getMascotImage, getMascotVariant } from '../utils/images';
import { getMascotMood } from '../utils/mascotMoods';
import { useTheme } from './theme';

// รูปมาสคอตต้นฉบับเป็นภาพแนวนอน 1408x768 พื้นครีม (ไม่โปร่งใส) ตัวการ์ตูนอยู่กลางภาพและเล็ก
// จึงครอปเป็นวงกลมเฉพาะตัวมาสคอต (จุดครอปของแต่ละตัวอยู่ที่ MASCOT_VARIANTS ใน utils/images.js)
const SRC_W = 1408;
const SRC_H = 768;
const RING = 4; // ความหนาขอบวงกลม (สีตามระดับ)

// มาสคอต: เด้งเบาๆ ตลอดเวลา (idle animation) และเปลี่ยนท่าทางตามระดับ (tier) ของคะแนนความพร้อม
// character = 'spine' (ตัวกระดูกสันหลัง หน้า Home) | 'heart' (ตัวหัวใจ หน้าประวัติ/เกี่ยวกับแอป)
export function Mascot({ tier = 'no-data', size = 132, character = 'spine' }) {
  const mood = getMascotMood(tier);
  const variant = getMascotVariant(character);
  const CROP = variant.crop;
  const theme = useTheme();
  const lift = useSharedValue(0);
  const tilt = useSharedValue(mood.tilt);

  // เริ่มเด้งวนไม่รู้จบ; ระดับเปลี่ยน -> หยุดของเดิมแล้วเริ่มจังหวะใหม่
  useEffect(() => {
    cancelAnimation(lift);
    lift.value = 0;
    lift.value = withRepeat(
      withSequence(
        withTiming(-mood.bounceHeight, { duration: mood.bounceMs / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: mood.bounceMs / 2, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
    tilt.value = withTiming(mood.tilt, { duration: 400 });
    return () => cancelAnimation(lift);
  }, [mood.bounceHeight, mood.bounceMs, mood.tilt]);

  const moveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { rotate: `${tilt.value}deg` }],
  }));

  const inner = size - 2 * RING; // พื้นที่ใน (ขอบกินพื้นที่ด้านใน)
  const k = inner / (2 * CROP.r); // อัตราย่อ (เท่ากันทั้งสองแกน ภาพไม่บิดเบี้ยว)

  return (
    <View style={{ alignSelf: 'center', width: size + 32, alignItems: 'center', marginBottom: 12 }}>
      <Animated.View style={[{ width: size, height: size }, moveStyle]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: RING,
            borderColor: mood.ring,
            overflow: 'hidden',
            backgroundColor: '#F6F6F2', // เท่าสีพื้นของรูป
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Image
            source={character === 'heart' ? variant.image : getMascotImage(tier)}
            accessibilityLabel={`มาสคอต${variant.label} (${mood.label})`}
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
        {/* ป้ายอารมณ์ข้างหัว (มุมขวาบน) */}
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -14,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.card, // ตามโหมดสว่าง/มืด
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 5,
            borderWidth: 2,
            borderColor: mood.ring,
          }}
        >
          <Text style={{ fontSize: 18 }}>{mood.emoji}</Text>
        </View>
        {/* หยดเหงื่อ (เฉพาะตอนเป็นห่วง) มุมซ้ายบน */}
        {mood.extra ? <Text style={{ position: 'absolute', top: 2, left: -8, fontSize: 22 }}>{mood.extra}</Text> : null}
      </Animated.View>
    </View>
  );
}
