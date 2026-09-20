package expo.modules.beltwidget

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class BeltWidgetException(message: String, cause: Throwable?) : CodedException(message, cause)

// สะพานจาก JavaScript: แอปส่งคะแนน/สถานะเชื่อมต่อล่าสุดมาเก็บ แล้วสั่งวาดวิดเจ็ตใหม่
// (ข้อมูลเป็นของแอป วิดเจ็ตแค่แสดง ไม่คำนวณเอง)
class BeltWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BeltWidget")

    // hasScore=false = ยังไม่มีคะแนน (score ไม่ถูกใช้); tierColor เป็น "#RRGGBB"
    // คืนจำนวนวิดเจ็ตที่วางอยู่บนหน้าจอหลัก (0 = ยังไม่มีใครวาง แต่ข้อมูลถูกเก็บไว้รอแล้ว)
    AsyncFunction("update") { hasScore: Boolean, score: Int, tierLabel: String, tierColor: String, connected: Boolean ->
      try {
        val prefs = context.getSharedPreferences(BeltWidgetRenderer.PREFS, Context.MODE_PRIVATE)
        prefs.edit()
          .putBoolean(BeltWidgetRenderer.KEY_HAS_SCORE, hasScore)
          .putInt(BeltWidgetRenderer.KEY_SCORE, score)
          .putString(BeltWidgetRenderer.KEY_TIER_LABEL, tierLabel)
          .putInt(BeltWidgetRenderer.KEY_TIER_COLOR, BeltWidgetRenderer.parseColor(tierColor))
          .putBoolean(BeltWidgetRenderer.KEY_CONNECTED, connected)
          .putLong(BeltWidgetRenderer.KEY_UPDATED_AT, System.currentTimeMillis())
          .apply()
        BeltWidgetProvider.refreshAll(context)
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw BeltWidgetException("${e.javaClass.simpleName}: ${e.message}", e)
      }
    }

    // จำนวนวิดเจ็ตที่วางอยู่ตอนนี้
    AsyncFunction("getWidgetCount") {
      try {
        val manager = android.appwidget.AppWidgetManager.getInstance(context)
        manager.getAppWidgetIds(android.content.ComponentName(context, BeltWidgetProvider::class.java)).size
      } catch (e: Exception) {
        throw BeltWidgetException("${e.javaClass.simpleName}: ${e.message}", e)
      }
    }
  }
}
