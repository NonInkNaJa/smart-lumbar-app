import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, Bluetooth, CalendarDays, Clock } from 'lucide-react-native';
import { APP_NAME_TH, APP_NAME_EN } from '../config';
import { useBelt } from '../context/BeltContext';
import { getRecommendedRoutine } from '../utils/postureScore';
import { AlertBox, Button, Card, CardHeader, COLORS, ScreenTitle, screenStyles } from '../components/ui';

export default function HomeScreen() {
  const {
    isConnected,
    isConnecting,
    errorMsg,
    toggleConnection,
    connectLabel,
    sittingTime,
    isAlert,
    tilt,
    postureAlert,
    tier,
  } = useBelt();

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.scrollContent}>
        <ScreenTitle title={APP_NAME_TH} subtitle={APP_NAME_EN} />

        {/* การเชื่อมต่อ */}
        <Card>
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
        <Card>
          <CardHeader Icon={Clock} color={COLORS.blue} title="ระยะเวลานั่งต่อเนื่อง" />
          <Text style={styles.timerText}>{sittingTime} นาที</Text>
          {isAlert && <AlertBox text="นั่งนานเกินกำหนด! ควรยืดกล้ามเนื้อ" />}
        </Card>

        {/* มุมเอียงจากเซนเซอร์ (สด) */}
        <Card>
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
          {postureAlert && <AlertBox text={`ท่านั่งไม่ดี: ${postureAlert}`} />}
        </Card>

        {/* ท่ายืดเหยียดที่แนะนำวันนี้ */}
        <Card>
          <CardHeader Icon={CalendarDays} color={COLORS.amber} title="ท่ายืดเหยียดที่แนะนำวันนี้" />
          {getRecommendedRoutine(tier).map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>• {ex.name}</Text>
              {ex.detail && <Text style={styles.exerciseDetail}>{ex.detail}</Text>}
            </View>
          ))}
          {getRecommendedRoutine(tier).length === 0 && (
            <Text style={styles.tiltPlaceholder}>สวมเข็มขัดสักระยะ แล้วแอปจะแนะนำท่ายืดเหยียดให้ตามข้อมูลของคุณ</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  errorText: { fontSize: 13, color: COLORS.red, marginBottom: 8 },
  timerText: { fontSize: 36, fontWeight: 'bold', color: '#1D4ED8', textAlign: 'center', marginVertical: 10 },
  tiltRow: { flexDirection: 'row', justifyContent: 'space-around' },
  tiltItem: { alignItems: 'center' },
  tiltValue: { fontSize: 32, fontWeight: 'bold', color: '#1D4ED8' },
  tiltLabel: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  tiltPlaceholder: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  exerciseRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  exerciseName: { fontSize: 15, color: '#374151', fontWeight: '500' },
  exerciseDetail: { fontSize: 13, color: '#6B7280', marginLeft: 14, marginTop: 2 },
});
