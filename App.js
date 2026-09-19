import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { History, Home, Settings } from 'lucide-react-native';
import { BeltProvider, useBelt } from './context/BeltContext';
import { IconBadge, COLORS } from './components/ui';
import { useTheme } from './components/theme';
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

// ไอคอนแถบแท็บ: badge สีพื้นหลัง (แท็บที่เลือกอยู่จะเป็นสีเต็ม ที่เหลือเป็นสีเทา)
const TAB_ICONS = {
  Home: { Icon: Home, color: COLORS.blue },
  History: { Icon: History, color: COLORS.purple },
  Settings: { Icon: Settings, color: COLORS.slate },
};

function AppShell() {
  const { settingsReady } = useBelt();
  const t = useTheme();

  // รอโหลดการตั้งค่า (dark mode) ก่อนวาดหน้าจอ กันหน้าจอสว่างวาบก่อนสลับเป็นโหมดมืด
  if (!settingsReady) return null;

  // ให้พื้นหลัง/แถบแท็บของ react-navigation ตรงกับธีมของแอป
  const base = t.isDark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: t.bg, card: t.tabBar, border: t.tabBorder, text: t.text } };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: TAB_ICONS[route.name].color,
          tabBarInactiveTintColor: t.faint,
          tabBarStyle: { backgroundColor: t.tabBar, borderTopColor: t.tabBorder },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ focused }) => (
            <IconBadge Icon={TAB_ICONS[route.name].Icon} color={TAB_ICONS[route.name].color} active={focused} size={18} box={32} />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'หน้าหลัก' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'ประวัติ' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'ตั้งค่า' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BeltProvider>
        <AppShell />
      </BeltProvider>
    </SafeAreaProvider>
  );
}
