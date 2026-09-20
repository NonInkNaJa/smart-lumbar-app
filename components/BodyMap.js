import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { PAIN_REGIONS } from '../utils/painLog';
import { BounceTouchable } from './motion';
import { useTheme } from './theme';
import { COLORS } from './ui';

const SELECTED_FILL = COLORS.red;

// ภาพร่างกายด้านหลังแบบง่าย: แตะจุดที่รู้สึกปวด (แตะอีกครั้งเพื่อยกเลิก)
// selected = อาร์เรย์ของ key จุดที่เลือก; onToggle(key) = สลับจุดนั้น
// มีปุ่มชื่อจุดใต้ภาพด้วย: แตะง่ายกว่าบนจอเล็ก และเป็นทางเลือกสำหรับผู้ที่แตะภาพยาก
export function BodyMap({ selected, onToggle, disabled = false }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const on = (key) => selected.includes(key);
  const fill = (key) => (on(key) ? SELECTED_FILL : theme.surface2);
  const textFill = (key) => (on(key) ? '#FFFFFF' : theme.text2);
  const press = (key) => (disabled ? undefined : () => onToggle(key));
  const shape = { stroke: theme.border, strokeWidth: 1.5 };
  const body = { fill: theme.barEmpty, opacity: 0.6 }; // ส่วนที่แตะไม่ได้ (หัว แขน ขา) เป็นเงาจางๆ ให้เห็นรูปร่าง
  const label = { fontSize: 11, fontWeight: 'bold', textAnchor: 'middle', pointerEvents: 'none' };

  return (
    <View style={styles.wrap}>
      <Svg width={240} height={348} viewBox="0 0 200 290" accessibilityLabel="ภาพร่างกายด้านหลัง แตะจุดที่ปวด">
        {/* ส่วนที่แตะไม่ได้ */}
        <Circle cx={100} cy={30} r={22} {...body} />
        <Rect x={22} y={98} width={16} height={96} rx={8} {...body} />
        <Rect x={162} y={98} width={16} height={96} rx={8} {...body} />
        <Rect x={74} y={248} width={22} height={40} rx={10} {...body} />
        <Rect x={104} y={248} width={22} height={40} rx={10} {...body} />

        {/* จุดที่แตะได้ (ตัวอักษรไม่รับการแตะ ปล่อยให้ผ่านไปที่รูปข้างใต้) */}
        <Rect testID="body-neck" x={84} y={50} width={32} height={26} rx={8} fill={fill('neck')} {...shape} onPress={press('neck')} />
        <Polygon testID="body-shoulders-left" points="84,76 42,82 28,104 66,102" fill={fill('shoulders')} {...shape} onPress={press('shoulders')} />
        <Polygon testID="body-shoulders-right" points="116,76 158,82 172,104 134,102" fill={fill('shoulders')} {...shape} onPress={press('shoulders')} />
        <Rect testID="body-upper_back" x={66} y={102} width={68} height={54} rx={12} fill={fill('upper_back')} {...shape} onPress={press('upper_back')} />
        <Rect testID="body-lower_back" x={68} y={158} width={64} height={48} rx={12} fill={fill('lower_back')} {...shape} onPress={press('lower_back')} />
        <Rect testID="body-hips" x={62} y={208} width={76} height={40} rx={14} fill={fill('hips')} {...shape} onPress={press('hips')} />

        <SvgText x={100} y={67} fill={textFill('neck')} {...label}>คอ</SvgText>
        <SvgText x={50} y={94} fill={textFill('shoulders')} {...label}>บ่า</SvgText>
        <SvgText x={150} y={94} fill={textFill('shoulders')} {...label}>บ่า</SvgText>
        <SvgText x={100} y={133} fill={textFill('upper_back')} {...label}>หลังบน</SvgText>
        <SvgText x={100} y={186} fill={textFill('lower_back')} {...label}>หลังล่าง</SvgText>
        <SvgText x={100} y={232} fill={textFill('hips')} {...label}>สะโพก</SvgText>
      </Svg>

      <View style={styles.chips}>
        {PAIN_REGIONS.map((r) => (
          <BounceTouchable
            key={r.key}
            style={[styles.chip, on(r.key) && styles.chipOn]}
            onPress={press(r.key)}
            disabled={disabled}
            accessibilityLabel={`จุดที่ปวด: ${r.label}`}
            accessibilityState={{ selected: on(r.key) }}
          >
            <Text style={[styles.chipText, on(r.key) && styles.chipTextOn]}>{r.label}</Text>
          </BounceTouchable>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.surface2, margin: 4 },
    chipOn: { backgroundColor: COLORS.red },
    chipText: { fontSize: 14, fontWeight: '600', color: t.text2 },
    chipTextOn: { color: '#FFFFFF' },
  });
