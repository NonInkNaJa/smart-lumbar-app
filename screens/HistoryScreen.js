import React, { useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, Share2 } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { CHART_RANGES } from '../config';
import { useBelt } from '../context/BeltContext';
import { Card, CardHeader, COLORS, ScreenTitle, screenStyles } from '../components/ui';

export default function HistoryScreen() {
  const { score, readiness, chartRange, setChartRange, chartData } = useBelt();
  const viewShotRef = useRef(null);

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
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.scrollContent}>
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

            <View style={styles.barChartRow}>
              {chartData.map((bucket, i) => (
                <View key={i} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(bucket.badPostureRatio * 60, 4),
                        backgroundColor: bucket.hasData ? readiness.color : '#D1D5DB',
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>{bucket.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartCaption}>สัดส่วนเวลาที่นั่งท่าไม่ดี (แท่งสูง = ท่าไม่ดีมาก, สีเทา = ยังไม่มีข้อมูล)</Text>
          </Card>
        </ViewShot>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Share2 color="#FFFFFF" size={18} />
          <Text style={styles.shareButtonText}>แชร์สรุปนี้</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', marginBottom: 12 },
  rangeButton: { flex: 1, paddingVertical: 8, marginHorizontal: 4, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center' },
  rangeButtonSelected: { backgroundColor: COLORS.blue },
  rangeButtonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rangeButtonTextSelected: { color: '#FFFFFF' },
  scoreText: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  tierLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  adviceText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  barChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
  barColumn: { alignItems: 'center', flex: 1 },
  bar: { width: 16, borderRadius: 4 },
  barLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  chartCaption: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },
  shareButton: { flexDirection: 'row', backgroundColor: '#374151', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  shareButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, marginLeft: 8 },
});
