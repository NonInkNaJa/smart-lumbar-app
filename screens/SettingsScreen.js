import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Bluetooth, Info, Moon, Sun, Timer } from 'lucide-react-native';
import appConfig from '../app.json';
import {
  APP_NAME_EN,
  APP_NAME_TH,
  BAD_POSTURE_SECONDS,
  DEVICE_NAME,
  HUNCH_ROLL_THRESHOLD,
  SITTING_ALERT_MAX_MINUTES,
  SITTING_ALERT_MIN_MINUTES,
  SLUMP_PITCH_THRESHOLD,
} from '../config';
import { GOOD_DAY_MAX_BAD_RATIO } from '../utils/postureStats';
import { parseSittingMinutes } from '../utils/settings';
import { useBelt } from '../context/BeltContext';
import { notifyBadPosture, notifySittingTooLong } from '../utils/notifications';
import { Button, Card, CardHeader, COLORS, ScreenTitle, useScreenStyles } from '../components/ui';
import { useTheme } from '../components/theme';

export default function SettingsScreen() {
  const { isConnected, isConnecting, errorMsg, toggleConnection, connectLabel, settings, updateSettings } = useBelt();
  const theme = useTheme();
  const screen = useScreenStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ช่องพิมพ์เวลาเตือนนั่งนาน: พิมพ์ได้เฉพาะตัวเลข และจะ "บันทึก" ก็ต่อเมื่ออยู่ในช่วง MIN-MAX
  // (บันทึกตอนกดปุ่ม บันทึก / กดเสร็จบนคีย์บอร์ด / เลิกแตะช่อง ไม่บันทึกทุกตัวอักษรที่พิมพ์ กันเตือนเด้งระหว่างพิมพ์ค่ากลางทาง เช่น พิมพ์ 1 แล้วต่อเป็น 120)
  const saved = settings.sittingAlertMinutes;
  const [draft, setDraft] = useState(String(saved));
  const [revertNote, setRevertNote] = useState(null);
  useEffect(() => setDraft(String(saved)), [saved]);
  const parsed = parseSittingMinutes(draft);
  const canSave = parsed !== null && parsed !== saved;
  const onChangeMinutes = (text) => {
    setRevertNote(null);
    setDraft(text.replace(/\D/g, '').slice(0, 3)); // ตัดทุกอย่างที่ไม่ใช่ตัวเลขทิ้ง (ติดลบ, จุดทศนิยม, ตัวอักษร)
  };
  const commitMinutes = () => {
    if (parsed === null) {
      // ค่าไม่ถูกต้อง: คืนค่าเดิมและบอกเหตุผล
      setRevertNote(`ค่าไม่ถูกต้อง ใช้ค่าเดิม ${saved} นาที (ต้องอยู่ระหว่าง ${SITTING_ALERT_MIN_MINUTES}-${SITTING_ALERT_MAX_MINUTES} นาที)`);
      setDraft(String(saved));
      return;
    }
    if (parsed !== saved) updateSettings({ sittingAlertMinutes: parsed });
  };

  return (
    <SafeAreaView style={screen.container} edges={['top']}>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        <ScreenTitle title="ตั้งค่า" />

        {/* โหมดมืด */}
        <Card>
          <CardHeader Icon={settings.darkMode ? Moon : Sun} color={settings.darkMode ? COLORS.purple : COLORS.amber} title="โหมดมืด" />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{settings.darkMode ? 'เปิดอยู่ (พื้นหลังสีเข้ม)' : 'ปิดอยู่ (พื้นหลังสีสว่าง)'}</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={(v) => updateSettings({ darkMode: v })}
              trackColor={{ false: theme.surface2, true: COLORS.blue }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

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

        {/* ตั้งเวลาเตือนนั่งนาน */}
        <Card>
          <CardHeader Icon={Timer} color={COLORS.blue} title="เตือนนั่งนาน" />
          <Text style={styles.infoLine}>
            เตือนให้ลุกยืดเส้นเมื่อนั่งต่อเนื่องครบกี่นาที (พิมพ์ได้ {SITTING_ALERT_MIN_MINUTES}-{SITTING_ALERT_MAX_MINUTES} นาที)
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.minutesInput, parsed === null && styles.minutesInputInvalid]}
              value={draft}
              onChangeText={onChangeMinutes}
              onBlur={commitMinutes}
              onSubmitEditing={commitMinutes}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={3}
              selectTextOnFocus
              placeholder="45"
              placeholderTextColor={theme.faint}
              accessibilityLabel="เวลาเตือนนั่งนาน (นาที)"
            />
            <Text style={styles.unitText}>นาที</Text>
            <Button label="บันทึก" onPress={commitMinutes} disabled={!canSave} style={styles.saveButton} />
          </View>
          {parsed === null && (
            <Text style={styles.errorText}>
              ใส่ตัวเลขระหว่าง {SITTING_ALERT_MIN_MINUTES}-{SITTING_ALERT_MAX_MINUTES} นาที
            </Text>
          )}
          {parsed !== null && canSave && <Text style={styles.infoLine}>กด "บันทึก" หรือปุ่มเสร็จบนคีย์บอร์ดเพื่อใช้ค่านี้</Text>}
          {parsed !== null && !canSave && <Text style={styles.savedLine}>ตั้งไว้ที่ {saved} นาที ✓</Text>}
          {revertNote && <Text style={styles.errorText}>{revertNote}</Text>}
        </Card>

        {/* ทดสอบแจ้งเตือน */}
        <Card>
          <CardHeader Icon={Bell} color={COLORS.amber} title="ทดสอบการแจ้งเตือน" />
          <Text style={styles.infoLine}>กดเพื่อดูว่าเครื่องนี้แสดงป๊อปอัพและสั่นหรือไม่ (ไม่ต้องเชื่อมต่อเข็มขัด)</Text>
          <Button label="ทดสอบเตือนท่านั่งไม่ดี" onPress={() => notifyBadPosture('หลังค่อม')} color={COLORS.amber} />
          <Button label="ทดสอบเตือนนั่งนาน" onPress={() => notifySittingTooLong()} color={COLORS.amber} style={styles.secondButton} />
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
          <Text style={styles.infoLine}>เตือนนั่งนานเมื่อนั่งต่อเนื่องเกิน {settings.sittingAlertMinutes} นาที</Text>
          <Text style={styles.infoLine}>
            วันดี (นับ streak) = วันที่นั่งท่าไม่ดีต่ำกว่า {Math.round(GOOD_DAY_MAX_BAD_RATIO * 100)}% ของเวลา
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
    errorText: { fontSize: 13, color: COLORS.red, marginBottom: 8 },
    infoLine: { fontSize: 14, color: t.muted, marginBottom: 8 },
    appName: { fontSize: 20, fontWeight: 'bold', color: t.text },
    secondButton: { marginTop: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchLabel: { flex: 1, fontSize: 14, color: t.muted, marginRight: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    minutesInput: { width: 84, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, color: t.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
    minutesInputInvalid: { borderColor: COLORS.red },
    unitText: { fontSize: 16, color: t.text2, marginLeft: 10 },
    saveButton: { flex: 1, marginLeft: 12, paddingVertical: 10 },
    savedLine: { fontSize: 13, color: COLORS.green, marginBottom: 8 },
  });
