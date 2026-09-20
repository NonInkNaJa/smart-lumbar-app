package expo.modules.beltwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class BeltWidgetException(message: String, cause: Throwable?) : CodedException(message, cause)

// สะพานจาก JavaScript: แอปส่งสถานะล่าสุดมาเป็น JSON ชิ้นเดียว (สิ่งที่ต้องแสดงตัดสินใจฝั่ง JS แล้ว) แล้วสั่งวาดวิดเจ็ตใหม่
class BeltWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BeltWidget")

    // state = JSON ตามที่ utils/widgetState.js สร้าง; คืนจำนวนวิดเจ็ตที่วางอยู่บนหน้าจอหลัก (0 = ยังไม่มีใครวาง แต่ข้อมูลถูกเก็บไว้รอแล้ว)
    AsyncFunction("update") { state: String ->
      try {
        BeltWidgetRenderer.saveState(context, state)
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
        AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, BeltWidgetProvider::class.java)).size
      } catch (e: Exception) {
        throw BeltWidgetException("${e.javaClass.simpleName}: ${e.message}", e)
      }
    }
  }
}
