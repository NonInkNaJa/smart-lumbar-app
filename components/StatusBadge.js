import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BluetoothOff, CircleCheck, CirclePause, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react-native';
import { useBelt } from '../context/BeltContext';
import { useTheme } from './theme';

const ICONS = { good: CircleCheck, warn: TriangleAlert, bad: ShieldAlert, idle: BluetoothOff, paused: CirclePause, reconnecting: RefreshCw };

// ป้ายสถานะภาพรวมบนสุดของหน้า Home: เขียว "ท่านั่งดี" / เหลือง "ควรระวัง" / แดง "ควรปรับท่า" / เทา (ยังไม่ได้เชื่อมต่อ, หยุดตรวจ)
// พื้นตามธีม + ขอบ/ไอคอนสีสถานะ อ่านชัดทั้งโหมดสว่าง/มืด
export function StatusBadge() {
  const { overallStatus } = useBelt();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Icon = ICONS[overallStatus.key];

  return (
    <View
      style={[styles.pill, { borderColor: overallStatus.color }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`สถานะโดยรวม: ${overallStatus.label}`}
    >
      <Icon color={overallStatus.color} size={20} />
      <Text style={styles.label}>{overallStatus.label}</Text>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      borderWidth: 2,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: -8,
      marginBottom: 16,
      elevation: 2,
    },
    label: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: t.text },
  });
