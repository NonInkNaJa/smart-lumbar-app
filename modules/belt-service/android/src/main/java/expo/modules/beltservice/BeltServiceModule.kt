package expo.modules.beltservice

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class BeltServiceStartException(message: String, cause: Throwable?) : CodedException(message, cause)

// สะพานจาก JavaScript ไปหา BeltForegroundService (ทุกฟังก์ชันโยน error ให้ฝั่ง JS จัดการได้ ไม่ทำให้แอปล้ม)
class BeltServiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BeltService")

    // เริ่ม service (ต้องเรียกตอนแอปอยู่หน้าจอ: Android 12+ ไม่ให้เริ่ม foreground service จากเบื้องหลัง)
    AsyncFunction("start") { title: String, text: String ->
      try {
        val intent = Intent(context, BeltForegroundService::class.java)
          .putExtra(BeltForegroundService.EXTRA_TITLE, title)
          .putExtra(BeltForegroundService.EXTRA_TEXT, text)
        ContextCompat.startForegroundService(context, intent)
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw BeltServiceStartException("${e.javaClass.simpleName}: ${e.message}", e)
      }
      true
    }

    AsyncFunction("stop") {
      context.stopService(Intent(context, BeltForegroundService::class.java))
      true
    }

    // true = startForeground สำเร็จแล้วและ service ยังอยู่ (ใช้ตรวจว่า service ขึ้นจริง ไม่ใช่แค่สั่งเริ่ม)
    Function("isRunning") {
      BeltForegroundService.isRunning
    }

    // เปิดหน้าตั้งค่าการประหยัดแบตเตอรี่ให้ผู้ใช้เลือก "ไม่จำกัด" (หลายยี่ห้อปิดแอปเบื้องหลังแรง)
    // ไม่ต้องขอสิทธิ์พิเศษ; ถ้าเครื่องไม่มีหน้านี้ ถอยไปเปิดหน้าข้อมูลแอปแทน
    AsyncFunction("openBatterySettings") {
      try {
        context.startActivity(
          Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        "battery-optimization"
      } catch (e: Exception) {
        try {
          context.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
          "app-details"
        } catch (e2: Exception) {
          throw BeltServiceStartException("${e2.javaClass.simpleName}: ${e2.message}", e2)
        }
      }
    }
  }
}
