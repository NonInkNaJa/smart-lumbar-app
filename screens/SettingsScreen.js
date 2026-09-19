import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Bluetooth, HeartPulse, Info } from 'lucide-react-native';
import appConfig from '../app.json';
import {
  APP_NAME_EN,
  APP_NAME_TH,
  BAD_POSTURE_SECONDS,
  DEVICE_NAME,
  HUNCH_ROLL_THRESHOLD,
  SITTING_ALERT_MINUTES,
  SLUMP_PITCH_THRESHOLD,
} from '../config';
import { useBelt } from '../context/BeltContext';
import { notifyBadPosture, notifySittingTooLong } from '../utils/notifications';
import { Button, Card, CardHeader, COLORS, ScreenTitle, screenStyles } from '../components/ui';

const RATING_EMOJIS = ['😖', '😕', '😐', '🙂', '😄'];

export default function SettingsScreen() {
  const { isConnected, isConnecting, errorMsg, toggleConnection, connectLabel, selfRating, saveRating } = useBelt();

  return (
    <SafeAreaView style={screenStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={screenStyles.scrollContent}>
        <ScreenTitle title="ตั้งค่า" />

        {/* จัดการ Bluetooth */}
        <Card>
          <CardHeader Icon={Bluetooth} color={isConnected ? COLORS.green : COLORS.slate} title="จัดการ Bluetooth" />
          <Text style={styles.infoLine}>อุปกรณ์: {DEVICE_NAME}</Text>
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

        {/* Self-report */}
        <Card>
          <CardHeader Icon={HeartPulse} color={COLORS.red} title="วันนี้หลังตึงแค่ไหน?" />
          <View style={styles.ratingRow}>
            {RATING_EMOJIS.map((emoji, i) => {
              const value = i + 1;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.ratingButton, selfRating === value && styles.ratingButtonSelected]}
                  onPress={() => saveRating(value)}
                >
                  <Text style={styles.ratingEmoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selfRating && <Text style={styles.savedText}>บันทึกแล้ว ✓</Text>}
        </Card>

        {/* ทดสอบแจ้งเตือน */}
        <Card>
          <CardHeader Icon={Bell} color={COLORS.amber} title="ทดสอบการแจ้งเตือน" />
          <Text style={styles.infoLine}>กดเพื่อดูว่าเครื่องนี้แสดงป๊อปอัพและสั่นหรือไม่ (ไม่ต้องเชื่อมต่อเข็มขัด)</Text>
          <Button label="ทดสอบเตือนท่านั่งไม่ดี" onPress={() => notifyBadPosture('หลังค่อม')} color={COLORS.amber} />
          <Button label="ทดสอบเตือนนั่งนาน" onPress={notifySittingTooLong} color={COLORS.amber} style={styles.secondButton} />
        </Card>

        {/* ข้อมูลแอป */}
        <Card>
          <CardHeader Icon={Info} color={COLORS.purple} title="ข้อมูลแอป" />
          <Text style={styles.appName}>{APP_NAME_TH}</Text>
          <Text style={styles.infoLine}>{APP_NAME_EN}</Text>
          <Text style={styles.infoLine}>เวอร์ชัน {appConfig.expo.version}</Text>
          <Text style={styles.infoLine}>
            เกณฑ์เตือนท่านั่ง: หลังค่อมเมื่อ roll ต่ำกว่า {HUNCH_ROLL_THRESHOLD}°, เอนหลังไม่ดีเมื่อ pitch ต่ำกว่า{' '}
            {SLUMP_PITCH_THRESHOLD}° (ต่อเนื่อง {BAD_POSTURE_SECONDS} วินาที)
          </Text>
          <Text style={styles.infoLine}>เตือนนั่งนานเมื่อนั่งต่อเนื่องเกิน {SITTING_ALERT_MINUTES} นาที</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  errorText: { fontSize: 13, color: COLORS.red, marginBottom: 8 },
  infoLine: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  secondButton: { marginTop: 8 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingButton: { padding: 10, borderRadius: 8, backgroundColor: '#F3F4F6' },
  ratingButtonSelected: { backgroundColor: '#DBEAFE' },
  ratingEmoji: { fontSize: 24 },
  savedText: { fontSize: 13, color: COLORS.green, textAlign: 'center', marginTop: 10 },
});
