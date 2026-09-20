import React, { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Activity, FileText, Share2 } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { CHART_RANGES } from '../config';
import { MIN_TRACKED_SECONDS, summarizeCauses } from '../utils/postureStats';
import { getReadinessMessage } from '../utils/postureScore';
import { buildWeeklyReportHtml, REPORT_PAGE } from '../utils/weeklyReport';
import { useBelt } from '../context/BeltContext';
import { Card, CardHeader, COLORS, Screen, ScreenTitle, useScreenStyles } from '../components/ui';
import { BounceTouchable } from '../components/motion';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useTheme } from '../components/theme';

// แถวสาเหตุ: ป้าย + แถบสัดส่วน + เปอร์เซ็นต์ (แถบยาวตามเปอร์เซ็นต์ของเวลาที่ตรวจวัดทั้งช่วง)
function CauseRow({ label, percent, color, styles }) {
  return (
    <View style={styles.causeRow}>
      <Text style={styles.causeLabel}>{label}</Text>
      <View style={styles.causeTrack}>
        <View style={[styles.causeFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.causePercent}>{percent}%</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { score, tier, lowData, readiness, weekChange, streak, stretchInWeek, stretchInChart, weekData, chartRange, setChartRange, chartData } = useBelt();
  const [exporting, setExporting] = useState(false); // กำลังสร้าง PDF (กันกดซ้ำ)
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

  const causes = summarizeCauses(chartData);

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

  // รายงานประจำสัปดาห์เป็น PDF: ใช้ข้อมูล 7 วันล่าสุดเสมอ (ไม่ขึ้นกับช่วงที่เลือกดูกราฟ) แล้วเปิดหน้าต่างแชร์ของระบบ
  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('ไม่รองรับ', 'อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');
        return;
      }
      const html = buildWeeklyReportHtml({ score, tier, lowData, weekData, streak, weekChange, stretchCount: stretchInWeek });
      const { uri } = await Print.printToFileAsync({ html, width: REPORT_PAGE.width, height: REPORT_PAGE.height });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'รายงานประจำสัปดาห์ หลังเทพ' });
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างรายงาน PDF ได้');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        <ScreenTitle title="ประวัติ" subtitle="คะแนนและกราฟท่านั่งจากข้อมูลจริง" />

        {/* เลือกช่วงเวลากราฟ (อยู่นอก ViewShot เพื่อไม่ให้ติดไปในภาพที่แชร์) */}
        <View style={styles.rangeRow}>
          {CHART_RANGES.map((r) => (
            <BounceTouchable
              key={r.key}
              style={[styles.rangeButton, chartRange === r.key && styles.rangeButtonSelected]}
              onPress={() => setChartRange(r.key)}
            >
              <Text style={[styles.rangeButtonText, chartRange === r.key && styles.rangeButtonTextSelected]}>{r.label}</Text>
            </BounceTouchable>
          ))}
        </View>

        {/* คะแนนความพร้อม + กราฟ (ห่อด้วย ViewShot เพื่อ export) */}
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <Card index={0}>
            <CardHeader Icon={Activity} color={readiness.color} title="ความพร้อมออกกำลังกายสัปดาห์นี้" />
            <AnimatedNumber value={score} format={(n) => `${n}/100`} style={[styles.scoreText, { color: readiness.color }]} />
            <Text style={[styles.tierLabel, { color: readiness.color }]}>{readiness.label}</Text>
            {/* เทียบสัปดาห์ก่อน: ไม่มีข้อมูลสัปดาห์ก่อน = ไม่แสดงเลย */}
            {weekChange && (
              <Text style={[styles.changeText, { color: weekChange.direction === 'up' ? COLORS.green : weekChange.direction === 'down' ? COLORS.red : theme.muted }]}>
                {weekChange.direction === 'same' ? 'เทียบสัปดาห์ก่อน: เท่าเดิม' : `เทียบสัปดาห์ก่อน: ${weekChange.direction === 'up' ? '▲' : '▼'} ${Math.abs(weekChange.percent)}%`}
              </Text>
            )}
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
            <Text style={styles.stretchSummary}>ลุกยืดเส้นตอนโดนเตือน {stretchInChart} ครั้ง</Text>
            {/* สาเหตุท่านั่งไม่ดีของช่วงที่เลือก (% ของเวลาที่ตรวจวัดทั้งช่วง) */}
            <View style={styles.causeBox}>
              <Text style={styles.causeTitle}>สาเหตุท่านั่งไม่ดี</Text>
              {causes.hasData ? (
                <>
                  <CauseRow label="หลังค่อม" percent={causes.hunchedPercent} color={COLORS.orange} styles={styles} />
                  <CauseRow label="เอนหลังไม่ดี" percent={causes.slumpedPercent} color={COLORS.purple} styles={styles} />
                  {causes.overlap && <Text style={styles.causeNote}>บางช่วงเป็นทั้งสองแบบพร้อมกัน ผลรวมจึงอาจมากกว่าท่าไม่ดีทั้งหมด</Text>}
                </>
              ) : (
                <Text style={styles.causeNote}>ยังไม่มีข้อมูลในช่วงนี้</Text>
              )}
            </View>
          </Card>
        </ViewShot>

        <BounceTouchable style={styles.shareButton} onPress={handleShare}>
          <Share2 color="#FFFFFF" size={18} />
          <Text style={styles.shareButtonText}>แชร์สรุปนี้</Text>
        </BounceTouchable>

        <BounceTouchable style={[styles.shareButton, styles.pdfButton]} onPress={handleExportPdf} disabled={exporting}>
          <FileText color="#FFFFFF" size={18} />
          <Text style={styles.shareButtonText}>{exporting ? 'กำลังสร้าง PDF...' : 'ส่งออกรายงานสัปดาห์ (PDF)'}</Text>
        </BounceTouchable>
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
    changeText: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
    adviceText: { fontSize: 14, color: t.muted, textAlign: 'center', marginBottom: 16 },
    lowDataText: { fontSize: 12, color: t.faint, textAlign: 'center', marginTop: -8, marginBottom: 12 },
    barChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
    barColumn: { alignItems: 'center', flex: 1 },
    bar: { width: 16, borderRadius: 4 },
    barLabel: { fontSize: 11, color: t.muted, marginTop: 4 },
    barLabelSmall: { fontSize: 9, width: 22, textAlign: 'center' },
    summaryText: { fontSize: 13, fontWeight: '600', color: t.text2, textAlign: 'center', marginTop: 6 },
    causeBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.border },
    causeTitle: { fontSize: 13, fontWeight: '700', color: t.text2, marginBottom: 8 },
    causeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    causeLabel: { width: 96, fontSize: 13, color: t.text2 },
    causeTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: t.surface2, overflow: 'hidden' },
    causeFill: { height: 10, borderRadius: 5 },
    causePercent: { width: 44, fontSize: 13, fontWeight: '700', color: t.text, textAlign: 'right' },
    causeNote: { fontSize: 11, color: t.faint, marginTop: 2 },
    stretchSummary: { fontSize: 12, color: t.muted, textAlign: 'center', marginTop: 4 },
    chartCaption: { fontSize: 11, color: t.faint, textAlign: 'center', marginTop: 10 },
    shareButton: { flexDirection: 'row', backgroundColor: '#4B5563', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    pdfButton: { backgroundColor: COLORS.blue },
    shareButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, marginLeft: 8 },
  });
