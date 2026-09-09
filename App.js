import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Activity, Bluetooth, ShieldAlert, Clock } from 'lucide-react-native';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [sittingTime, setSittingTime] = useState(0);
  const [isAlert, setIsAlert] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Smart Lumbar Belt</Text>
        
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bluetooth color={isConnected ? "#10B981" : "#6B7280"} size={24} />
            <Text style={styles.cardTitle}>สถานะการเชื่อมต่อ</Text>
          </View>
          <Text style={[styles.statusText, { color: isConnected ? "#10B981" : "#EF4444" }]}>
            {isConnected ? "เชื่อมต่อเข็มขัดแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
          </Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: isConnected ? "#EF4444" : "#2563EB" }]}
            onPress={() => setIsConnected(!isConnected)}
          >
            <Text style={styles.buttonText}>
              {isConnected ? "ตัดการเชื่อมต่อ" : "เชื่อมต่อ Bluetooth"}
            </Text>
          </TouchableOpacity>
        </View>

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
  timerText: { fontSize: 36, fontWeight: 'bold', color: '#1D4ED8', textAlign: 'center', marginVertical: 10 },
  button: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginTop: 10 },
  alertText: { color: '#EF4444', marginLeft: 8, fontWeight: '500' }
});
