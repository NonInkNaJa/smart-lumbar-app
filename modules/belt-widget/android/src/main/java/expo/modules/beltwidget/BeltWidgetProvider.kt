package expo.modules.beltwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.util.Log

// ตัวรับคำสั่งอัปเดตวิดเจ็ตจากระบบ (ทุก ~30 นาที ตอนวางวิดเจ็ต และเมื่อผู้ใช้ปรับขนาด)
// โค้ดส่วนนี้ทำงานในโปรเซสเดียวกับแอป (และ foreground service) จึง "ห้ามโยน error ออกไปเด็ดขาด": ดักทุกอย่างแล้วแค่บันทึก log
// ถ้าวาดไม่ได้ วิดเจ็ตแค่ไม่อัปเดต แอปและ service ไม่ถูกกระทบ
class BeltWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    try {
      val views = BeltWidgetRenderer.build(context)
      for (id in appWidgetIds) {
        appWidgetManager.updateAppWidget(id, views)
      }
    } catch (e: Exception) {
      Log.w(TAG, "onUpdate failed: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    try {
      super.onReceive(context, intent)
    } catch (e: Exception) {
      Log.w(TAG, "onReceive failed: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "BeltWidget"

    // วาดวิดเจ็ตทุกตัวที่วางอยู่ใหม่จากข้อมูลล่าสุด; คืนจำนวนวิดเจ็ตที่วางอยู่ (0 = ไม่มี ไม่ต้องทำอะไร)
    fun refreshAll(context: Context): Int {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(android.content.ComponentName(context, BeltWidgetProvider::class.java))
      if (ids.isEmpty()) return 0
      val views = BeltWidgetRenderer.build(context)
      for (id in ids) {
        manager.updateAppWidget(id, views)
      }
      return ids.size
    }
  }
}
