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
import { applyDayScores, calculateWeeklyScore, computeWeekChange, getReadinessMessage } from '../utils/postureScore';
import { getLocalDateKey } from '../utils/postureStats';
import { getOverallStatus } from '../utils/overallStatus';
import { elapsedSince } from '../utils/sittingClock';
import { addStretch, countInKeys, loadStretchLog, saveStretchLog } from '../utils/stretchLog';
import { decideCelebration, loadCelebrationState, saveCelebrationState } from '../utils/streakCelebration';
import { recordPostureSample, flushPostureLog, loadSeries, loadStreak, wipeAllStoredData } from '../utils/postureLog';
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
  const sittingMsRef = useRef(0); // เวลานั่งสะสม (มิลลิวินาที) นับตามเวลาจริง ไม่ให้เศษนาทีหายตอนหยุด/เริ่มต่อ
  const [errorMsg, setErrorMsg] = useState(null);
  const connectedDeviceRef = useRef(null);
  const tiltSubscriptionRef = useRef(null);

  const [tilt, setTilt] = useState(null); // { pitch, roll } หน่วยองศา
  const badPostureSinceRef = useRef(null); // เวลา (ms) ที่เริ่มนั่งท่าไม่ดีต่อเนื่อง
  const [postureAlert, setPostureAlert] = useState(null); // ข้อความท่าไม่ดี แยกจาก isAlert (เตือนนั่งนาน)

  // ข้อมูลจริงที่บันทึกจากเข็มขัด: weekData = 7 วันล่าสุด (ใช้คิดคะแนน), chartData = ช่วงที่เลือกดูในกราฟ
  const [weekData, setWeekData] = useState([]);
  const [prevWeekData, setPrevWeekData] = useState([]); // 7 วันก่อนหน้าสัปดาห์นี้ (ใช้เทียบ % การเปลี่ยนแปลง)
  const [chartRange, setChartRange] = useState('7d');
  const [chartData, setChartData] = useState([]);
  const [streak, setStreak] = useState(0); // จำนวนวันดี (ท่าไม่ดี < 30%) ติดต่อกัน
  const [confettiKey, setConfettiKey] = useState(0); // เพิ่มทีละ 1 ทุกครั้งที่ streak เพิ่มเป็นวันใหม่ -> ยิง confetti
  const celebrationRef = useRef(null); // { streak, celebratedOn } ที่เก็บไว้ (null = ยังไม่เคย/ยังไม่โหลด)
  const celebrationLoadRef = useRef(null); // promise โหลดสถานะฉลองครั้งเดียว (ให้ refreshHistory ที่ซ้อนกันรอผลเดียวกัน)
  const { score, tier, lowData } = calculateWeeklyScore(weekData);
  const readiness = getReadinessMessage(tier);
  const weekChange = computeWeekChange(score, calculateWeeklyScore(prevWeekData).score); // null = ไม่มีข้อมูลสัปดาห์ก่อน -> ไม่แสดง

  const [selfRating, setSelfRating] = useState(null);
  const todayKey = getLocalDateKey();

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  // เตือนนั่งนาน = นั่งต่อเนื่องถึงเวลาที่ผู้ใช้ตั้งไว้ (คำนวณจากเวลานั่งเทียบกับค่าที่ตั้งเสมอ
  // จึงปรับค่าตอนกำลังนั่งอยู่แล้วมีผลทันที และหลุดการเชื่อมต่อ = เวลานั่งเป็น 0 = ไม่เตือน)
  // กด "ยืดเส้น/ลุกแล้ว" = ซ่อนเตือนจนกว่าจะนั่งต่ออีกครบเวลาที่ตั้ง (ไม่รีเซ็ตเวลานั่ง; เวลานั่งยังเดินต่อ) แล้วเตือนรอบใหม่
  const [alertDismissedUntil, setAlertDismissedUntil] = useState(null); // เวลานั่ง (นาที) ที่เตือนรอบใหม่จะกลับมา
  const isAlert =
    isConnected && sittingTime >= settings.sittingAlertMinutes && (alertDismissedUntil === null || sittingTime >= alertDismissedUntil);

  // จำนวนครั้งที่ลุกยืดเส้นต่อวัน (เก็บในเครื่อง)
  const [stretchLog, setStretchLog] = useState({});
  const stretchLogRef = useRef({});
  const stretchLoadRef = useRef(null);

  const chartRangeRef = useRef('7d'); // ค่าล่าสุดของ chartRange สำหรับ callback ที่ผูกไว้ตอนเชื่อมต่อ (กัน closure ค้างค่าเก่า)
  chartRangeRef.current = chartRange;

  // ---------- ตอนเปิดแอป ----------
  useEffect(() => {
    (async () => {
      const loaded = await loadSettings();
      settingsRef.current = loaded;
      setSettings(loaded);
      setSettingsReady(true);
      stretchLoadRef.current = loadStretchLog().then((log) => {
        stretchLogRef.current = log;
        setStretchLog(log);
      });
      const reportLog = await getSelfReportLog();
      if (reportLog[todayKey]) setSelfRating(reportLog[todayKey]);
    })();
    setupNotifications(); // ขอสิทธิ์แจ้งเตือน + สร้าง channel
  }, []);

  // ---------- ตัวจับเวลานั่ง ----------
  // นับอัตโนมัติทันทีที่เชื่อมต่อ; หยุดนับเฉพาะตอนผู้ใช้กด "หยุดชั่วคราว" (isPaused) ค่าที่นับไว้ไม่หาย
  useEffect(() => {
    if (!isConnected || isPaused) return undefined;
    // sittingTime เก็บเป็นนาที นับสะสมตาม "เวลาจริง" ที่ผ่านไป (Date.now) ข้ามช่วงที่หยุดชั่วคราว
    // ไม่นับจำนวนรอบของตัวจับเวลา: ตอนปิดจอ/อยู่เบื้องหลัง Android อาจหน่วงหรือข้ามรอบ เวลานั่งจึงต้องไม่หาย
    let last = Date.now();
    const accumulate = () => {
      const now = Date.now();
      sittingMsRef.current += elapsedSince(last, now);
      last = now;
    };
    const id = setInterval(() => {
      accumulate();
      const minutes = Math.floor(sittingMsRef.current / 60000);
      setSittingTime((prev) => (prev === minutes ? prev : minutes));
    }, 1000);
    return () => {
      clearInterval(id);
      accumulate(); // เก็บเศษเวลาช่วงสุดท้ายก่อนหยุด/ตัดการเชื่อมต่อ
    };
  }, [isConnected, isPaused]);

  // หลุด/ตัดการเชื่อมต่อด้วยเหตุใดก็ตาม: เริ่มนับเวลานั่งใหม่ เคลียร์เตือน และยกเลิกการหยุดชั่วคราว
  // (รอบเชื่อมต่อหน้ากลับมานับอัตโนมัติและเตือนได้อีก)
  useEffect(() => {
    if (!isConnected) {
      sittingMsRef.current = 0;
      setSittingTime(0);
      setIsPaused(false);
      setAlertDismissedUntil(null); // เวลานั่งเริ่มใหม่ ไม่ต้องจำการกดยืดเส้นของรอบเก่า
    }
  }, [isConnected]);

  const togglePause = () => setIsPaused((p) => !p);

  // ผู้ใช้ยืนยันว่าลุก/ยืดเส้นแล้ว: ซ่อนเตือนรอบนี้ + นับเพิ่ม 1 ครั้งของวันนี้ (ไม่รีเซ็ตเวลานั่ง)
  const confirmStretch = async () => {
    setAlertDismissedUntil(sittingTime + settings.sittingAlertMinutes);
    if (stretchLoadRef.current) await stretchLoadRef.current; // รอโหลดข้อมูลเดิมก่อน กันเขียนทับ
    const next = addStretch(stretchLogRef.current, getLocalDateKey());
    stretchLogRef.current = next;
    setStretchLog(next);
    await saveStretchLog(next);
  };

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

  // ---------- ฉลอง streak ----------
  // เรียกทุกครั้งที่โหลด streak ใหม่: ส่วนหลัง await ไม่มีการรอคั่น จึงไม่ยิงซ้ำแม้ refreshHistory ซ้อนกัน
  const checkStreakCelebration = async (newStreak) => {
    if (!celebrationLoadRef.current) {
      celebrationLoadRef.current = loadCelebrationState().then((s) => {
        celebrationRef.current = s;
      });
    }
    await celebrationLoadRef.current;
    const { celebrate, next } = decideCelebration(newStreak, celebrationRef.current, getLocalDateKey());
    celebrationRef.current = next;
    saveCelebrationState(next);
    if (celebrate) setConfettiKey((k) => k + 1);
  };

  // ---------- ประวัติท่านั่ง ----------
  const historySeqRef = useRef(0); // เลขรอบโหลดล่าสุด: รอบเก่าที่เสร็จช้ากว่า (เช่น โหลดค้างตอนกดล้างข้อมูล) ไม่เขียนทับผลของรอบใหม่
  const refreshHistory = async () => {
    const seq = ++historySeqRef.current;
    try {
      const range = chartRangeRef.current;
      const selfReports = await getSelfReportLog(); // คะแนนรายวันต้องหักตาม self-report ของวันนั้น ๆ
      const week = applyDayScores(await loadSeries('7d'), selfReports);
      const prevWeek = applyDayScores(await loadSeries('prev7d'), selfReports);
      const chart = range === '7d' ? week : applyDayScores(await loadSeries(range), selfReports);
      const newStreak = await loadStreak();
      if (seq !== historySeqRef.current) return;
      setWeekData(week);
      setPrevWeekData(prevWeek);
      setChartData(chart);
      setStreak(newStreak);
      await checkStreakCelebration(newStreak);
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

  // ---------- ล้างข้อมูลทั้งหมด ----------
  // ลบทุกอย่างที่เก็บในเครื่อง แล้วรีเซ็ตสถานะในหน่วยความจำให้เป็นค่าเริ่มต้น
  // ไม่แตะ Bluetooth: ยังเชื่อมต่อต่อได้ และตัวจับเวลานั่งที่กำลังเดินอยู่ก็เดินต่อ (ไม่ใช่ข้อมูลที่เก็บไว้) ข้อมูลที่เข็มขัดส่งมาหลังจากนี้จะเริ่มบันทึกใหม่
  const clearAllData = async () => {
    await wipeAllStoredData();
    const defaults = { ...DEFAULT_SETTINGS };
    settingsRef.current = defaults;
    setSettings(defaults);
    setSelfRating(null);
    stretchLogRef.current = {};
    stretchLoadRef.current = null;
    setStretchLog({});
    celebrationRef.current = null; // baseline streak เริ่มใหม่ (ไม่ฉลองจากข้อมูลที่เพิ่งล้าง)
    celebrationLoadRef.current = null;
    chartRangeRef.current = '7d';
    setChartRange('7d');
    await refreshHistory();
  };

  // ---------- Self-report ----------
  const saveRating = async (rating) => {
    setSelfRating(rating);
    await saveSelfReport(todayKey, rating);
    await refreshHistory(); // self-report มีผลต่อคะแนนและกราฟ: คำนวณใหม่ทันที
  };

  // สถานะภาพรวมบน Home (เขียว/เหลือง/แดง/เทา) คำนวณจากสถานะที่มีอยู่แล้วทั้งหมด (ประกาศ postureAlert แล้วตรงนี้)
  const overallStatus = getOverallStatus({
    isConnected,
    isPaused,
    postureAlert,
    isAlert,
    sittingTime,
    nextAlertAt: alertDismissedUntil === null ? settings.sittingAlertMinutes : alertDismissedUntil,
    limitMinutes: settings.sittingAlertMinutes,
  });

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
    overallStatus,
    confirmStretch,
    stretchToday: stretchLog[todayKey] || 0,
    stretchInChart: countInKeys(stretchLog, chartData.map((d) => d.dateKey)),
    isPaused,
    togglePause,
    // การตั้งค่า
    settings,
    settingsReady,
    updateSettings,
    clearAllData,
    // ประวัติ + คะแนน
    streak,
    confettiKey,
    weekData,
    chartRange,
    setChartRange,
    chartData,
    score,
    tier,
    lowData,
    weekChange,
    readiness,
    // self-report
    selfRating,
    saveRating,
  };

  return <BeltContext.Provider value={value}>{children}</BeltContext.Provider>;
}
