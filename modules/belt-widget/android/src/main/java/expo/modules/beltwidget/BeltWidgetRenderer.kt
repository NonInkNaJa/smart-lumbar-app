package expo.modules.beltwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// วาดวิดเจ็ต 3 ส่วนจากข้อมูลล่าสุดที่แอปส่งมา (JSON เก็บใน SharedPreferences)
// การตัดสินใจว่าจะ "แสดงอะไร" ทำฝั่ง JS แล้วทั้งหมด (utils/widgetState.js) ที่นี่แค่วาด + เทียบเวลาหมดอายุที่แอปกำหนดมา + ปรับตามขนาดวิดเจ็ต:
//   ส่วนหลัก 1: สถานะท่านั่ง (statusLabel/statusColor) — ถ้า live=true และเลย liveUntil แล้ว = "ไม่มีข้อมูล" (แอปไม่ได้ส่งมาเกิน 10 นาที)
//   ส่วนหลัก 2: "นั่งมาแล้ว X นาที" (sittingMinutes >= 0 เท่านั้น) สีเตือนเมื่อ sittingWarn
//   ส่วนเสริม  : แท่งสีคะแนนความพร้อม (score/tierColor) ถึง scoreUntil; วิดเจ็ตเล็กจะตัดส่วนนี้ก่อนเสมอ
object BeltWidgetRenderer {
  const val PREFS = "belt_widget"
  const val KEY_STATE = "state"

  private const val GRAY = 0xFF6B7280.toInt()
  private const val TEXT_DARK = 0xFF111827.toInt()
  private const val WARN = 0xFFF59E0B.toInt()
  private const val TRACK = 0xFFE5E7EB.toInt()

  // เกณฑ์ความสูงขั้นต่ำของวิดเจ็ต (dp): สูงพอ = ครบทุกส่วน; ปานกลาง = ตัดแท่งคะแนนและเวลาอัปเดต; เตี้ย = เหลือแค่สถานะ + เวลานั่ง
  private const val HEIGHT_FULL_DP = 100
  private const val HEIGHT_TITLE_DP = 70
  private const val DEFAULT_HEIGHT_DP = 110

  // เก็บข้อมูลที่แอปส่งมา (ตรวจว่าเป็น JSON จริงก่อน ถ้าไม่ใช่โยน JSONException ให้ผู้เรียกจัดการ)
  fun saveState(context: Context, json: String) {
    JSONObject(json)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STATE, json).apply()
  }

  // เวลา (ms) ที่สถานะสดล่าสุดจะหมดอายุ; 0 = ไม่มีข้อมูล/สถานะไม่ต้องสด (เช่น ยังไม่ได้เชื่อมต่อ) จึงไม่ต้องตั้งปลุก
  fun liveUntilOf(context: Context): Long {
    return try {
      val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null)
      if (json == null) {
        0L
      } else {
        val state = JSONObject(json)
        if (state.optBoolean("live", false)) state.optLong("liveUntil", 0L) else 0L
      }
    } catch (e: Exception) {
      0L
    }
  }

  // ความสูงขั้นต่ำของวิดเจ็ตตัวนั้น (dp) จากตัวเลือกของระบบ; ไม่ทราบใช้ค่าปกติ
  fun heightDpOf(options: Bundle?): Int {
    if (options == null) return DEFAULT_HEIGHT_DP
    val h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
    return if (h > 0) h else DEFAULT_HEIGHT_DP
  }

  fun build(context: Context, heightDp: Int, now: Long = System.currentTimeMillis()): RemoteViews {
    val state: JSONObject? = try {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null)?.let { JSONObject(it) }
    } catch (e: Exception) {
      null // ข้อมูลเสีย = ถือว่าไม่มีข้อมูล
    }
    val updatedAt = if (state != null) state.optLong("updatedAt", 0L) else 0L
    val known = state != null && updatedAt > 0L
    val live = state != null && known && state.optBoolean("live", false)
    val liveUntil = if (state != null) state.optLong("liveUntil", 0L) else 0L
    val stale = live && now > liveUntil // สถานะที่ต้องสด แต่แอปไม่ได้ส่งมานานเกินกำหนด
    val showStatus = state != null && known && !stale

    val views = RemoteViews(context.packageName, R.layout.belt_widget)

    // ส่วนหลัก 1: สถานะท่านั่ง
    val label = if (state != null && showStatus) state.optString("statusLabel", "") else ""
    if (state != null && showStatus && label.isNotEmpty()) {
      views.setTextViewText(R.id.belt_widget_status, label)
      views.setTextColor(R.id.belt_widget_status, parseColor(state.optString("statusColor", "")))
    } else {
      views.setTextViewText(R.id.belt_widget_status, context.getString(R.string.belt_widget_no_data))
      views.setTextColor(R.id.belt_widget_status, GRAY)
    }

    // ส่วนหลัก 2: เวลานั่งต่อเนื่อง (แสดงเฉพาะสถานะที่สดและแอปส่งเวลามา)
    val minutes = if (state != null) state.optInt("sittingMinutes", -1) else -1
    if (state != null && showStatus && live && minutes >= 0) {
      views.setViewVisibility(R.id.belt_widget_sitting, View.VISIBLE)
      views.setTextViewText(R.id.belt_widget_sitting, context.getString(R.string.belt_widget_sitting, minutes))
      views.setTextColor(R.id.belt_widget_sitting, if (state.optBoolean("sittingWarn", false)) WARN else TEXT_DARK)
    } else {
      views.setViewVisibility(R.id.belt_widget_sitting, View.GONE)
    }

    // ส่วนเสริม: แท่งสีคะแนนความพร้อม (ตัดทิ้งก่อนเมื่อวิดเจ็ตเล็ก)
    val scoreUntil = if (state != null) state.optLong("scoreUntil", 0L) else 0L
    val showBar = state != null && known && state.optBoolean("hasScore", false) && now <= scoreUntil && heightDp >= HEIGHT_FULL_DP
    if (state != null && showBar) {
      val score = state.optInt("score", 0).coerceIn(0, 100)
      views.setViewVisibility(R.id.belt_widget_bar, View.VISIBLE)
      views.setImageViewBitmap(R.id.belt_widget_bar, barBitmap(score / 100f, parseColor(state.optString("tierColor", ""))))
    } else {
      views.setViewVisibility(R.id.belt_widget_bar, View.GONE)
    }

    // ชื่อแอปและเวลาอัปเดต: ตามความสูง
    views.setViewVisibility(R.id.belt_widget_title, if (heightDp >= HEIGHT_TITLE_DP) View.VISIBLE else View.GONE)
    if (known && heightDp >= HEIGHT_FULL_DP) {
      views.setViewVisibility(R.id.belt_widget_updated, View.VISIBLE)
      views.setTextViewText(
        R.id.belt_widget_updated,
        context.getString(R.string.belt_widget_updated_at, SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(updatedAt)))
      )
    } else {
      views.setViewVisibility(R.id.belt_widget_updated, View.GONE)
    }

    // วิดเจ็ตเตี้ย: ลดขอบให้พอดี
    val pad = ((if (heightDp >= HEIGHT_TITLE_DP) 12 else 6) * context.resources.displayMetrics.density).toInt()
    views.setViewPadding(R.id.belt_widget_root, pad, pad, pad, pad)

    // แตะวิดเจ็ต = เปิดแอป
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      val pi = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      views.setOnClickPendingIntent(R.id.belt_widget_root, pi)
    }
    return views
  }

  // แท่งบางๆ: รางสีเทาอ่อน + ส่วนที่เติมสีตามระดับ ยาวตามคะแนน (ขั้นต่ำเท่าความสูงเพื่อให้เห็นเป็นจุดสี แม้คะแนนต่ำมาก)
  private fun barBitmap(fraction: Float, color: Int): Bitmap {
    val w = 480
    val h = 16
    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = TRACK
    canvas.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), h / 2f, h / 2f, paint)
    paint.color = color
    val fillWidth = Math.max(h.toFloat(), w * fraction)
    canvas.drawRoundRect(RectF(0f, 0f, fillWidth, h.toFloat()), h / 2f, h / 2f, paint)
    return bitmap
  }

  // รหัสสี "#RRGGBB" จากแอป; ค่าผิดใช้สีเทา (ไม่ให้พังเพราะข้อความสีผิด)
  private fun parseColor(hex: String): Int {
    return try {
      Color.parseColor(hex)
    } catch (e: IllegalArgumentException) {
      GRAY
    }
  }
}
