package expo.modules.beltwidget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// สร้างหน้าตาวิดเจ็ตจากข้อมูลล่าสุดที่แอปส่งมาเก็บไว้ใน SharedPreferences
// ข้อมูลอาจเก่า (แอปถูกปิด/ไม่ได้เปิดมานาน) จึงตัดสินความสดใหม่จากเวลาที่อัปเดตล่าสุดทุกครั้งที่วาด ไม่เชื่อค่าที่ค้างไว้:
//   - สถานะ "เชื่อมต่อแล้ว" ต้องอัปเดตภายใน 10 นาที (ตอนเชื่อมต่อ แอปส่งสถานะทุก ~5 นาที) เกินนั้นถือว่าไม่ทราบ = แสดงว่ายังไม่ได้เชื่อมต่อ
//   - คะแนนต้องอัปเดตภายใน 36 ชั่วโมง เกินนั้นแสดง "--" ให้ไปเปิดแอปแทนการโชว์เลขเก่า
object BeltWidgetRenderer {
  const val PREFS = "belt_widget"
  const val KEY_HAS_SCORE = "hasScore"
  const val KEY_SCORE = "score"
  const val KEY_TIER_LABEL = "tierLabel"
  const val KEY_TIER_COLOR = "tierColor"
  const val KEY_CONNECTED = "connected"
  const val KEY_UPDATED_AT = "updatedAt"

  const val STALE_CONNECTION_MS = 10L * 60L * 1000L
  const val STALE_SCORE_MS = 36L * 60L * 60L * 1000L

  private const val GRAY = 0xFF6B7280.toInt()
  private const val GREEN = 0xFF10B981.toInt()

  fun build(context: Context, now: Long = System.currentTimeMillis()): RemoteViews {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val updatedAt = prefs.getLong(KEY_UPDATED_AT, 0L)
    val age = now - updatedAt
    val known = updatedAt > 0L && age >= 0L // มีข้อมูลและนาฬิกาไม่ถอยหลัง
    val scoreFresh = known && age <= STALE_SCORE_MS
    val connectedFresh = known && age <= STALE_CONNECTION_MS && prefs.getBoolean(KEY_CONNECTED, false)
    val hasScore = prefs.getBoolean(KEY_HAS_SCORE, false)

    val views = RemoteViews(context.packageName, R.layout.belt_widget)

    if (scoreFresh && hasScore) {
      val tierColor = prefs.getInt(KEY_TIER_COLOR, GRAY)
      views.setTextViewText(R.id.belt_widget_score, prefs.getInt(KEY_SCORE, 0).toString() + "/100")
      views.setTextColor(R.id.belt_widget_score, tierColor)
      views.setTextViewText(R.id.belt_widget_tier, prefs.getString(KEY_TIER_LABEL, "") ?: "")
      views.setTextColor(R.id.belt_widget_tier, tierColor)
    } else {
      views.setTextViewText(R.id.belt_widget_score, "--")
      views.setTextColor(R.id.belt_widget_score, GRAY)
      // ยังไม่มีข้อมูล (แอปบอกว่าไม่มีคะแนน) ใช้ป้ายจากแอป ส่วนข้อมูลเก่าเกินไป/ไม่เคยเปิดแอป ให้ชวนเปิดแอป
      val label = if (scoreFresh) prefs.getString(KEY_TIER_LABEL, "") ?: "" else ""
      views.setTextViewText(R.id.belt_widget_tier, if (label.isNotEmpty()) label else context.getString(R.string.belt_widget_open_app))
      views.setTextColor(R.id.belt_widget_tier, GRAY)
    }

    views.setTextViewText(
      R.id.belt_widget_status,
      context.getString(if (connectedFresh) R.string.belt_widget_connected else R.string.belt_widget_disconnected)
    )
    views.setTextColor(R.id.belt_widget_status, if (connectedFresh) GREEN else GRAY)

    views.setTextViewText(
      R.id.belt_widget_updated,
      if (known) context.getString(R.string.belt_widget_updated_at, SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(updatedAt))) else ""
    )

    // แตะวิดเจ็ต = เปิดแอป
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      val pi = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      views.setOnClickPendingIntent(R.id.belt_widget_root, pi)
    }
    return views
  }

  // แปลงรหัสสี "#RRGGBB" จากแอป ค่าผิดใช้สีเทา (ไม่ให้พังเพราะข้อความสีผิด)
  fun parseColor(hex: String): Int {
    return try {
      Color.parseColor(hex)
    } catch (e: IllegalArgumentException) {
      GRAY
    }
  }
}
