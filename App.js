import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, PermissionsAndroid, Platform, Alert } from 'react-native';
import { Activity, Bluetooth, ShieldAlert, Clock, Share2, CalendarDays } from 'lucide-react-native';
import { BleManager } from 'react-native-ble-plx';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  calculateWeeklyScore,
  getReadinessMessage,
  getTrainingAdjustment,
  generateMockWeekData,
} from './utils/postureScore';
import {
  saveSelfReport,
  getSelfReportLog,
  saveTrainingIntensity,
  getTrainingPlan,
} from './utils/storage';

const DEVICE_NAME = 'SmartLumbarBelt';
const SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000yyyy-0000-1000-8000-00805f9b34fb';

let bleManager = null; try { bleManager = new BleManager(); } catch(e) { console.log("BleManager unavailable"); }

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function App() {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [sittingTime, setSittingTime] = useState(0);
  const [isAlert, setIsAlert] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const connectedDeviceRef = useRef(null);

  const [weekData] = useState(generateMockWeekData()); // TODO: เปลี่ยนเป็นข้อมูลจริงจาก BLE ทีหลัง
  const { score, tier } = calculateWeeklyScore(weekData);
  const readiness = getReadinessMessage(tier);

  const [selfRating, setSelfRating] = useState(null);
  const [plannedIntensity, setPlannedIntensity] = useState(null);
  const todayKey = getTodayKey();

  const viewShotRef = useRef(null);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  useEffect(() => {
    (async () => {
      const reportLog = await getSelfReportLog();
      if (reportLog[todayKey]) setSelfRating(reportLog[todayKey]);
      const plan = await getTrainingPlan();
      if (plan[todayKey]) setPlannedIntensity(plan[todayKey]);
    })();
  }, []);

  useEffect(() => {
    let interval = null;
    if (isConnected) {
      interval = setInterval(() => {
        setSittingTime((prev) => {
          const nextTime = prev + 1;
          if (nextTime >= 45) setIsAlert(true);
          return nextTime;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  const handleConnect = async () => {
    setErrorMsg(null);
    const permitted = await requestPermissions();
    if (!permitted) {
      setErrorMsg('ต้องอนุญาตสิทธิ์ Bluetooth/Location ก่อนเชื่อมต่อ');
      return;
    }

    setConnectionState('connecting');

    const timeout = setTimeout(() => {
      bleManager.stopDeviceScan();
      setConnectionState('disconnected');
      setErrorMsg('ไม่พบเข็มขัด กรุณาตรวจสอบว่าเปิดเครื่องแล้ว');
    }, 10000);

    bleManager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        clearTimeout(timeout);
        setConnectionState('disconnected');
        setErrorMsg('เกิดข้อผิดพลาดขณะค้นหาอุปกรณ์');
        return;
      }

      if (device.name === DEVICE_NAME) {
        bleManager.stopDeviceScan();
        clearTimeout(timeout);
        try {
          const connectedDevice = await device.connect();
          await connectedDevice.discoverAllServicesAndCharacteristics();
          connectedDeviceRef.current = connectedDevice;

          connectedDevice.onDisconnected(() => {
            setConnectionState('disconnected');
            connectedDeviceRef.current = null;
          });

          setConnectionState('connected');
        } catch (e) {
          setConnectionState('disconnected');
          setErrorMsg('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      }
    });
  };

  const handleDisconnect = async () => {
    if (connectedDeviceRef.current) {
      await connectedDeviceRef.current.cancelConnection();
    }
    setConnectionState('disconnected');
    setSittingTime(0);
    setIsAlert(false);
  };

  const getButtonLabel = () => {
    if (isConnecting) return 'กำลังเชื่อมต่อ...';
    if (isConnected) return 'ตัดการเชื่อมต่อ';
    return 'เชื่อมต่อ Bluetooth';
  };

  const handleSelfReport = async (rating) => {
    setSelfRating(rating);
    await saveSelfReport(todayKey, rating);
  };

  const handleSelectIntensity = async (intensity) => {
    setPlannedIntensity(intensity);
    await saveTrainingIntensity(todayKey, intensity);
  };

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

  const adjustment = getTrainingAdjustment(tier, plannedIntensity);
  const ratingEmojis = ['😖', '😕', '😐', '🙂', '😄'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Smart Lumbar Belt</Text>

        {/* การเชื่อมต่อ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bluetooth color={isConnected ? "#10B981" : "#6B7280"} size={24} />
            <Text style={styles.cardTitle}>สถานะการเชื่อมต่อ</Text>
          </View>
          <Text style={[styles.statusText, { color: isConnected ? "#10B981" : "#EF4444" }]}>
            {isConnecting ? "กำลังค้นหาเข็มขัด..." : isConnected ? "เชื่อมต่อเข็มขัดแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
          </Text>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: isConnected ? "#EF4444" : isConnecting ? "#9CA3AF" : "#2563EB" }]}
            onPress={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
          >
            <Text style={styles.buttonText}>{getButtonLabel()}</Text>
          </TouchableOpacity>
        </View>

        {/* เวลานั่ง */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock color="#2563EB" size={24} />
            <Text style={styles.cardTitle}>ระยะเวลานั่งต่อเนื่อง</Text>
          </View>
          <Text style={styles.timerText}>{sittingTime} นาที</Text>
          {isAlert && (
            <View style={styles.alertBox}>
              <ShieldAlert color="#EF4444" size={20} />
              <Text style={styles.alertText}>นั่งนานเกินกำหนด! ควรยืดกล้ามเนื้อ</Text>
            </View>
          )}
        </View>

        {/* คะแนนความพร้อม + กราฟ (ห่อด้วย ViewShot เพื่อ export) */}
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Activity color={readiness.color} size={24} />
              <Text style={styles.cardTitle}>ความพร้อมออกกำลังกายสัปดาห์นี้</Text>
            </View>
            <Text style={[styles.scoreText, { color: readiness.color }]}>{score}/100</Text>
            <Text style={[styles.tierLabel, { color: readiness.color }]}>{readiness.label}</Text>
            <Text style={styles.demoLabel}>* ข้อมูลตัวอย่าง จะอัปเดตเป็นข้อมูลจริงหลังใช้งานต่อเนื่อง</Text>
            <Text style={styles.adviceText}>{readiness.advice}</Text>

            <View style={styles.barChartRow}>
              {weekData.map((day, i) => (
                <View key={i} style={styles.barColumn}>
                  <View style={[styles.bar, { height: Math.max(day.badPostureRatio * 60, 4), backgroundColor: readiness.color }]} />
                  <Text style={styles.barLabel}>{day.date}</Text>
                </View>
              ))}
            </View>
          </View>
        </ViewShot>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Share2 color="#FFFFFF" size={18} />
          <Text style={styles.shareButtonText}>แชร์สรุปสัปดาห์นี้</Text>
        </TouchableOpacity>

        {/* Self-report */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>วันนี้หลังตึงแค่ไหน?</Text>
          </View>
          <View style={styles.ratingRow}>
            {ratingEmojis.map((emoji, i) => {
              const value = i + 1;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.ratingButton, selfRating === value && styles.ratingButtonSelected]}
                  onPress={() => handleSelfReport(value)}
                >
                  <Text style={styles.ratingEmoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selfRating && <Text style={styles.savedText}>บันทึกแล้ว ✓</Text>}
        </View>

        {/* ท่ายืดเหยียดที่แนะนำวันนี้ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CalendarDays color="#2563EB" size={24} />
            <Text style={styles.cardTitle}>ท่ายืดเหยียดที่แนะนำวันนี้</Text>
          </View>
          {getRecommendedRoutine(tier).map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>• {ex.name}</Text>
              {ex.detail && <Text style={styles.exerciseDetail}>{ex.detail}</Text>}
            </View>
          ))}
        </View>

        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginLeft: 8, color: '#374151' },
  statusText: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  errorText: { fontSize: 13, color: '#EF4444', marginBottom: 8 },
  timerText: { fontSize: 36, fontWeight: 'bold', color: '#1D4ED8', textAlign: 'center', marginVertical: 10 },
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginTop: 10 },
  alertText: { color: '#EF4444', marginLeft: 8, fontWeight: '500' },
  scoreText: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  tierLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  adviceText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  barChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
  barColumn: { alignItems: 'center', flex: 1 },
  bar: { width: 16, borderRadius: 4 },
  barLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  shareButton: { flexDirection: 'row', backgroundColor: '#374151', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  shareButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, marginLeft: 8 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingButton: { padding: 10, borderRadius: 8, backgroundColor: '#F3F4F6' },
  ratingButtonSelected: { backgroundColor: '#DBEAFE' },
  ratingEmoji: { fontSize: 24 },
  savedText: { fontSize: 13, color: '#10B981', textAlign: 'center', marginTop: 10 },
  intensityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityButton: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  intensityButtonSelected: { backgroundColor: '#2563EB' },
  intensityButtonText: { fontWeight: '600', color: '#374151' },
  intensityButtonTextSelected: { color: '#FFFFFF' },
  adjustmentBox: { padding: 10, borderRadius: 8, marginTop: 12 },
  adjustmentText: { fontSize: 13, fontWeight: '500' },
  demoLabel: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginBottom: 12 },
  exerciseRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  exerciseName: { fontSize: 15, color: "#374151", fontWeight: "500" },
  exerciseDetail: { fontSize: 13, color: "#6B7280", marginLeft: 14, marginTop: 2 },
});