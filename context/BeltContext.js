import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  DEVICE_NAME,
  SERVICE_UUID,
  CHARACTERISTIC_UUID,
  BAD_POSTURE_SECONDS,
  FLUSH_INTERVAL_MS,
  SERVICE_VERIFY_DELAY_MS,
  WIDGET_HEARTBEAT_MS,
} from '../config';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, sanitizeSettings } from '../utils/settings';
import { applyDayScores, calculateWeeklyScore, computeWeekChange, getReadinessMessage } from '../utils/postureScore';
import { getLocalDateKey } from '../utils/postureStats';
import { getOverallStatus, isSittingAlert } from '../utils/overallStatus';
import { elapsedSince } from '../utils/sittingClock';
import { buildDailySummary, pickSummaryDay } from '../utils/dailySummary';
import { loadPainLog, regionsOf, savePainLog, setNoPain, toggleRegion } from '../utils/painLog';
import { isHomeWidgetAvailable, updateHomeWidget } from '../utils/homeWidget';
import { buildWidgetState } from '../utils/widgetState';
import { loadSummaryShownDate, saveSummaryShownDate } from '../utils/summaryState';
import {
  isBackgroundServiceAvailable,
  isBackgroundServiceRunning,
  openBatterySettings as openBatterySettingsNative,
  startBackgroundService,
  stopBackgroundService,
} from '../utils/backgroundService';
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
  const sittingLastRef = useRef(null); // เวลา (ms) ที่นับล่าสุด; null = ตอนนี้ไม่ได้นับ (ไม่ได้เชื่อมต่อ/หยุดชั่วคราว)
  const lastFlushAtRef = useRef(0); // เวลา (ms) ที่เขียนข้อมูลท่านั่งลงเครื่องล่าสุดจากข้อมูลเข็มขัด
  const tickSittingClockRef = useRef(() => {}); // ให้ callback ของ Bluetooth (ผูกไว้ตอนเชื่อมต่อ) เรียกนับเวลานั่งได้
  const sittingMinutesRef = useRef(0); // เวลานั่ง (นาที) ล่าสุดที่นับได้ — เขียนตอนนับเวลา ไม่ต้องรอ React วาดใหม่
  const [errorMsg, setErrorMsg] = useState(null);
  const connectedDeviceRef = useRef(null);
  const tiltSubscriptionRef = useRef(null);

  const [tilt, setTilt] = useState(null); // { pitch, roll } หน่วยองศา
  const badPostureSinceRef = useRef(null); // เวลา (ms) ที่เริ่มนั่งท่าไม่ดีต่อเนื่อง
  const [postureAlert, setPostureAlert] = useState(null); // ข้อความท่าไม่ดี แยกจาก isAlert (เตือนนั่งนาน)
  const postureAlertRef = useRef(null); // ค่าเดียวกับ postureAlert แต่อ่านได้ทันทีโดยไม่รอ React วาดใหม่

  // ข้อมูลจริงที่บันทึกจากเข็มขัด: weekData = 7 วันล่าสุด (ใช้คิดคะแนน), chartData = ช่วงที่เลือกดูในกราฟ
  const [weekData, setWeekData] = useState([]);
  const [historyReady, setHistoryReady] = useState(false); // โหลดประวัติ/คะแนนครั้งแรกเสร็จแล้ว (ก่อนหน้านั้นคะแนนเป็น null ชั่วคราว ไม่ควรส่งไปทับวิดเจ็ต)
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
  const isAlert = isSittingAlert({ isConnected, sittingTime, limitMinutes: settings.sittingAlertMinutes, dismissedUntil: alertDismissedUntil });

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
      painLoadRef.current = loadPainLog().then((log) => {
        painLogRef.current = log;
        setPainLog(log);
      });
      const reportLog = await getSelfReportLog();
      if (reportLog[todayKey]) setSelfRating(reportLog[todayKey]);
    })();
    setupNotifications(); // ขอสิทธิ์แจ้งเตือน + สร้าง channel
  }, []);

  // ---------- ตัวจับเวลานั่ง ----------
  // นับเวลานั่งเพิ่มตามเวลาจริงที่ผ่านไปนับจากครั้งก่อน แล้วอัปเดต sittingTime (นาที) — ใช้เฉพาะ ref และ setState จึงเรียกจาก callback เก่าได้อย่างปลอดภัย
  const tickSittingClock = () => {
    if (sittingLastRef.current === null) return; // ไม่ได้นับอยู่ (ไม่ได้เชื่อมต่อ/หยุดชั่วคราว)
    const now = Date.now();
    sittingMsRef.current += elapsedSince(sittingLastRef.current, now);
    sittingLastRef.current = now;
    const minutes = Math.floor(sittingMsRef.current / 60000);
    sittingMinutesRef.current = minutes; // ค่านี้ให้วิดเจ็ตอ่านตอนอยู่เบื้องหลังที่ React อาจยังไม่วาดใหม่
    setSittingTime((prev) => (prev === minutes ? prev : minutes));
  };
  tickSittingClockRef.current = tickSittingClock;

  // นับอัตโนมัติทันทีที่เชื่อมต่อ; หยุดนับเฉพาะตอนผู้ใช้กด "หยุดชั่วคราว" (isPaused) ค่าที่นับไว้ไม่หาย
  useEffect(() => {
    if (!isConnected || isPaused) return undefined;
    // sittingTime เก็บเป็นนาที นับสะสมตาม "เวลาจริง" ที่ผ่านไป (Date.now) ข้ามช่วงที่หยุดชั่วคราว
    // ไม่นับจำนวนรอบของตัวจับเวลา: ตอนปิดจอ/อยู่เบื้องหลัง Android อาจหน่วงหรือข้ามรอบ เวลานั่งจึงต้องไม่หาย
    // และตอนอยู่เบื้องหลัง React Native หยุดตัวจับเวลา JS ทั้งหมด (setInterval ไม่เดินเลย) จึงให้ข้อมูลจากเข็มขัด (ทุก 1 วินาที)
    // เรียกนับซ้ำอีกทางด้วย (tickSittingClock ใน callback ของ Bluetooth) — นับตามเวลาจริงจึงเรียกกี่ทางก็ไม่นับซ้ำ
    sittingLastRef.current = Date.now();
    const id = setInterval(tickSittingClock, 1000);
    return () => {
      clearInterval(id);
      if (sittingLastRef.current !== null) sittingMsRef.current += elapsedSince(sittingLastRef.current, Date.now()); // เศษเวลาช่วงสุดท้ายก่อนหยุด/ตัดการเชื่อมต่อ
      sittingLastRef.current = null;
    };
  }, [isConnected, isPaused]);

  // หลุด/ตัดการเชื่อมต่อด้วยเหตุใดก็ตาม: เริ่มนับเวลานั่งใหม่ เคลียร์เตือน และยกเลิกการหยุดชั่วคราว
  // (รอบเชื่อมต่อหน้ากลับมานับอัตโนมัติและเตือนได้อีก)
  useEffect(() => {
    if (!isConnected) {
      sittingMsRef.current = 0;
      sittingMinutesRef.current = 0;
      setSittingTime(0);
      setIsPaused(false);
      setAlertDismissedUntil(null); // เวลานั่งเริ่มใหม่ ไม่ต้องจำการกดยืดเส้นของรอบเก่า
    }
  }, [isConnected]);

  // ---------- ทำงานเบื้องหลัง (foreground service) ----------
  // เปิดตอนเชื่อมต่อเข็มขัดอยู่และผู้ใช้เปิดสวิตช์ไว้; ปิดตอนตัดการเชื่อมต่อหรือปิดสวิตช์
  // ตัว service แค่ให้ Android ไม่ปิด/แช่แข็งแอปตอนปิดจอ (การเชื่อมต่อ BLE/ตัวจับเวลา/การเตือนยังอยู่ใน JS เหมือนเดิม)
  // ถ้าเปิดไม่สำเร็จ แอปทำงานเหมือนเดิมทุกอย่าง แค่ไม่ได้รับการคุ้มครองตอนอยู่เบื้องหลัง (แสดงสถานะไว้ในหน้าตั้งค่า)
  const [serviceStatus, setServiceStatus] = useState({ state: 'off', message: null }); // off | starting | running | failed | unavailable
  const serviceWantRef = useRef(false); // ค่าที่ต้องการล่าสุด (ผู้เรียกที่ซ้อนกันจะดูค่านี้ ไม่ใช้ค่าที่ผูกไว้ตอนสั่ง)
  const serviceStartedRef = useRef(false);
  const serviceQueueRef = useRef(Promise.resolve()); // สั่งเริ่ม/หยุดทีละคำสั่งตามลำดับ กันสั่งหยุดแซงก่อนเริ่มเสร็จ
  useEffect(() => {
    if (!settingsReady) return; // รอโหลดการตั้งค่าก่อน กันเริ่มด้วยค่าเริ่มต้นทั้งที่ผู้ใช้ปิดไว้
    const want = isConnected && settings.backgroundService;
    serviceWantRef.current = want;
    serviceQueueRef.current = serviceQueueRef.current.then(async () => {
      if (serviceWantRef.current !== want) return; // มีคำสั่งใหม่กว่าแล้ว ข้ามอันนี้
      if (want) {
        if (!isBackgroundServiceAvailable()) {
          setServiceStatus({ state: 'unavailable', message: null });
          return;
        }
        setServiceStatus({ state: 'starting', message: null });
        const res = await startBackgroundService();
        if (!res.ok) {
          setServiceStatus({ state: 'failed', message: res.code ? `${res.code}: ${res.message}` : 'เปิดไม่สำเร็จ' });
          return;
        }
        serviceStartedRef.current = true;
        // ตรวจว่า service ขึ้นจริง (startForeground สำเร็จ) ไม่ใช่แค่สั่งเริ่ม; ไม่รอในคิว (ตัวจับเวลาหยุดตอนอยู่เบื้องหลัง ไม่ให้คิวค้าง)
        setTimeout(() => {
          if (!serviceWantRef.current) return;
          setServiceStatus(
            isBackgroundServiceRunning()
              ? { state: 'running', message: null }
              : { state: 'failed', message: 'สั่งเริ่มแล้วแต่ระบบไม่เปิด service (อาจถูกจำกัดโดยตัวเครื่อง/ยี่ห้อ)' }
          );
        }, SERVICE_VERIFY_DELAY_MS);
      } else {
        if (serviceStartedRef.current) {
          serviceStartedRef.current = false;
          await stopBackgroundService();
        }
        setServiceStatus({ state: 'off', message: null });
      }
    });
  }, [isConnected, settings.backgroundService, settingsReady]);

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
  // evaluatePostureAlert ทำงานได้ทั้งจาก effect นี้ (ตอน React วาดใหม่) และจาก callback ข้อมูลเข็มขัดโดยตรง (ตอนอยู่เบื้องหลังที่ React อาจไม่ได้วาดใหม่)
  // ผลเก็บใน postureAlertRef ให้วิดเจ็ตอ่านได้ทันที; คืนข้อความเตือนล่าสุด (null = ไม่เตือน)
  const evaluatePostureAlert = (tiltValue, paused) => {
    const status = getPostureStatus(paused ? null : tiltValue);
    if (!status.isBadPosture) {
      badPostureSinceRef.current = null;
      postureAlertRef.current = null;
      return null;
    }
    const now = Date.now();
    if (badPostureSinceRef.current === null) badPostureSinceRef.current = now;
    if (now - badPostureSinceRef.current >= BAD_POSTURE_SECONDS * 1000) {
      postureAlertRef.current = status.label;
    }
    return postureAlertRef.current;
  };
  useEffect(() => {
    setPostureAlert(evaluatePostureAlert(tilt, isPaused));
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
      setHistoryReady(true);
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
  // กลับมาหน้าจอ: โหลดกราฟ/คะแนน/streak ใหม่ทันที (ตอนอยู่เบื้องหลังตัวจับเวลารีเฟรชหยุดอยู่ ข้อมูลอาจเก่า) และนับเวลานั่งให้ทัน
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        flushPostureLog();
      } else {
        tickSittingClockRef.current();
        refreshHistory();
        checkDailySummary();
        pushWidgetRef.current(true);
      }
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
                if (!isPausedRef.current) {
                  recordPostureSample(getPostureStatus(parsed));
                  // ข้อมูลเข็มขัดมาทุก 1 วินาทีแม้ตอนอยู่เบื้องหลัง (ตัวจับเวลา JS หยุด) จึงใช้เป็นจังหวะนับเวลานั่งและเขียนข้อมูลลงเครื่องด้วย
                  tickSittingClockRef.current();
                  const nowMs = Date.now();
                  if (nowMs - lastFlushAtRef.current >= FLUSH_INTERVAL_MS) {
                    lastFlushAtRef.current = nowMs;
                    flushPostureLog();
                  }
                }
                // ส่งสถานะให้วิดเจ็ตท้ายสุด (หลังนับเวลาแล้ว): ตอนอยู่เบื้องหลัง React อาจไม่วาดใหม่ จึงประเมินท่านั่งไม่ดีและคำนวณค่าที่ส่งจาก ref ตรงนี้เลย
                // (evaluatePostureAlert ใช้แต่ ref และค่าคงที่ จึงเรียกจาก callback ที่ผูกไว้ตอนเชื่อมต่อได้อย่างปลอดภัย); ส่งเมื่อค่าเปลี่ยนหรือครบ ~5 นาที
                evaluatePostureAlert(parsed, isPausedRef.current);
                pushWidgetRef.current();
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

  // สถานะภาพรวมบน Home (เขียว/เหลือง/แดง/เทา) คำนวณจากสถานะที่มีอยู่แล้วทั้งหมด; ใช้กับวิดเจ็ตด้วย จึงคำนวณก่อนส่วนวิดเจ็ต
  // nextAlertAt = เวลานั่ง (นาที) ที่จะเตือนนั่งนานครั้งถัดไป (ขยับเมื่อกด "ยืดเส้นแล้ว")
  const nextAlertAt = alertDismissedUntil === null ? settings.sittingAlertMinutes : alertDismissedUntil;
  const overallStatus = getOverallStatus({
    isConnected,
    isPaused,
    postureAlert,
    isAlert,
    sittingTime,
    nextAlertAt,
    limitMinutes: settings.sittingAlertMinutes,
  });

  // ---------- วิดเจ็ตหน้าจอหลัก ----------
  // ส่งไปให้วิดเจ็ตจากจังหวะที่ทำงานตอนอยู่เบื้องหลังด้วย (ข้อมูลเข็มขัดทุก 1 วินาที)
  // ล้มเหลวเงียบๆ ได้: วิดเจ็ตเป็นส่วนเสริม ไม่กระทบแอปหลักและ background service
  // สิ่งที่วิดเจ็ตแสดง (สถานะท่านั่งตาม badge บน Home / เวลานั่ง / คะแนน) ตัดสินใจใน utils/widgetState.js จากสถานะที่แอปมีอยู่แล้ว ไม่คำนวณใหม่
  // สำคัญ: ตอนอยู่เบื้องหลัง React อาจไม่ได้วาดใหม่/รัน effect เลย (ค่า state ที่วาดไว้จะเก่าค้าง) จึงห้ามพึ่งค่าจากการวาด
  // ค่าที่ส่งให้วิดเจ็ตคำนวณจาก ref ทั้งหมดในจังหวะที่เรียก (ref เขียนตรงจากข้อมูลเข็มขัด/ตัวนับเวลา จึงสดเสมอ) ส่วนค่า state ที่วาดแล้วใช้เป็นแค่ตัวสั่งให้ส่ง
  // ส่งเมื่อค่าเปลี่ยน (เวลานั่งเปลี่ยนทุกนาทีจึงส่งทุกนาทีตอนเชื่อมต่ออยู่) และซ้ำทุก WIDGET_HEARTBEAT_MS ถ้าค่าไม่เปลี่ยน (เช่น ตอนหยุดชั่วคราว)
  const connectedRef = useRef(false);
  connectedRef.current = isConnected;
  const alertDismissedRef = useRef(null);
  alertDismissedRef.current = alertDismissedUntil;
  const scoreRef = useRef({ score: null, tierColor: readiness.color });
  scoreRef.current = { score, tierColor: readiness.color };
  const historyReadyRef = useRef(false);
  historyReadyRef.current = historyReady;
  const widgetLastPushRef = useRef({ at: 0, key: '' });
  const pushWidgetRef = useRef(() => {});

  // สถานะสำหรับวิดเจ็ตจาก ref ล้วน: ใช้ getOverallStatus / isSittingAlert ตัวเดียวกับหน้า Home
  const computeWidgetState = () => {
    const connected = connectedRef.current;
    const paused = isPausedRef.current;
    const minutes = sittingMinutesRef.current;
    const limitMinutes = settingsRef.current.sittingAlertMinutes;
    const dismissedUntil = alertDismissedRef.current;
    const nextAlert = dismissedUntil === null ? limitMinutes : dismissedUntil;
    const status = getOverallStatus({
      isConnected: connected,
      isPaused: paused,
      postureAlert: postureAlertRef.current,
      isAlert: isSittingAlert({ isConnected: connected, sittingTime: minutes, limitMinutes, dismissedUntil }),
      sittingTime: minutes,
      nextAlertAt: nextAlert,
      limitMinutes,
    });
    return buildWidgetState({
      overallStatus: status,
      isConnected: connected,
      isPaused: paused,
      sittingTime: minutes,
      nextAlertAt: nextAlert,
      score: scoreRef.current.score,
      tierColor: scoreRef.current.tierColor,
    });
  };
  const pushWidget = (force = false) => {
    if (!historyReadyRef.current) return; // ประวัติ/คะแนนยังโหลดไม่เสร็จ: คะแนนเป็น null ชั่วคราว ไม่ควรส่งไปทับค่าจริงของวิดเจ็ต
    const state = computeWidgetState();
    const key = JSON.stringify(state);
    const now = Date.now();
    const last = widgetLastPushRef.current;
    if (!force && key === last.key && now - last.at < WIDGET_HEARTBEAT_MS) return;
    widgetLastPushRef.current = { at: now, key };
    updateHomeWidget(state); // ไม่ต้องรอ และไม่โยน error
  };
  pushWidgetRef.current = pushWidget;
  // สั่งให้ส่งเมื่อสิ่งที่วาดเปลี่ยน (ผู้ใช้กดปุ่ม/ตั้งค่า/เชื่อมต่อ/ประวัติโหลดเสร็จ) — ค่าจริงที่ส่งคำนวณใน pushWidget ไม่ใช่ค่าจากการวาดนี้
  const widgetTriggerKey = `${historyReady}|${isConnected}|${isPaused}|${overallStatus.key}|${sittingTime}|${nextAlertAt}|${score}|${readiness.color}`;
  useEffect(() => {
    pushWidget();
  }, [widgetTriggerKey]);

  // ---------- บันทึกอาการปวด (body map) ----------
  // เก็บแยกจาก self-report แบบอิโมจิเดิม (ไม่แตะของเดิม) รายวันตามวันที่จริง; ใช้ ref ให้การแตะรัวๆ ต่อกันได้ไม่ทับกัน
  const [painLog, setPainLog] = useState({});
  const painLogRef = useRef({});
  const painLoadRef = useRef(null);
  const applyPain = async (update) => {
    if (painLoadRef.current) await painLoadRef.current; // รอโหลดข้อมูลเดิมก่อน กันเขียนทับ
    const next = update(painLogRef.current, getLocalDateKey()); // วันที่จริง ณ ตอนแตะ (ไม่ใช้ค่าที่ค้างจากการวาดครั้งก่อน เผื่อข้ามเที่ยงคืน)
    painLogRef.current = next;
    setPainLog(next);
    await savePainLog(next);
  };
  const togglePainRegion = (region) => applyPain((log, key) => toggleRegion(log, key, region));
  const setNoPainToday = () => applyPain((log, key) => setNoPain(log, key));
  const painToday = regionsOf(painLog, todayKey); // จุดที่ปวดวันนี้ | [] = บันทึกว่าไม่ปวด | null = ยังไม่ได้บันทึก

  // ---------- สรุปวันนี้ ----------
  // dailySummary = null (ปิดอยู่) | { data: สรุป | null (ยังไม่มีข้อมูล), auto: เด้งเอง? }
  const [dailySummary, setDailySummary] = useState(null);
  const summaryCheckedDayRef = useRef(null); // วันที่ (dateKey) ที่ตรวจว่าจะเด้งสรุปอัตโนมัติไปแล้วในรอบการใช้งานนี้ (กันตรวจ/เด้งซ้ำ)
  // โหลดข้อมูลสรุปของ "เมื่อวานหรือวันล่าสุดที่มีข้อมูล" (ย้อนดูได้ 30 วัน) จากข้อมูลที่เก็บไว้ทั้งหมด ไม่มีข้อมูลใหม่
  const loadDailySummaryData = async () => {
    const todayK = getLocalDateKey();
    const selfReports = await getSelfReportLog();
    const series = applyDayScores(await loadSeries('30d'), selfReports); // คะแนนวันนั้นหักตาม self-report เหมือนกราฟ
    const bucket = pickSummaryDay(series, todayK);
    if (!bucket) return null;
    const latestStreak = await loadStreak(); // streak ปัจจุบันจริง (ไม่ใช้ค่าในสถานะที่อาจยังโหลดไม่เสร็จตอนเปิดแอป)
    if (stretchLoadRef.current) await stretchLoadRef.current;
    return buildDailySummary({ bucket, streak: latestStreak, stretchCount: stretchLogRef.current[bucket.dateKey] || 0, todayKey: todayK });
  };
  // เด้งสรุปอัตโนมัติ "ครั้งแรกของวัน" เท่านั้น: จำวันที่ที่เด้งไปแล้วไว้ในเครื่อง; ไม่มีข้อมูลก็ไม่เด้ง
  const checkDailySummary = async () => {
    const today = getLocalDateKey();
    if (summaryCheckedDayRef.current === today) return;
    summaryCheckedDayRef.current = today;
    try {
      if ((await loadSummaryShownDate()) === today) return;
      const data = await loadDailySummaryData();
      if (!data) return;
      await saveSummaryShownDate(today); // จำก่อนแสดง: ถ้าแอปปิดกลางคัน ไม่เด้งซ้ำทั้งวัน
      setDailySummary({ data, auto: true });
    } catch (e) {
      console.log('ตรวจสรุปวันนี้ไม่สำเร็จ', e);
    }
  };
  // กดดูเองจากหน้า Home (ไม่นับเป็นการเด้งอัตโนมัติ และแสดงข้อความ "ยังไม่มีข้อมูล" ถ้าไม่มี)
  const openDailySummary = async () => {
    try {
      setDailySummary({ data: await loadDailySummaryData(), auto: false });
    } catch (e) {
      setDailySummary({ data: null, auto: false });
    }
  };
  const closeDailySummary = () => setDailySummary(null);

  // โหลดการตั้งค่าเสร็จ (เปิดแอป) แล้วตรวจสรุปครั้งแรกของวัน
  useEffect(() => {
    if (settingsReady) checkDailySummary();
  }, [settingsReady]);

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
    summaryCheckedDayRef.current = null;
    setDailySummary(null);
    painLogRef.current = {};
    painLoadRef.current = null;
    setPainLog({});
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
    serviceStatus,
    homeWidgetAvailable: isHomeWidgetAvailable(),
    backgroundServiceAvailable: isBackgroundServiceAvailable(),
    openBatterySettings: openBatterySettingsNative,
    clearAllData,
    painToday,
    togglePainRegion,
    setNoPainToday,
    dailySummary,
    openDailySummary,
    closeDailySummary,
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
