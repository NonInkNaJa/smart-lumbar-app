import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  DEVICE_NAME,
  SERVICE_UUID,
  CHARACTERISTIC_UUID,
  BAD_POSTURE_SECONDS,
  FLUSH_INTERVAL_MS,
} from '../config';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, sanitizeSettings } from '../utils/settings';
import { applyDayScores, calculateWeeklyScore, getReadinessMessage } from '../utils/postureScore';
import { getLocalDateKey } from '../utils/postureStats';
import { recordPostureSample, flushPostureLog, loadSeries, loadStreak } from '../utils/postureLog';
import { saveSelfReport, getSelfReportLog } from '../utils/storage';
import { parseTiltPayload } from '../utils/tilt';
import { getPostureStatus } from '../utils/posture';
import { setupNotifications, notifyBadPosture, notifySittingTooLong } from '../utils/notifications';

let bleManager = null;
try {
  bleManager = new BleManager();
} catch (e) {
  console.log('BleManager unavailable');
}

const BeltContext = createContext(null);

export function useBelt() {
  return useContext(BeltContext);
}

export function BeltProvider({ children }) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [sittingTime, setSittingTime] = useState(0); // หน่วย: นาที
  // การตั้งค่าของผู้ใช้ (เวลาเตือนนั่งนาน, dark mode) เก็บใน AsyncStorage; settingsReady = โหลดเสร็จแล้ว
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const updateSettings = (patch) => {
    const next = sanitizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
  };
  const [isPaused, setIsPaused] = useState(false); // ผู้ใช้กด "หยุดชั่วคราว" (ยังเชื่อมต่อ Bluetooth อยู่) รีเซ็ตเป็น false ทุกครั้งที่ไม่ได้เชื่อมต่อ
  const isPausedRef = useRef(false); // ให้ callback ของ Bluetooth (ผูกไว้ตอนเชื่อมต่อ) เห็นค่าล่าสุด
  isPausedRef.current = isPaused;
  const sittingSecondsRef = useRef(0); // นับเป็นวินาทีเพื่อไม่ให้เศษนาทีหายตอนหยุด/เริ่มต่อ
  const [errorMsg, setErrorMsg] = useState(null);
  const connectedDeviceRef = useRef(null);
  const tiltSubscriptionRef = useRef(null);

  const [tilt, setTilt] = useState(null); // { pitch, roll } หน่วยองศา
  const badPostureSinceRef = useRef(null); // เวลา (ms) ที่เริ่มนั่งท่าไม่ดีต่อเนื่อง
  const [postureAlert, setPostureAlert] = useState(null); // ข้อความท่าไม่ดี แยกจาก isAlert (เตือนนั่งนาน)

  // ข้อมูลจริงที่บันทึกจากเข็มขัด: weekData = 7 วันล่าสุด (ใช้คิดคะแนน), chartData = ช่วงที่เลือกดูในกราฟ
  const [weekData, setWeekData] = useState([]);
  const [chartRange, setChartRange] = useState('7d');
  const [chartData, setChartData] = useState([]);
  const [streak, setStreak] = useState(0); // จำนวนวันดี (ท่าไม่ดี < 30%) ติดต่อกัน
  const { score, tier, lowData, adjustment } = calculateWeeklyScore(weekData);
  const readiness = getReadinessMessage(tier);

  const [selfRating, setSelfRating] = useState(null);
  const todayKey = getLocalDateKey();

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  // เตือนนั่งนาน = นั่งต่อเนื่องถึงเวลาที่ผู้ใช้ตั้งไว้ (คำนวณจากเวลานั่งเทียบกับค่าที่ตั้งเสมอ
  // จึงปรับค่าตอนกำลังนั่งอยู่แล้วมีผลทันที และหลุดการเชื่อมต่อ = เวลานั่งเป็น 0 = ไม่เตือน)
  const isAlert = isConnected && sittingTime >= settings.sittingAlertMinutes;

  const chartRangeRef = useRef('7d'); // ค่าล่าสุดของ chartRange สำหรับ callback ที่ผูกไว้ตอนเชื่อมต่อ (กัน closure ค้างค่าเก่า)
  chartRangeRef.current = chartRange;

  // ---------- ตอนเปิดแอป ----------
  useEffect(() => {
    (async () => {
      const loaded = await loadSettings();
      settingsRef.current = loaded;
      setSettings(loaded);
      setSettingsReady(true);
      const reportLog = await getSelfReportLog();
      if (reportLog[todayKey]) setSelfRating(reportLog[todayKey]);
    })();
    setupNotifications(); // ขอสิทธิ์แจ้งเตือน + สร้าง channel
  }, []);

  // ---------- ตัวจับเวลานั่ง ----------
  // นับอัตโนมัติทันทีที่เชื่อมต่อ; หยุดนับเฉพาะตอนผู้ใช้กด "หยุดชั่วคราว" (isPaused) ค่าที่นับไว้ไม่หาย
  useEffect(() => {
    if (!isConnected || isPaused) return undefined;
    // sittingTime เก็บเป็นนาที (เพิ่ม 1 ทุกครบ 60 วินาทีที่นับจริง โดยนับสะสมเป็นวินาทีข้ามช่วงที่หยุด)
    const id = setInterval(() => {
      sittingSecondsRef.current += 1;
      const minutes = Math.floor(sittingSecondsRef.current / 60);
      setSittingTime((prev) => (prev === minutes ? prev : minutes));
    }, 1000);
    return () => clearInterval(id);
  }, [isConnected, isPaused]);

  // หลุด/ตัดการเชื่อมต่อด้วยเหตุใดก็ตาม: เริ่มนับเวลานั่งใหม่ เคลียร์เตือน และยกเลิกการหยุดชั่วคราว
  // (รอบเชื่อมต่อหน้ากลับมานับอัตโนมัติและเตือนได้อีก)
  useEffect(() => {
    if (!isConnected) {
      sittingSecondsRef.current = 0;
      setSittingTime(0);
      setIsPaused(false);
    }
  }, [isConnected]);

  const togglePause = () => setIsPaused((p) => !p);

  // ---------- เตือนท่านั่งไม่ดี ----------
  // ผิดท่าต่อเนื่อง BAD_POSTURE_SECONDS วินาทีถึงจะเตือน; กลับมาท่าดีเมื่อไหร่เตือนหายและเริ่มนับใหม่
  // ตอนหยุดชั่วคราว (ลุกไปประชุม/กินข้าว) ไม่ตรวจท่านั่ง: ถือว่าไม่ได้นั่ง
  useEffect(() => {
    const status = getPostureStatus(isPaused ? null : tilt);
    if (!status.isBadPosture) {
      badPostureSinceRef.current = null;
      setPostureAlert(null);
      return;
    }
    const now = Date.now();
    if (badPostureSinceRef.current === null) badPostureSinceRef.current = now;
    if (now - badPostureSinceRef.current >= BAD_POSTURE_SECONDS * 1000) {
      setPostureAlert(status.label);
    }
  }, [tilt, isPaused]);

  // ยิงแจ้งเตือนป๊อปอัพ "ครั้งเดียวต่อรอบ": ทำงานเฉพาะตอนสถานะเปลี่ยนจากไม่เตือน -> เตือน
  // (postureAlert หายเมื่อกลับมาท่าดี แล้วเตือนรอบใหม่จึงจะยิงอีกครั้ง; isAlert รีเซ็ตเมื่อหลุดการเชื่อมต่อ)
  const hasPostureAlert = postureAlert !== null;
  useEffect(() => {
    if (hasPostureAlert) notifyBadPosture(postureAlert);
  }, [hasPostureAlert]);

  useEffect(() => {
    if (isAlert) notifySittingTooLong();
  }, [isAlert]);

  // ---------- ประวัติท่านั่ง ----------
  const refreshHistory = async () => {
    try {
      const range = chartRangeRef.current;
      const selfReports = await getSelfReportLog(); // คะแนนรายวันต้องหักตาม self-report ของวันนั้น ๆ
      const week = applyDayScores(await loadSeries('7d'), selfReports);
      setWeekData(week);
      setChartData(range === '7d' ? week : applyDayScores(await loadSeries(range), selfReports));
      setStreak(await loadStreak());
    } catch (e) {
      console.log('โหลดประวัติท่านั่งไม่สำเร็จ', e);
    }
  };

  const saveAndRefreshHistory = async () => {
    await flushPostureLog();
    await refreshHistory();
  };

  // โหลดประวัติตอนเปิดแอป และทุกครั้งที่เปลี่ยนช่วงเวลากราฟ
  useEffect(() => {
    refreshHistory();
  }, [chartRange]);

  // ระหว่างเชื่อมต่อ: เขียนข้อมูลลงเครื่องเป็นรอบ ๆ แล้วรีเฟรชกราฟ
  useEffect(() => {
    if (!isConnected) return undefined;
    const id = setInterval(saveAndRefreshHistory, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, chartRange]);

  // ออกจากแอปไปพื้นหลัง: บันทึกข้อมูลที่ค้างอยู่ทันที กันหายถ้าระบบปิดแอป
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushPostureLog();
    });
    return () => sub.remove();
  }, []);

  // ---------- Bluetooth ----------
  const stopTiltMonitoring = () => {
    if (tiltSubscriptionRef.current) {
      tiltSubscriptionRef.current.remove();
      tiltSubscriptionRef.current = null;
      saveAndRefreshHistory(); // ตัดการเชื่อมต่อ: บันทึกข้อมูลที่ค้างอยู่
    }
    setTilt(null);
  };

  useEffect(() => {
    return () => {
      if (tiltSubscriptionRef.current) tiltSubscriptionRef.current.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  const connect = async () => {
    setErrorMsg(null);
    if (!bleManager) {
      setErrorMsg('อุปกรณ์นี้ไม่รองรับ Bluetooth (หรือเปิดใน Expo Go)');
      return;
    }
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
            stopTiltMonitoring();
            setConnectionState('disconnected');
            connectedDeviceRef.current = null;
          });

          // รับค่ามุมเอียง (NOTIFY) ที่เฟิร์มแวร์ส่งมาทุก 1 วินาที
          tiltSubscriptionRef.current = connectedDevice.monitorCharacteristicForService(
            SERVICE_UUID,
            CHARACTERISTIC_UUID,
            (monitorError, characteristic) => {
              if (monitorError) return; // ตอนตัดการเชื่อมต่อจะมี error ตามมา ซึ่ง onDisconnected จัดการอยู่แล้ว
              const parsed = parseTiltPayload(characteristic?.value);
              if (parsed) {
                setTilt(parsed);
                // นับเวลาท่าดี/ไม่ดีลงบันทึกรายวัน (ข้ามตอนหยุดชั่วคราว: ไม่ได้นั่งอยู่ ไม่ให้ประวัติเพี้ยน)
                if (!isPausedRef.current) recordPostureSample(getPostureStatus(parsed));
              }
            }
          );

          setConnectionState('connected');
        } catch (e) {
          setConnectionState('disconnected');
          setErrorMsg('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      }
    });
  };

  const disconnect = async () => {
    stopTiltMonitoring();
    if (connectedDeviceRef.current) {
      await connectedDeviceRef.current.cancelConnection();
    }
    setConnectionState('disconnected');
    setSittingTime(0);
  };

  const toggleConnection = () => (isConnected ? disconnect() : connect());

  const connectLabel = isConnecting ? 'กำลังเชื่อมต่อ...' : isConnected ? 'ตัดการเชื่อมต่อ' : 'เชื่อมต่อ Bluetooth';

  // ---------- Self-report ----------
  const saveRating = async (rating) => {
    setSelfRating(rating);
    await saveSelfReport(todayKey, rating);
    await refreshHistory(); // self-report มีผลต่อคะแนนและกราฟ: คำนวณใหม่ทันที
  };

  const value = {
    // Bluetooth
    connectionState,
    isConnected,
    isConnecting,
    errorMsg,
    toggleConnection,
    connectLabel,
    // ท่านั่ง/เวลานั่ง
    tilt,
    postureAlert,
    sittingTime,
    isAlert,
    isPaused,
    togglePause,
    // การตั้งค่า
    settings,
    settingsReady,
    updateSettings,
    // ประวัติ + คะแนน
    streak,
    weekData,
    chartRange,
    setChartRange,
    chartData,
    score,
    tier,
    lowData,
    adjustment,
    readiness,
    // self-report
    selfRating,
    saveRating,
  };

  return <BeltContext.Provider value={value}>{children}</BeltContext.Provider>;
}
