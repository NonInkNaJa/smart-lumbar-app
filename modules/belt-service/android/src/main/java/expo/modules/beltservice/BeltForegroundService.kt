package expo.modules.beltservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

// Foreground service ของแอป: ไม่ได้ "ทำงานแทน" JavaScript แต่ทำให้ Android ถือว่าแอปกำลังคุยกับอุปกรณ์ Bluetooth อยู่
// (ชนิด connectedDevice + การแจ้งเตือนถาวร) โปรเซสจึงไม่ถูกแช่แข็ง/ปิดตอนปิดจอ การเชื่อมต่อ BLE, ตัวจับเวลา และการเตือนใน JS ทำงานต่อได้
//
// หลักความปลอดภัย: ทุกอย่างที่อาจพังในนี้ (สิทธิ์ไม่พอ, ระบบไม่อนุญาตให้เริ่ม, ไอคอนไม่ถูกต้อง) ถูกดักไว้ให้ service หยุดตัวเองเงียบๆ
// เพื่อไม่ให้แอปทั้งตัวล้ม — ถ้า service ไม่ขึ้น แอปยังทำงานเหมือนเดิมทุกอย่าง (แค่ไม่ได้รับการคุ้มครองตอนอยู่เบื้องหลัง)
class BeltForegroundService : Service() {
  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"

    private const val TAG = "BeltService"
    private const val CHANNEL_ID = "belt-service"
    private const val NOTIFICATION_ID = 7301

    // true ตั้งแต่ startForeground สำเร็จ จนถึง service ถูกหยุด
    @Volatile
    var isRunning: Boolean = false
      private set
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "หลังเทพ กำลังทำงานอยู่"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: "กำลังรับข้อมูลจากเข็มขัด"
    try {
      createChannelIfNeeded()
      val notification = buildNotification(title, text)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      isRunning = true
    } catch (e: Exception) {
      // เช่น SecurityException (ไม่มีสิทธิ์ Bluetooth), ForegroundServiceStartNotAllowedException (ระบบไม่อนุญาตให้เริ่มจากเบื้องหลัง)
      Log.w(TAG, "startForeground failed: ${e.javaClass.simpleName}: ${e.message}")
      isRunning = false
      stopSelf()
    }
    // ถ้าโปรเซสถูกระบบปิด ไม่ต้องให้ service ฟื้นเอง (การเชื่อมต่อ BLE หายไปพร้อมโปรเซสอยู่แล้ว ต้องให้ผู้ใช้เปิดแอปเชื่อมต่อใหม่)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  private fun createChannelIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "หลังเทพ ทำงานเบื้องหลัง", NotificationManager.IMPORTANCE_LOW)
    channel.description = "แสดงตลอดเวลาที่แอปกำลังรับข้อมูลจากเข็มขัดอยู่เบื้องหลัง"
    channel.setShowBadge(false)
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(title: String, text: String): Notification {
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(smallIconRes())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

    // แตะการแจ้งเตือน = เปิดแอปกลับมา
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, piFlags))
    }
    return builder.build()
  }

  // ไอคอนแจ้งเตือนเล็ก: ใช้ notification_icon ที่ปลั๊กอิน expo-notifications สร้างไว้ ถ้าไม่มีใช้ไอคอนแอป และสุดท้ายใช้ไอคอนของระบบ
  private fun smallIconRes(): Int {
    val custom = resources.getIdentifier("notification_icon", "drawable", packageName)
    if (custom != 0) return custom
    val appIcon = applicationInfo.icon
    if (appIcon != 0) return appIcon
    return android.R.drawable.ic_dialog_info
  }
}
