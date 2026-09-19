import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  DEVICE_NAME,
  SERVICE_UUID,
  CHARACTERISTIC_UUID,
  BAD_POSTURE_SECONDS,
  SITTING_ALERT_MINUTES,
  FLUSH_INTERVAL_MS,
} from '../config';
import { calculateWeeklyScore, getReadinessMessage } from '../utils/postureScore';
import { getLocalDateKey } from '../utils/postureStats';
import { recordPostureSample, flushPostureLog, loadSeries } from '../utils/postureLog';
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
  const [isAlert, setIsAlert] = useState(false); // เตือนนั่งนาน
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
  const { score, tier } = calculateWeeklyScore(weekData);
  const readiness = getReadinessMessage(tier);

  const [selfRating, setSelfRating] = useState(null);
  const todayKey = getLocalDateKey();

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  const chartRangeRef = useRef('7d'); // ค่าล่าสุดของ chartRange สำหรับ callback ที่ผูกไว้ตอนเชื่อมต่อ (กัน closure ค้างค่าเก่า)
  chartRangeRef.current = chartRange;

  // ---------- ตอนเปิดแอป ----------
  useEffect(() => {
    (async () => {
      const reportLog = await getSelfReportLog();
      if (reportLog[todayKey]) setSelfRating(reportLog[todayKey]);
    })();
    setupNotifications(); // ขอสิทธิ์แจ้งเตือน + สร้าง channel
  }, []);

  // ---------- ตัวจับเวลานั่ง ----------
  useEffect(() => {
    if (!isConnected) return undefined;
    // sittingTime เก็บเป็นนาที: เพิ่ม 1 ทุกๆ 60 วินาที
    const id = setInterval(() => {
      setSittingTime((prev) => {
        const nextTime = prev + 1;
        if (nextTime >= SITTING_ALERT_MINUTES) setIsAlert(true);
        return nextTime;
      });
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [isConnected]);

  // หลุด/ตัดการเชื่อมต่อด้วยเหตุใดก็ตาม: เริ่มนับเวลานั่งใหม่และเคลียร์เตือน (รอบเชื่อมต่อหน้าจะเตือนได้อีก)
  useEffect(() => {
    if (!isConnected) {
      setSittingTime(0);
      setIsAlert(false);
    }
  }, [isConnected]);

  // ---------- เตือนท่านั่งไม่ดี ----------
  // ผิดท่าต่อเนื่อง BAD_POSTURE_SECONDS วินาทีถึงจะเตือน; กลับมาท่าดีเมื่อไหร่เตือนหายและเริ่มนับใหม่
  useEffect(() => {
    const status = getPostureStatus(tilt);
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
  }, [tilt]);

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
      const week = await loadSeries('7d');
      setWeekData(week);
      setChartData(range === '7d' ? week : await loadSeries(range));
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
                recordPostureSample(getPostureStatus(parsed)); // นับเวลาท่าดี/ไม่ดีลงบันทึกรายวัน
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
    setIsAlert(false);
  };

  const toggleConnection = () => (isConnected ? disconnect() : connect());

  const connectLabel = isConnecting ? 'กำลังเชื่อมต่อ...' : isConnected ? 'ตัดการเชื่อมต่อ' : 'เชื่อมต่อ Bluetooth';

  // ---------- Self-report ----------
  const saveRating = async (rating) => {
    setSelfRating(rating);
    await saveSelfReport(todayKey, rating);
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
    // ประวัติ + คะแนน
    weekData,
    chartRange,
    setChartRange,
    chartData,
    score,
    tier,
    readiness,
    // self-report
    selfRating,
    saveRating,
  };

  return <BeltContext.Provider value={value}>{children}</BeltContext.Provider>;
}
