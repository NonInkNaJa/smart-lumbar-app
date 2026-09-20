import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert } from 'lucide-react-native';
import { CARD_FADE_MS, CARD_STAGGER_MS } from '../config';
import { useTheme } from './theme';
import { BounceTouchable } from './motion';
import { getBackgroundImage } from '../utils/images';

// สีสื่อความหมาย (ไม่เปลี่ยนตามโหมดสว่าง/มืด) ส่วนสีพื้นหลัง/ข้อความอยู่ใน components/theme.js
export const COLORS = {
  blue: '#2563EB',
  green: '#10B981',
  red: '#EF4444',
  purple: '#7C3AED',
  slate: '#475569',
  amber: '#F59E0B',
  orange: '#F97316',
};

const makeStyles = (t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20 },
    bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
    bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bgOverlay },
    badge: {
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
    },
    card: { backgroundColor: t.card, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 18, fontWeight: '600', marginLeft: 10, color: t.text2, flexShrink: 1 },
    cardTitleNoIcon: { marginLeft: 0 },
    screenTitleWrap: { marginBottom: 20 },
    screenTitle: { fontSize: 28, fontWeight: 'bold', color: t.text, textAlign: 'center' },
    // ข้อความรองอยู่บนรูปพื้นหลังโดยตรง (ไม่มีการ์ดรอง) ใช้สีเข้มกว่า muted เพราะพื้นเขียวอ่อนทำให้ muted เหลือความคมชัดแค่ ~3.5 (ต่ำกว่าเกณฑ์ 4.5)
    screenSubtitle: { fontSize: 14, color: t.text2, textAlign: 'center' },
    button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
    alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.alertBg, padding: 10, borderRadius: 8, marginTop: 10 },
    alertText: { color: t.alertText, marginLeft: 8, fontWeight: '500', flexShrink: 1 },
  });

// สไตล์ที่คำนวณตามธีมปัจจุบัน (เก็บผลไว้ ไม่สร้างใหม่ทุกครั้งที่วาด)
export function useUiStyles() {
  const t = useTheme();
  return useMemo(() => makeStyles(t), [t]);
}

// สไตล์พื้นฐานของหน้าจอ: { container, scrollContent }
export function useScreenStyles() {
  return useUiStyles();
}

// กรอบหน้าจอมาตรฐานของทุกหน้า: รูปพื้นหลัง (ครอบเต็มจอ อยู่หลังสุด) + ชั้นเคลือบตามธีม แล้วค่อยเป็นเนื้อหา
export function Screen({ children }) {
  const styles = useUiStyles();
  const t = useTheme();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Image source={getBackgroundImage(t.isDark)} style={styles.bgImage} resizeMode="cover" accessible={false} />
      <View style={styles.bgOverlay} />
      {children}
    </SafeAreaView>
  );
}

// ไอคอนในกรอบสี (badge) มีเงา ดูมีมิติ; active=false จะเป็นสีเทา (ใช้กับแท็บที่ไม่ได้เลือก)
export function IconBadge({ Icon, color = COLORS.blue, size = 20, box = 36, active = true }) {
  const t = useTheme();
  const styles = useUiStyles();
  return (
    <View
      style={[
        styles.badge,
        {
          width: box,
          height: box,
          borderRadius: box * 0.32,
          backgroundColor: active ? color : t.surface2,
          shadowColor: color,
          elevation: active ? 4 : 0,
          shadowOpacity: active ? 0.35 : 0,
        },
      ]}
    >
      <Icon color={active ? '#FFFFFF' : t.faint} size={size} />
    </View>
  );
}

// index = ลำดับของการ์ดในหน้า: ใบถัดไปเริ่มขึ้นช้ากว่าใบก่อนเล็กน้อย (fade-in ไล่ทีละใบตอนโหลดหน้า)
export function Card({ children, style, index = 0 }) {
  const styles = useUiStyles();
  return (
    <Animated.View entering={FadeInDown.duration(CARD_FADE_MS).delay(index * CARD_STAGGER_MS)} style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

export function CardHeader({ Icon, color, title }) {
  const styles = useUiStyles();
  return (
    <View style={styles.cardHeader}>
      {Icon ? <IconBadge Icon={Icon} color={color} /> : null}
      <Text style={[styles.cardTitle, !Icon && styles.cardTitleNoIcon]}>{title}</Text>
    </View>
  );
}

export function ScreenTitle({ title, subtitle }) {
  const styles = useUiStyles();
  return (
    <View style={styles.screenTitleWrap}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, color = COLORS.blue, disabled = false, style }) {
  const styles = useUiStyles();
  return (
    <BounceTouchable
      style={[styles.button, { backgroundColor: disabled ? '#9CA3AF' : color }, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </BounceTouchable>
  );
}

export function AlertBox({ text }) {
  const t = useTheme();
  const styles = useUiStyles();
  return (
    <View style={styles.alertBox}>
      <ShieldAlert color={t.alertText} size={20} />
      <Text style={styles.alertText}>{text}</Text>
    </View>
  );
}
