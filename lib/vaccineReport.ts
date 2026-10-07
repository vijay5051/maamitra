import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Kid } from '../store/useProfileStore';
import type { VaccineWithDate } from '../hooks/useVaccineSchedule';

// Generate a printable vaccination record for a kid. On native the PDF
// is written to a file and handed to the native share sheet; on web the
// browser's print dialog opens so the user can save as PDF or print.
//
// The HTML template is intentionally plain inline-styled — PDF renderers
// in both Expo (iOS/Android via UIKit/Android Print framework) and
// browsers handle a conservative subset of CSS. Avoid flexbox tricks and
// web-only CSS variables.

export interface VaccineReportInput {
  kid: Kid;
  motherName: string | undefined;
  vaccines: VaccineWithDate[];
  scheduleLabel: string;
}

function fmtDate(iso: string | Date | undefined, fallback = '—'): string {
  if (!iso) return fallback;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ageAtReport(dobIso: string | undefined): string {
  if (!dobIso) return '—';
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return '—';
  const now = new Date();
  const months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (months < 1) return 'under 1 month';
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} year${years === 1 ? '' : 's'}, ${rem} mo` : `${years} year${years === 1 ? '' : 's'}`;
}

function escapeHtml(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVaccineReportHtml(input: VaccineReportInput): string {
  const { kid, motherName, vaccines, scheduleLabel } = input;
  const completed = vaccines.filter((v) => v.status === 'done');
  const overdue = vaccines.filter((v) => v.status === 'overdue');
  const upcoming = vaccines.filter((v) => v.status === 'due-soon' || v.status === 'upcoming');

  const genDate = fmtDate(new Date());
  const dobLine = kid.dob ? fmtDate(kid.dob) : (kid.isExpecting ? 'Expecting' : '—');
  const ageLine = ageAtReport(kid.dob);
  const kidName = escapeHtml(kid.name || 'Child');
  const momLine = motherName ? `Parent: ${escapeHtml(motherName)}` : '';

  const row = (v: VaccineWithDate) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;">
        <div style="font-weight:600;color:#1C1033;">${escapeHtml(v.name)}</div>
        <div style="color:#6B7280;font-size:11px;margin-top:2px;">${escapeHtml(v.ageLabel)} · ${escapeHtml(v.category)}</div>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;color:#1C1033;">
        ${v.doneDate ? fmtDate(v.doneDate) : fmtDate(v.dueDate ?? undefined)}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;color:#6B7280;font-size:12px;">—</td>
    </tr>
  `;

  const section = (title: string, items: VaccineWithDate[], tint: string, head: string) => `
    <h2 style="font-size:13px;color:${tint};text-transform:uppercase;letter-spacing:0.8px;margin:20px 0 8px 0;">
      ${title} · ${items.length}
    </h2>
    ${items.length === 0 ? `<p style="color:#9CA3AF;font-size:12px;">${head}</p>` : `
      <table style="width:100%;border-collapse:collapse;font-size:12px;background:#FFF;border:1px solid #EEE;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#FAFAFA;color:#6B7280;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">
            <th style="padding:8px 10px;text-align:left;">Vaccine</th>
            <th style="padding:8px 10px;text-align:left;">${head}</th>
            <th style="padding:8px 10px;text-align:left;">Facility / Notes</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(row).join('')}
        </tbody>
      </table>
    `}
  `;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Vaccination record · ${kidName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:0; padding:28px; background:#FFF; color:#1C1033;">
  <div style="border-bottom:3px solid #6D1A7A;padding-bottom:12px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;">MaaMitra</div>
        <div style="font-size:22px;font-weight:700;color:#1C1033;margin-top:2px;">Vaccination Record</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#6B7280;">
        <div><strong>Generated:</strong> ${genDate}</div>
        <div><strong>Schedule:</strong> ${escapeHtml(scheduleLabel)}</div>
        <div><strong>Total doses given:</strong> ${completed.length}</div>
      </div>
    </div>
  </div>

  <div style="background:#F7F3FA;border:1px solid #EDE9F6;border-radius:8px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Child information</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px;">${kidName}</div>
    <div style="font-size:12px;color:#4B5563;margin-top:2px;">
      Date of birth: <strong>${dobLine}</strong>${kid.dob ? ` · Age today: <strong>${ageLine}</strong>` : ''}
      ${momLine ? ` · ${momLine}` : ''}
    </div>
  </div>

  ${section('Completed', completed, '#059669', 'Date given')}
  ${section('Overdue', overdue, '#B91C1C', 'Was due')}
  ${section('Upcoming', upcoming, '#6D1A7A', 'Due on')}

  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #EEE;font-size:10px;color:#9CA3AF;line-height:1.5;">
    Generated by MaaMitra. For verification by a paediatrician or school, please cross-check the dates
    in this record against the physical immunisation card. MaaMitra is a parenting companion, not a
    medical service — this record is a convenience export, not an official medical document.
  </div>
</body>
</html>`;
}

export async function downloadVaccineReport(input: VaccineReportInput): Promise<void> {
  const html = buildVaccineReportHtml(input);
  const fileName = `vaccination-record-${(input.kid.name || 'child').toLowerCase().replace(/\s+/g, '-')}.pdf`;

  if (Platform.OS === 'web') {
    // Browser handles save-as-PDF via the print dialog.
    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error('vaccineReport.web print failed:', err);
      Alert.alert('Could not open print dialog', 'Try again, or use a different browser if the problem continues.');
    }
    return;
  }

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Saved', `Report saved to ${uri}`);
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: fileName,
    });
  } catch (err) {
    console.error('vaccineReport.native generate failed:', err);
    Alert.alert('Could not create the report', 'Please try again in a moment.');
  }
}
