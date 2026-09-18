import AsyncStorage from '@react-native-async-storage/async-storage';

const SELF_REPORT_KEY = 'selfReportLog';
const TRAINING_PLAN_KEY = 'trainingPlan';

export async function saveSelfReport(dateKey, rating) {
  const raw = await AsyncStorage.getItem(SELF_REPORT_KEY);
  const log = raw ? JSON.parse(raw) : {};
  log[dateKey] = rating;
  await AsyncStorage.setItem(SELF_REPORT_KEY, JSON.stringify(log));
  return log;
}

export async function getSelfReportLog() {
  const raw = await AsyncStorage.getItem(SELF_REPORT_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveTrainingIntensity(dateKey, intensity) {
  const raw = await AsyncStorage.getItem(TRAINING_PLAN_KEY);
  const plan = raw ? JSON.parse(raw) : {};
  plan[dateKey] = intensity;
  await AsyncStorage.setItem(TRAINING_PLAN_KEY, JSON.stringify(plan));
  return plan;
}

export async function getTrainingPlan() {
  const raw = await AsyncStorage.getItem(TRAINING_PLAN_KEY);
  return raw ? JSON.parse(raw) : {};
}
