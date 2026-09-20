import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Bell, Bluetooth, ChevronRight, Info, Moon, Sun, Timer, Trash2 } from 'lucide-react-native';
import appConfig from '../app.json';
import { APP_NAME_TH, DEVICE_NAME, SITTING_ALERT_MAX_MINUTES, SITTING_ALERT_MIN_MINUTES } from '../config';
import { parseSittingMinutes } from '../utils/settings';
import { useBelt } from '../context/BeltContext';
import { notifyBadPosture, notifySittingTooLong } from '../utils/notifications';
import { Button, Card, CardHeader, COLORS, IconBadge, Screen, ScreenTitle, useScreenStyles } from '../components/ui';
import { BounceTouchable } from '../components/motion';
import { useTheme } from '../components/theme';

export default function SettingsScreen({ navigation }) {
  const { isConnected, isConnecting, errorMsg, toggleConnection, connectLabel, settings, updateSettings, clearAllData } = useBelt();
  const [clearing, setClearing] = useState(false); // กำลังล้างข้อมูล (กันกดซ้ำ)
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

  // ล้างข้อมูลทั้งหมด: ต้องยืนยันในป๊อปอัพก่อนเสมอ (ลบแล้วกู้คืนไม่ได้) ไม่แตะการเชื่อมต่อ Bluetooth
  const confirmClearAll = () => {
    if (clearing) return;
    Alert.alert(
      'ล้างข้อมูลทั้งหมด?',
      'ประวัติท่านั่ง คะแนน streak การประเมินความตึง และจำนวนครั้งที่ลุกยืดเส้นจะถูกลบ และการตั้งค่ากลับเป็นค่าเริ่มต้น ลบแล้วกู้คืนไม่ได้ (การเชื่อมต่อ Bluetooth ไม่ถูกตัด)',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ล้างข้อมูล',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearAllData();
              Alert.alert('ล้างข้อมูลแล้ว', 'ข้อมูลทั้งหมดถูกลบและกลับเป็นค่าเริ่มต้นแล้ว');
            } catch (e) {
              Alert.alert('เกิดข้อผิดพลาด', 'ล้างข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        <ScreenTitle title="ตั้งค่า" />

        {/* โหมดมืด */}
        <Card index={0}>
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
        <Card index={1}>
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
        <Card index={2}>
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
        <Card index={3}>
          <CardHeader Icon={Bell} color={COLORS.amber} title="ทดสอบการแจ้งเตือน" />
          <Text style={styles.infoLine}>กดเพื่อดูว่าเครื่องนี้แสดงป๊อปอัพและสั่นหรือไม่ (ไม่ต้องเชื่อมต่อเข็มขัด)</Text>
          <Button label="ทดสอบเตือนท่านั่งไม่ดี" onPress={() => notifyBadPosture('หลังค่อม')} color={COLORS.amber} />
          <Button label="ทดสอบเตือนนั่งนาน" onPress={() => notifySittingTooLong()} color={COLORS.amber} style={styles.secondButton} />
        </Card>

        {/* ล้างข้อมูลทั้งหมด */}
        <Card index={4}>
          <CardHeader Icon={Trash2} color={COLORS.red} title="จัดการข้อมูล" />
          <Text style={styles.infoLine}>
            ลบประวัติท่านั่ง คะแนน streak การประเมินความตึง และจำนวนครั้งที่ลุกยืดเส้น พร้อมคืนการตั้งค่าเป็นค่าเริ่มต้น (ไม่ตัดการเชื่อมต่อ Bluetooth)
          </Text>
          <Button label={clearing ? 'กำลังล้างข้อมูล...' : 'ล้างข้อมูลทั้งหมด'} onPress={confirmClearAll} disabled={clearing} color={COLORS.red} />
        </Card>

        {/* เกี่ยวกับแอป: ชื่อ/เวอร์ชัน/ฮาร์ดแวร์/เกณฑ์ อยู่ในหน้าแยก */}
        <Card index={5}>
          <BounceTouchable style={styles.linkRow} onPress={() => navigation.navigate('About')} accessibilityLabel="เปิดหน้าเกี่ยวกับแอป">
            <IconBadge Icon={Info} color={COLORS.purple} />
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>เกี่ยวกับแอป</Text>
              <Text style={styles.linkSub}>
                {APP_NAME_TH} · เวอร์ชัน {appConfig.expo.version}
              </Text>
            </View>
            <ChevronRight color={theme.faint} size={22} />
          </BounceTouchable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
    errorText: { fontSize: 13, color: COLORS.red, marginBottom: 8 },
    infoLine: { fontSize: 14, color: t.muted, marginBottom: 8 },
    linkRow: { flexDirection: 'row', alignItems: 'center' },
    linkText: { flex: 1, marginLeft: 12 },
    linkTitle: { fontSize: 18, fontWeight: '600', color: t.text2 },
    linkSub: { fontSize: 13, color: t.muted, marginTop: 2 },
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
