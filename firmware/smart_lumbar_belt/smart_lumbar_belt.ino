// Smart Lumbar Belt firmware — ESP32 DevKit + MPU6050
// Wiring: VCC->3V3, GND->GND, SDA->GPIO21, SCL->GPIO22
//
// The BLE name and UUIDs below MUST match DEVICE_NAME / SERVICE_UUID /
// CHARACTERISTIC_UUID in App.js.
//
// Every second the tilt (pitch, roll in degrees) is sent as a text
// notification like "12.3,-4.5" and printed to Serial (115200 baud).

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

#define DEVICE_NAME          "SmartLumbarBelt"
#define SERVICE_UUID         "d5e630c8-e528-468a-a3ec-9386004b4327"
#define CHARACTERISTIC_UUID  "002cf995-2911-4bc5-9143-3991ef0d6cf6"

#define SDA_PIN 21
#define SCL_PIN 22
#define MPU_ADDR 0x68
#define SEND_INTERVAL_MS 1000

BLEServer *pServer = nullptr;
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;
bool mpuReady = false;
unsigned long lastSend = 0;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    deviceConnected = true;
    Serial.println("BLE: phone connected");
  }
  void onDisconnect(BLEServer *server) override {
    deviceConnected = false;
    Serial.println("BLE: phone disconnected, advertising again");
    BLEDevice::startAdvertising();
  }
};

bool initMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // wake up
  return Wire.endTransmission() == 0;
}

// Returns false if the sensor does not answer (wiring problem).
bool readTilt(float &pitch, float &roll) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)6) != 6) return false;

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();

  float ax = rawX / 16384.0;  // +-2g range
  float ay = rawY / 16384.0;
  float az = rawZ / 16384.0;

  pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
  roll = atan2(ay, az) * 180.0 / PI;
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Smart Lumbar Belt starting...");

  Wire.begin(SDA_PIN, SCL_PIN);
  mpuReady = initMPU();
  Serial.println(mpuReady ? "MPU6050: OK" : "MPU6050: NOT FOUND (check SDA/SCL/VCC/GND wiring)");

  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *service = pServer->createService(SERVICE_UUID);
  pCharacteristic = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->setValue("0.0,0.0");
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);  // 128-bit UUID + long name don't fit in one packet
  BLEDevice::startAdvertising();
  Serial.println("BLE: advertising as " DEVICE_NAME);
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  if (!mpuReady) mpuReady = initMPU();  // keep retrying so a late-plugged sensor works

  float pitch, roll;
  if (!mpuReady || !readTilt(pitch, roll)) {
    mpuReady = false;
    Serial.println("MPU6050 read failed - check wiring");
    return;
  }

  char payload[24];
  snprintf(payload, sizeof(payload), "%.1f,%.1f", pitch, roll);
  Serial.printf("pitch=%.1f roll=%.1f  (BLE %s)\n", pitch, roll, deviceConnected ? "connected" : "waiting");

  pCharacteristic->setValue(payload);
  if (deviceConnected) pCharacteristic->notify();
}
