import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Activity, Bluetooth, CalendarDays, ClipboardList, Clock, Flame, HeartPulse, Pause, Play } from 'lucide-react-native';
import { APP_NAME_TH, APP_NAME_EN } from '../config';
import { useBelt } from '../context/BeltContext';
import { getRecommendedRoutine } from '../utils/postureScore';
import { AlertBox, Button, Card, CardHeader, COLORS, IconBadge, Screen, ScreenTitle, useScreenStyles } from '../components/ui';
import { BounceTouchable } from '../components/motion';
import { Mascot } from '../components/Mascot';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../components/theme';
import { getStretchImage } from '../utils/images';

const RATING_EMOJIS = ['😖', '😕', '😐', '🙂', '😄'];

export default function HomeScreen() {
  const {
    streak,
    selfRating,
    saveRating,
    isConnected,
    isConnecting,
    errorMsg,
    toggleConnection,
    connectLabel,
    sittingTime,
    isAlert,
    confirmStretch,
    stretchToday,
    isPaused,
    togglePause,
    tilt,
    postureAlert,
    tier,
    openDailySummary,
  } = useBelt();
  const theme = useTheme();
  const screen = useScreenStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        {/* มาสคอตต้อนรับ อยู่บนสุดก่อนการ์ดแรก */}
        <Mascot tier={tier} />
        <ScreenTitle title={APP_NAME_TH} subtitle={APP_NAME_EN} />

        {/* สถานะภาพรวม (เขียว/เหลือง/แดง) อยู่บนสุดก่อนการ์ดทั้งหมด */}
        <StatusBadge />

        {/* Streak: วันดี (นั่งท่าไม่ดีต่ำกว่า 30% ของเวลา) ติดต่อกัน; ยังเป็น 0 ไม่โชว์ตัวเลข ให้กำลังใจแทน */}
        <Card index={0}>
          <View style={styles.streakRow}>
            <IconBadge Icon={Flame} color={streak > 0 ? COLORS.orange : COLORS.slate} box={44} size={24} active={streak > 0} />
            <Text style={[styles.streakText, streak === 0 && styles.streakTextEmpty]}>
              {streak > 0 ? `ท่านั่งดีต่อเนื่อง ${streak} วันแล้ว 🔥` : 'เริ่มสะสมวันท่านั่งดีกันเลย! วันนี้นั่งให้ตรงๆ แล้วมาลุ้น streak แรกกัน 💪'}
            </Text>
          </View>
          {/* สรุปผลของเมื่อวาน/วันล่าสุด (เด้งเองครั้งแรกของวัน กดดูเองได้ตรงนี้) */}
          <BounceTouchable style={styles.summaryButton} onPress={openDailySummary} accessibilityLabel="ดูสรุปวันนี้">
            <ClipboardList color={COLORS.blue} size={16} />
            <Text style={styles.summaryButtonText}>ดูสรุปวันนี้</Text>
          </BounceTouchable>
        </Card>

        {/* การเชื่อมต่อ */}
        <Card index={1}>
          <CardHeader Icon={Bluetooth} color={isConnected ? COLORS.green : COLORS.slate} title="สถานะการเชื่อมต่อ" />
          <Text style={[styles.statusText, { color: isConnected ? COLORS.green : COLORS.red }]}>
            {isConnecting ? 'กำลังค้นหาเข็มขัด...' : isConnected ? 'เชื่อมต่อเข็มขัดแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
          </Text>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          <Button
            label={connectLabel}
            onPress={toggleConnection}
            disabled={isConnecting}
            color={isConnected ? COLORS.red : COLORS.blue}
          />
        </Card>

        {/* เวลานั่ง */}
        <Card index={2}>
          <View style={styles.timerHeaderRow}>
            <View style={styles.timerHeaderTitle}>
              <CardHeader Icon={Clock} color={COLORS.blue} title="ระยะเวลานั่งต่อเนื่อง" />
            </View>
            {/* ปุ่มเสริม: หยุดนับชั่วคราวโดยไม่ตัด Bluetooth (ค่าเริ่มต้นยังนับอัตโนมัติทันทีที่เชื่อมต่อ) */}
            {isConnected && (
              <BounceTouchable
                style={[styles.pauseButton, isPaused && styles.resumeButton]}
                onPress={togglePause}
              >
                {isPaused ? <Play color="#FFFFFF" size={14} /> : <Pause color="#FFFFFF" size={14} />}
                <Text style={styles.pauseButtonText}>{isPaused ? 'เริ่มนับต่อ' : 'หยุดชั่วคราว'}</Text>
              </BounceTouchable>
            )}
          </View>
          <Text style={[styles.timerText, isPaused && styles.timerTextPaused]}>{sittingTime} นาที</Text>
          {isPaused && (
            <Text style={styles.pausedCaption}>หยุดนับชั่วคราว (ยังเชื่อมต่ออยู่) กด "เริ่มนับต่อ" เมื่อกลับมานั่ง</Text>
          )}
          {isAlert && (
            <View style={styles.alertRow}>
              <View style={styles.alertBoxWrap}>
                <AlertBox text="นั่งนานเกินกำหนด! ควรยืดกล้ามเนื้อ" />
              </View>
              {/* ยืนยันว่าลุก/ยืดเส้นแล้ว: ซ่อนเตือนรอบนี้ ไม่รีเซ็ตเวลานั่ง */}
              <BounceTouchable style={styles.stretchButton} onPress={confirmStretch}>
                <Text style={styles.stretchButtonText}>ยืดเส้นแล้ว ✓</Text>
              </BounceTouchable>
            </View>
          )}
          {stretchToday > 0 && <Text style={styles.stretchCount}>วันนี้ลุกยืดเส้นแล้ว {stretchToday} ครั้ง 🙆</Text>}
        </Card>

        {/* มุมเอียงจากเซนเซอร์ (สด) */}
        <Card index={3}>
          <CardHeader Icon={Activity} color={COLORS.purple} title="มุมเอียงลำตัว" />
          {tilt ? (
            <View style={styles.tiltRow}>
              <View style={styles.tiltItem}>
                <Text style={styles.tiltValue}>{tilt.pitch.toFixed(1)}°</Text>
                <Text style={styles.tiltLabel}>Pitch</Text>
              </View>
              <View style={styles.tiltItem}>
                <Text style={styles.tiltValue}>{tilt.roll.toFixed(1)}°</Text>
                <Text style={styles.tiltLabel}>Roll</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.tiltPlaceholder}>
              {isConnected ? 'กำลังรอข้อมูลจากเข็มขัด...' : 'เชื่อมต่อเข็มขัดเพื่อดูมุมเอียง'}
            </Text>
          )}
          {isPaused && <Text style={styles.tiltPlaceholder}>หยุดตรวจท่านั่งชั่วคราว (ไม่บันทึก ไม่เตือน)</Text>}
          {postureAlert && <AlertBox text={`ท่านั่งไม่ดี: ${postureAlert}`} />}
        </Card>

        {/* ท่ายืดเหยียดที่แนะนำวันนี้ */}
        <Card index={4}>
          <CardHeader Icon={CalendarDays} color={COLORS.amber} title="ท่ายืดเหยียดที่แนะนำวันนี้" />
          {getRecommendedRoutine(tier).map((ex, i) => {
            const image = getStretchImage(ex.name);
            return (
              <View key={i} style={styles.exerciseRow}>
                {image ? (
                  <Image source={image} style={styles.exerciseImage} resizeMode="cover" accessibilityLabel={`ภาพประกอบท่า ${ex.name}`} />
                ) : ex.detail ? (
                  // ท่าที่ยังไม่มีรูป: กรอบว่างขนาดเท่ากัน ให้แถวเรียงเสมอกัน (แถวคำเตือนที่ไม่มีวิธีทำ ไม่ต้องมีกรอบ)
                  <View style={[styles.exerciseImage, styles.exerciseImageEmpty]}>
                    <Text style={styles.exerciseImageEmptyText}>🧘</Text>
                  </View>
                ) : null}
                <View style={styles.exerciseText}>
                  <Text style={styles.exerciseName}>• {ex.name}</Text>
                  {ex.detail && <Text style={styles.exerciseDetail}>{ex.detail}</Text>}
                </View>
              </View>
            );
          })}
          {getRecommendedRoutine(tier).length === 0 && (
            <Text style={styles.tiltPlaceholder}>สวมเข็มขัดสักระยะ แล้วแอปจะแนะนำท่ายืดเหยียดให้ตามข้อมูลของคุณ</Text>
          )}
        </Card>

        {/* Self-report: บันทึกอย่างเดียว ไม่แสดงผลต่อคะแนนให้ผู้ใช้เห็น (ตัวคำนวณคะแนนใช้ค่านี้ข้างหลัง) */}
        <Card index={5}>
          <CardHeader Icon={HeartPulse} color={COLORS.red} title="วันนี้หลังตึงแค่ไหน?" />
          <View style={styles.ratingRow}>
            {RATING_EMOJIS.map((emoji, i) => {
              const value = i + 1;
              return (
                <BounceTouchable
                  key={value}
                  style={[styles.ratingButton, selfRating === value && styles.ratingButtonSelected]}
                  onPress={() => saveRating(value)}
                >
                  <Text style={styles.ratingEmoji}>{emoji}</Text>
                </BounceTouchable>
              );
            })}
          </View>
          {selfRating && <Text style={styles.savedText}>บันทึกแล้ว ✓</Text>}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
    errorText: { fontSize: 13, color: COLORS.red, marginBottom: 8 },
    timerText: { fontSize: 36, fontWeight: 'bold', color: t.number, textAlign: 'center', marginVertical: 10 },
    streakRow: { flexDirection: 'row', alignItems: 'center' },
    streakText: { flex: 1, marginLeft: 12, fontSize: 17, fontWeight: '700', color: t.text },
    summaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.selected },
    summaryButtonText: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: t.number },
    streakTextEmpty: { fontSize: 14, fontWeight: '500', color: t.muted },
    timerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    timerHeaderTitle: { flex: 1 },
    pauseButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amber, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginLeft: 8 },
    resumeButton: { backgroundColor: COLORS.green },
    pauseButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13, marginLeft: 6 },
    alertRow: { flexDirection: 'row', alignItems: 'stretch' },
    alertBoxWrap: { flex: 1 },
    stretchButton: { marginTop: 10, marginLeft: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
    stretchButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    stretchCount: { fontSize: 13, color: COLORS.green, fontWeight: '600', textAlign: 'center', marginTop: 6 },
    timerTextPaused: { color: t.faint },
    pausedCaption: { fontSize: 12, color: t.faint, textAlign: 'center', marginBottom: 4 },
    tiltRow: { flexDirection: 'row', justifyContent: 'space-around' },
    tiltItem: { alignItems: 'center' },
    tiltValue: { fontSize: 32, fontWeight: 'bold', color: t.number },
    tiltLabel: { fontSize: 13, color: t.muted, marginTop: 2 },
    tiltPlaceholder: { fontSize: 14, color: t.faint, textAlign: 'center', paddingVertical: 8 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
    ratingButton: { padding: 10, borderRadius: 8, backgroundColor: t.surface },
    ratingButtonSelected: { backgroundColor: t.selected },
    ratingEmoji: { fontSize: 24 },
    savedText: { fontSize: 13, color: COLORS.green, textAlign: 'center', marginTop: 10 },
    exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border },
    // รูปประกอบท่า: ต้นฉบับแนวนอน 1408x768 (อัตราส่วน ~1.83) แสดงเป็นรูปเล็กข้างชื่อท่า
    exerciseImage: { width: 104, height: 57, borderRadius: 8, marginRight: 12, backgroundColor: t.surface },
    exerciseImageEmpty: { alignItems: 'center', justifyContent: 'center' },
    exerciseImageEmptyText: { fontSize: 22, opacity: 0.6 },
    exerciseText: { flex: 1 },
    exerciseName: { fontSize: 15, color: t.text2, fontWeight: '500' },
    exerciseDetail: { fontSize: 13, color: t.muted, marginTop: 2 },
  });
