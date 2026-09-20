import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useBelt } from '../context/BeltContext';
import { useTheme } from './theme';
import { BounceTouchable } from './motion';
import { COLORS } from './ui';

// ข้อความสาเหตุท่าไม่ดีที่พบบ่อยสุด
export function causeText(cause) {
  switch (cause.kind) {
    case 'hunched':
      return `หลังค่อม (${cause.hunchedPercent}% ของเวลา)`;
    case 'slumped':
      return `เอนหลังไม่ดี (${cause.slumpedPercent}% ของเวลา)`;
    case 'both':
      return `หลังค่อมกับเอนหลังไม่ดี พอๆ กัน (${cause.hunchedPercent}% / ${cause.slumpedPercent}%)`;
    case 'unknown':
      return 'มีท่าไม่ดี แต่ไม่มีข้อมูลแยกชนิด';
    default:
      return 'ไม่มีท่าไม่ดีเลย 🎉';
  }
}

// หน้าสรุปวันนี้: ผลของเมื่อวาน (หรือวันล่าสุดที่มีข้อมูล) — เด้งอัตโนมัติครั้งแรกของวัน หรือกดดูเองจากหน้า Home
export function DailySummaryModal() {
  const { dailySummary, closeDailySummary } = useBelt();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (!dailySummary) return null;
  const d = dailySummary.data;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={closeDailySummary}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>สรุปวันนี้</Text>
          {d ? (
            <>
              <Text style={styles.sub}>{d.isYesterday ? `ผลของเมื่อวาน (${d.dateLabel})` : `ผลของวันที่ ${d.dateLabel} (วันล่าสุดที่มีข้อมูล)`}</Text>

              <View style={styles.row}>
                <Text style={styles.label}>คะแนนความพร้อม</Text>
                <View style={styles.valueBox}>
                  <Text style={[styles.value, { color: d.readinessColor }]}>{d.score === null ? '--' : `${d.score}/100`}</Text>
                  <Text style={[styles.valueSub, { color: d.readinessColor }]}>{d.readinessLabel}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>ท่านั่งดีต่อเนื่อง</Text>
                <Text style={styles.value}>{d.streak > 0 ? `🔥 ${d.streak} วัน` : 'ยังไม่มี streak'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>ลุกยืดเส้นตอนโดนเตือน</Text>
                <Text style={styles.value}>{d.stretchCount} ครั้ง</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>ท่าไม่ดีที่พบบ่อยสุด</Text>
                <Text style={[styles.value, styles.valueWide]}>{causeText(d.cause)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.empty}>ยังไม่มีข้อมูลให้สรุป — ใส่เข็มขัดใช้งานสักวัน พรุ่งนี้จะมีสรุปผลให้ที่นี่</Text>
          )}
          <BounceTouchable style={styles.closeButton} onPress={closeDailySummary} accessibilityLabel="ปิดสรุปวันนี้">
            <Text style={styles.closeText}>ปิด</Text>
          </BounceTouchable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: t.card, borderRadius: 16, padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: t.text, textAlign: 'center' },
    sub: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.border },
    label: { fontSize: 14, color: t.text2, flex: 1, marginRight: 8 },
    valueBox: { alignItems: 'flex-end' },
    value: { fontSize: 16, fontWeight: '700', color: t.text, textAlign: 'right' },
    valueWide: { flex: 1.2 },
    valueSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    empty: { fontSize: 14, color: t.muted, textAlign: 'center', marginVertical: 20 },
    closeButton: { backgroundColor: COLORS.blue, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
    closeText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  });
