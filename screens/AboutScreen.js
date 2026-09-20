import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ChevronLeft, Cpu, Info, Ruler } from 'lucide-react-native';
import appConfig from '../app.json';
import {
  APP_NAME_EN,
  APP_NAME_TH,
  BAD_POSTURE_SECONDS,
  DEVICE_NAME,
  HUNCH_ROLL_THRESHOLD,
  SLUMP_PITCH_THRESHOLD,
} from '../config';
import { GOOD_DAY_MAX_BAD_RATIO } from '../utils/postureStats';
import { useBelt } from '../context/BeltContext';
import { Card, CardHeader, COLORS, Screen, ScreenTitle, useScreenStyles } from '../components/ui';
import { BounceTouchable } from '../components/motion';
import { Mascot } from '../components/Mascot';
import { useTheme } from '../components/theme';

// หน้าเกี่ยวกับแอป (เปิดจากหน้าตั้งค่า; เป็นหน้าซ่อนในแถบแท็บ): ชื่อ เวอร์ชัน ฮาร์ดแวร์ คำอธิบายสั้นๆ และเกณฑ์การทำงาน
export default function AboutScreen({ navigation }) {
  const { settings, tier } = useBelt();
  const theme = useTheme();
  const screen = useScreenStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={screen.scrollContent}>
        <BounceTouchable style={styles.backButton} onPress={() => navigation.navigate('Settings')} accessibilityLabel="กลับไปหน้าตั้งค่า">
          <ChevronLeft color={theme.number} size={22} />
          <Text style={styles.backText}>ตั้งค่า</Text>
        </BounceTouchable>

        <Mascot tier={tier} size={96} character="heart" />
        <ScreenTitle title="เกี่ยวกับแอป" />

        {/* ชื่อ + เวอร์ชัน + คำอธิบาย */}
        <Card index={0}>
          <CardHeader Icon={Info} color={COLORS.purple} title="แอปพลิเคชัน" />
          <Text style={styles.appName}>{APP_NAME_TH}</Text>
          <Text style={styles.infoLine}>{APP_NAME_EN}</Text>
          <Text style={styles.infoLine}>เวอร์ชัน {appConfig.expo.version}</Text>
          <Text style={styles.description}>
            ช่วยเตือนเมื่อนั่งหลังค่อม เอนหลังไม่ดี หรือนั่งนานเกินไป ผ่านเข็มขัดพยุงหลังอัจฉริยะที่วัดมุมเอียงของลำตัวแบบเรียลไทม์
            แล้วสรุปเป็นคะแนนความพร้อม ประวัติ และท่ายืดเหยียดที่เหมาะกับคุณ
          </Text>
        </Card>

        {/* ฮาร์ดแวร์ */}
        <Card index={1}>
          <CardHeader Icon={Cpu} color={COLORS.blue} title="ฮาร์ดแวร์" />
          <Text style={styles.infoLine}>บอร์ดควบคุม: ESP32 DevKit</Text>
          <Text style={styles.infoLine}>เซนเซอร์: MPU6050 (วัดมุมเอียง pitch / roll)</Text>
          <Text style={styles.infoLine}>การเชื่อมต่อ: Bluetooth Low Energy (ชื่ออุปกรณ์ {DEVICE_NAME})</Text>
        </Card>

        {/* เกณฑ์การทำงาน (ย้ายมาจากหน้าตั้งค่า) */}
        <Card index={2}>
          <CardHeader Icon={Ruler} color={COLORS.amber} title="เกณฑ์การทำงาน" />
          <Text style={styles.infoLine}>
            เกณฑ์เตือนท่านั่ง: หลังค่อมเมื่อ roll ต่ำกว่า {HUNCH_ROLL_THRESHOLD}°, เอนหลังไม่ดีเมื่อ pitch ต่ำกว่า {SLUMP_PITCH_THRESHOLD}° (ต่อเนื่อง{' '}
            {BAD_POSTURE_SECONDS} วินาที)
          </Text>
          <Text style={styles.infoLine}>เตือนนั่งนานเมื่อนั่งต่อเนื่องเกิน {settings.sittingAlertMinutes} นาที</Text>
          <Text style={styles.infoLine}>
            วันดี (นับ streak) = วันที่นั่งท่าไม่ดีต่ำกว่า {Math.round(GOOD_DAY_MAX_BAD_RATIO * 100)}% ของเวลา
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12, marginBottom: 8 },
    backText: { fontSize: 16, fontWeight: '600', color: t.number }, // สีน้ำเงินตามธีม: อ่านชัดบนพื้นหลังทั้งสองโหมด
    appName: { fontSize: 22, fontWeight: 'bold', color: t.text },
    infoLine: { fontSize: 14, color: t.muted, marginBottom: 8 },
    description: { fontSize: 14, color: t.text2, lineHeight: 21, marginTop: 4 },
  });
