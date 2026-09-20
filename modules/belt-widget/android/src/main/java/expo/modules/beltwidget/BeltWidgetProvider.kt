package expo.modules.beltwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log

// ตัวรับคำสั่งอัปเดตวิดเจ็ตจากระบบ (ทุก ~30 นาที ตอนวางวิดเจ็ต และเมื่อผู้ใช้ปรับขนาด)
// โค้ดส่วนนี้ทำงานในโปรเซสเดียวกับแอป (และ foreground service) จึง "ห้ามโยน error ออกไปเด็ดขาด": ดักทุกอย่างแล้วแค่บันทึก log
// ถ้าวาดไม่ได้ วิดเจ็ตแค่ไม่อัปเดต แอปและ service ไม่ถูกกระทบ
class BeltWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    try {
      for (id in appWidgetIds) {
        renderOne(context, appWidgetManager, id)
      }
    } catch (e: Exception) {
      Log.w(TAG, "onUpdate failed: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  // ผู้ใช้ปรับขนาดวิดเจ็ต: วาดใหม่ตามขนาด (วิดเจ็ตเล็กตัดแท่งคะแนนก่อน)
  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
    try {
      appWidgetManager.updateAppWidget(appWidgetId, BeltWidgetRenderer.build(context, BeltWidgetRenderer.heightDpOf(newOptions)))
    } catch (e: Exception) {
      Log.w(TAG, "onAppWidgetOptionsChanged failed: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    try {
      if (intent.action == ACTION_STALE_REFRESH) {
        // นาฬิกาปลุกที่ตั้งไว้ตอนข้อมูลสด: แอปหยุดส่งข้อมูลมาเกินกำหนด วาดใหม่เพื่อเปลี่ยนเป็น "ไม่มีข้อมูล" (ไม่ต้องรอระบบอัปเดตทุก ~30 นาที)
        refreshAll(context)
      } else {
        super.onReceive(context, intent)
      }
    } catch (e: Exception) {
      Log.w(TAG, "onReceive failed: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "BeltWidget"
    private const val ACTION_STALE_REFRESH = "expo.modules.beltwidget.STALE_REFRESH"

    private fun renderOne(context: Context, manager: AppWidgetManager, id: Int) {
      val options = manager.getAppWidgetOptions(id)
      manager.updateAppWidget(id, BeltWidgetRenderer.build(context, BeltWidgetRenderer.heightDpOf(options)))
    }

    // วาดวิดเจ็ตทุกตัวที่วางอยู่ใหม่จากข้อมูลล่าสุด; คืนจำนวนวิดเจ็ตที่วางอยู่ (0 = ไม่มี ไม่ต้องทำอะไร)
    fun refreshAll(context: Context): Int {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, BeltWidgetProvider::class.java))
      for (id in ids) {
        renderOne(context, manager, id)
      }
      if (ids.isNotEmpty()) scheduleStaleRefresh(context)
      return ids.size
    }

    // ตั้งปลุกให้วาดใหม่หลังสถานะสดหมดอายุ (liveUntil) เผื่อแอปหยุดส่งข้อมูล (ปิดแอป/บลูทูธหลุด/ระบบแช่แข็ง) จะได้ไม่ค้างโชว์ "ท่านั่งดี" เก่า
    // ถ้าแอปส่งข้อมูลใหม่มาก่อน ตัวปลุกเดิมถูกแทนที่ด้วยตัวใหม่ (PendingIntent เดียวกัน); ถ้าหมดอายุไปแล้วหรือไม่มีสถานะที่ต้องสด = ยกเลิก (ไม่วนซ้ำ)
    // ใช้ปลุกแบบไม่ระบุเวลาตรงเป๊ะ (ไม่ต้องขอสิทธิ์พิเศษ) อาจช้ากว่ากำหนดเล็กน้อย
    private fun scheduleStaleRefresh(context: Context) {
      try {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, BeltWidgetProvider::class.java).setAction(ACTION_STALE_REFRESH)
        val pending = PendingIntent.getBroadcast(context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val liveUntil = BeltWidgetRenderer.liveUntilOf(context)
        val triggerAt = liveUntil + 1000L
        if (liveUntil > 0L && triggerAt > System.currentTimeMillis()) {
          alarm.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        } else {
          alarm.cancel(pending)
        }
      } catch (e: Exception) {
        Log.w(TAG, "scheduleStaleRefresh failed: ${e.javaClass.simpleName}: ${e.message}")
      }
    }
  }
}
