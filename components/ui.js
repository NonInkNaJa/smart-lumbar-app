import React, { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { useTheme } from './theme';

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
    screenSubtitle: { fontSize: 14, color: t.muted, textAlign: 'center' },
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

export function Card({ children, style }) {
  const styles = useUiStyles();
  return <View style={[styles.card, style]}>{children}</View>;
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
    <TouchableOpacity
      style={[styles.button, { backgroundColor: disabled ? '#9CA3AF' : color }, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
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
