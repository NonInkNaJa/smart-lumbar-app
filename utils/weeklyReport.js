import { getReadinessMessage } from './postureScore';
import { summarizeCauses } from './postureStats';

// สร้างรายงานประจำสัปดาห์เป็น HTML สำหรับแปลงเป็น PDF (expo-print)
// ฟังก์ชันล้วน ไม่แตะ React Native จึงทดสอบได้ง่าย; ใช้ CSS ล้วน (ไม่มี JavaScript ในหน้า)

export const REPORT_PAGE = { width: 595, height: 842 }; // A4 ที่ 72 PPI

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "2026-09-20" -> "20 ก.ย. 2569" (ปี พ.ศ.); รูปแบบไม่ถูกต้อง -> ''
export function formatThaiDate(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return '';
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return '';
  return `${parseInt(m[3], 10)} ${THAI_MONTHS[month - 1]} ${parseInt(m[1], 10) + 543}`;
}

// ชื่อไฟล์/วันที่ที่สร้างรายงาน: ใช้เวลาเครื่อง
function todayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// สรุปจากข้อมูลรายวัน 7 วัน (weekData จาก context: เก่า -> ใหม่)
export function summarizeWeek(weekData) {
  const days = Array.isArray(weekData) ? weekData : [];
  const good = days.reduce((a, d) => a + (d.goodSeconds || 0), 0);
  const bad = days.reduce((a, d) => a + (d.badSeconds || 0), 0);
  const total = good + bad;
  return {
    trackedMinutes: Math.round(total / 60),
    badPercent: total > 0 ? Math.round((bad / total) * 100) : null,
    daysWithData: days.filter((d) => d.hasData).length,
  };
}

// score: 0-100 หรือ null (ยังไม่มีข้อมูล); tier: low/moderate/high/no-data
// weekData: [{ label, dateKey, hasData, score, tier, goodSeconds, badSeconds }]
// weekChange (ไม่บังคับ): { percent, direction: up|down|same } จากการเทียบสัปดาห์ก่อน (ถ้ามี จะแสดงในรายงานด้วย)
export function buildWeeklyReportHtml({ score, tier, lowData, weekData, streak, weekChange, stretchCount, now = new Date() }) {
  const readiness = getReadinessMessage(tier);
  const days = Array.isArray(weekData) ? weekData : [];
  const summary = summarizeWeek(days);
  const causes = summarizeCauses(days);
  const first = days[0] && days[0].dateKey;
  const last = days[days.length - 1] && days[days.length - 1].dateKey;
  const range = first && last ? `${formatThaiDate(first)} - ${formatThaiDate(last)}` : '';
  const hasScore = typeof score === 'number';

  const bars = days
    .map((d) => {
      const color = d.hasData ? getReadinessMessage(d.tier).color : '#D1D5DB';
      const height = Math.max(Math.round(((d.hasData ? d.score || 0 : 0) / 100) * 110), 6);
      return `<td class="col"><div class="val">${d.hasData ? escapeHtml(d.score) : '-'}</div><div class="bar" style="height:${height}px;background:${color}"></div><div class="lbl">${escapeHtml(d.label)}</div></td>`;
    })
    .join('');

  const streakText =
    streak > 0 ? `ท่านั่งดีต่อเนื่อง ${escapeHtml(streak)} วัน` : 'ยังไม่มี streak (วันดี = นั่งท่าไม่ดีต่ำกว่า 30% ของเวลา)';

  const changeHtml =
    weekChange && typeof weekChange.percent === 'number'
      ? `<div class="change">เทียบสัปดาห์ก่อน: ${weekChange.direction === 'same' ? 'เท่าเดิม' : (weekChange.direction === 'up' ? '▲ ' : '▼ ') + escapeHtml(Math.abs(weekChange.percent)) + '%'}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8" />
<style>
  @page { margin: 28px; }
  body { font-family: sans-serif; color: #111827; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #6B7280; margin-bottom: 18px; }
  .box { border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
  .score { font-size: 46px; font-weight: bold; text-align: center; color: ${readiness.color}; margin: 4px 0; }
  .tier { font-size: 16px; font-weight: bold; text-align: center; color: ${readiness.color}; }
  .advice { font-size: 12px; color: #4B5563; text-align: center; margin-top: 6px; }
  .note { font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 6px; }
  .change { font-size: 13px; text-align: center; margin-top: 8px; font-weight: bold; }
  .h { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
  table.chart { width: 100%; border-collapse: collapse; }
  td.col { text-align: center; vertical-align: bottom; height: 150px; }
  .bar { width: 22px; margin: 0 auto; border-radius: 4px; }
  .val { font-size: 10px; color: #6B7280; margin-bottom: 2px; }
  .lbl { font-size: 11px; color: #4B5563; margin-top: 4px; }
  .cap { font-size: 10px; color: #9CA3AF; text-align: center; margin-top: 6px; }
  table.stats { width: 100%; border-collapse: collapse; }
  table.stats td { font-size: 13px; padding: 4px 0; }
  table.stats td.r { text-align: right; font-weight: bold; }
  .foot { font-size: 10px; color: #9CA3AF; text-align: center; margin-top: 18px; }
</style></head><body>
  <h1>หลังเทพ · รายงานประจำสัปดาห์</h1>
  <div class="sub">Smart Lumbar Support${range ? ' · ' + escapeHtml(range) : ''}</div>

  <div class="box">
    <div class="h">ความพร้อมออกกำลังกาย</div>
    <div class="score">${hasScore ? escapeHtml(score) + '/100' : '--'}</div>
    <div class="tier">${escapeHtml(readiness.label)}</div>
    <div class="advice">${escapeHtml(readiness.advice)}</div>
    ${hasScore && lowData ? '<div class="note">ข้อมูลยังน้อย คะแนนอาจยังไม่แม่นยำ</div>' : ''}
    ${changeHtml}
  </div>

  <div class="box">
    <div class="h">คะแนนรายวัน (7 วันล่าสุด)</div>
    <table class="chart"><tr>${bars}</tr></table>
    <div class="cap">แท่งสูง = พร้อมมาก · สีเทา = ยังไม่มีข้อมูล</div>
  </div>

  <div class="box">
    <div class="h">สรุป</div>
    <table class="stats">
      <tr><td>เวลาตรวจวัดรวม</td><td class="r">${escapeHtml(summary.trackedMinutes)} นาที</td></tr>
      <tr><td>สัดส่วนท่านั่งไม่ดี</td><td class="r">${summary.badPercent === null ? '-' : escapeHtml(summary.badPercent) + '%'}</td></tr>
      <tr><td>วันที่มีข้อมูล</td><td class="r">${escapeHtml(summary.daysWithData)} จาก ${escapeHtml(days.length)} วัน</td></tr>
      ${causes.hasData ? `<tr><td>ท่านั่งไม่ดี: หลังค่อม</td><td class="r">${escapeHtml(causes.hunchedPercent)}%</td></tr><tr><td>ท่านั่งไม่ดี: เอนหลังไม่ดี</td><td class="r">${escapeHtml(causes.slumpedPercent)}%</td></tr>` : ''}
      ${Number.isInteger(stretchCount) ? `<tr><td>ลุกยืดเส้นตอนโดนเตือนนั่งนาน</td><td class="r">${escapeHtml(stretchCount)} ครั้ง</td></tr>` : ''}
      <tr><td>Streak</td><td class="r">${streakText}</td></tr>
    </table>
  </div>

  <div class="foot">สร้างเมื่อ ${escapeHtml(formatThaiDate(todayKeyOf(now)))} · แอปหลังเทพ</div>
</body></html>`;
}
