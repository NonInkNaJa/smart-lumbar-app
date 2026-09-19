import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';

export const COLORS = {
  blue: '#2563EB',
  green: '#10B981',
  red: '#EF4444',
  purple: '#7C3AED',
  slate: '#475569',
  amber: '#F59E0B',
  bg: '#F3F4F6',
};

// ไอคอนในกรอบสี (badge) มีเงา ดูมีมิติ; active=false จะเป็นสีเทาอ่อน (ใช้กับแท็บที่ไม่ได้เลือก)
export function IconBadge({ Icon, color = COLORS.blue, size = 20, box = 36, active = true }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: box,
          height: box,
          borderRadius: box * 0.32,
          backgroundColor: active ? color : '#E5E7EB',
          shadowColor: color,
          elevation: active ? 4 : 0,
          shadowOpacity: active ? 0.35 : 0,
        },
      ]}
    >
      <Icon color={active ? '#FFFFFF' : '#9CA3AF'} size={size} />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardHeader({ Icon, color, title }) {
  return (
    <View style={styles.cardHeader}>
      {Icon ? <IconBadge Icon={Icon} color={color} /> : null}
      <Text style={[styles.cardTitle, !Icon && styles.cardTitleNoIcon]}>{title}</Text>
    </View>
  );
}

export function ScreenTitle({ title, subtitle }) {
  return (
    <View style={styles.screenTitleWrap}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, color = COLORS.blue, disabled = false, style }) {
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
  return (
    <View style={styles.alertBox}>
      <ShieldAlert color={COLORS.red} size={20} />
      <Text style={styles.alertText}>{text}</Text>
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 20 },
});

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginLeft: 10, color: '#374151', flexShrink: 1 },
  cardTitleNoIcon: { marginLeft: 0 },
  screenTitleWrap: { marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  screenSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginTop: 10 },
  alertText: { color: COLORS.red, marginLeft: 8, fontWeight: '500', flexShrink: 1 },
});
