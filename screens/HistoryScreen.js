import React, { useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity, Share2 } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { CHART_RANGES } from '../config';
import { MIN_TRACKED_SECONDS } from '../utils/postureStats';
import { getReadinessMessage } from '../utils/postureScore';
import { useBelt } from '../context/BeltContext';
import { Card, CardHeader, COLORS, Screen, ScreenTitle, useScreenStyles } from '../components/ui';
import { useTheme } from '../components/theme';

export default function HistoryScreen() {
  const { score, lowData, readiness, chartRange, setChartRange, chartData } = useBelt();
  const viewShotRef = useRef(null);
  const theme = useTheme();
  const screen = useScreenStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // สรุปช่วงที่เลือก: เวลารวมที่ตรวจวัดได้ และสัดส่วนท่าไม่ดี
  const goodSec = chartData.reduce((a, b) => a + b.goodSeconds, 0);
  const badSec = chartData.reduce((a, b) => a + b.badSeconds, 0);
  const totalSec = goodSec + badSec;
  const summaryText =
    totalSec < MIN_TRACKED_SECONDS
      ? 'ยังไม่มีข้อมูลในช่วงนี้'
      : `ตรวจวัดรวม ${Math.round(totalSec / 60)} นาที · ท่าไม่ดี ${Math.round((badSec / totalSec) * 100)}%`;

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('ไม่รองรับ', 'อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');
        return;
      }
      const uri = await viewShotRef.current.capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างภาพสรุปได้');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        <ScreenTitle title="ประวัติ" subtitle="คะแนนและกราฟท่านั่งจากข้อมูลจริง" />

        {/* เลือกช่วงเวลากราฟ (อยู่นอก ViewShot เพื่อไม่ให้ติดไปในภาพที่แชร์) */}
        <View style={styles.rangeRow}>
          {CHART_RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeButton, chartRange === r.key && styles.rangeButtonSelected]}
              onPress={() => setChartRange(r.key)}
            >
              <Text style={[styles.rangeButtonText, chartRange === r.key && styles.rangeButtonTextSelected]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* คะแนนความพร้อม + กราฟ (ห่อด้วย ViewShot เพื่อ export) */}
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <Card>
            <CardHeader Icon={Activity} color={readiness.color} title="ความพร้อมออกกำลังกายสัปดาห์นี้" />
            <Text style={[styles.scoreText, { color: readiness.color }]}>{score === null ? '--' : `${score}/100`}</Text>
            <Text style={[styles.tierLabel, { color: readiness.color }]}>{readiness.label}</Text>
            <Text style={styles.adviceText}>{readiness.advice}</Text>
            {score !== null && lowData && (
              <Text style={styles.lowDataText}>ข้อมูลยังน้อย คะแนนอาจยังไม่แม่นยำ (ใส่เข็มขัดนานขึ้นจะแม่นขึ้น)</Text>
            )}

            <View style={styles.barChartRow}>
              {chartData.map((bucket, i) => {
                const many = chartData.length > 10; // เดือนนี้: แท่งบางลง และโชว์ป้ายวันที่เว้นระยะ ไม่ให้ตัวเลขทับกัน
                const showLabel = !many || i === 0 || (i + 1) % 5 === 0 || i === chartData.length - 1;
                return (
                  <View key={i} style={styles.barColumn}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: chartData.length === 1 ? 56 : many ? 6 : 16,
                          // แท่ง = คะแนนความพร้อมของวันนั้น (หลังหักตาม self-report แล้ว) สูง = พร้อมมาก; สีตามระดับของวันนั้น
                          height: Math.max(((bucket.score || 0) / 100) * 60, 4),
                          backgroundColor: bucket.hasData ? getReadinessMessage(bucket.tier).color : theme.barEmpty,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, many && styles.barLabelSmall]} numberOfLines={1}>
                      {showLabel ? bucket.label : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chartCaption}>คะแนนความพร้อมรายวัน (แท่งสูง = พร้อมมาก, สีเทา = ยังไม่มีข้อมูล)</Text>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </Card>
        </ViewShot>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Share2 color="#FFFFFF" size={18} />
          <Text style={styles.shareButtonText}>แชร์สรุปนี้</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    rangeRow: { flexDirection: 'row', marginBottom: 12 },
    rangeButton: { flex: 1, paddingVertical: 8, marginHorizontal: 4, borderRadius: 8, backgroundColor: t.surface2, alignItems: 'center' },
    rangeButtonSelected: { backgroundColor: COLORS.blue },
    rangeButtonText: { fontSize: 13, fontWeight: '600', color: t.text2 },
    rangeButtonTextSelected: { color: '#FFFFFF' },
    scoreText: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
    tierLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
    adviceText: { fontSize: 14, color: t.muted, textAlign: 'center', marginBottom: 16 },
    lowDataText: { fontSize: 12, color: t.faint, textAlign: 'center', marginTop: -8, marginBottom: 12 },
    barChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
    barColumn: { alignItems: 'center', flex: 1 },
    bar: { width: 16, borderRadius: 4 },
    barLabel: { fontSize: 11, color: t.muted, marginTop: 4 },
    barLabelSmall: { fontSize: 9, width: 22, textAlign: 'center' },
    summaryText: { fontSize: 13, fontWeight: '600', color: t.text2, textAlign: 'center', marginTop: 6 },
    chartCaption: { fontSize: 11, color: t.faint, textAlign: 'center', marginTop: 10 },
    shareButton: { flexDirection: 'row', backgroundColor: '#4B5563', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    shareButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, marginLeft: 8 },
  });
