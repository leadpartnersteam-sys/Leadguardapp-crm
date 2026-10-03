import { Lead } from '../types/leadguard';

/**
 * Escapes a cell value according to RFC 4180 CSV specifications:
 * - Null / undefined become empty quotes `""`
 * - Internal quotes are escaped by doubling them `""`
 * - Strings containing commas, quotes, or newlines are enclosed in double quotes
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats internal lead notes into a readable multi-line string for CSV cells.
 */
function formatNotesForCsv(lead: Lead): string {
  if (!lead.notes || lead.notes.length === 0) {
    return '';
  }
  return lead.notes
    .map((n) => `[${n.created_at}] ${n.author_name}: ${n.content}`)
    .join('\n');
}

/**
 * Exports an array of leads to a well-formed CSV file in the browser.
 * Respects UTF-8 encoding (includes BOM for Microsoft Excel compatibility).
 */
export function exportLeadsToCsv(leads: Lead[], customFilename?: string): boolean {
  if (!leads || leads.length === 0) {
    return false;
  }

  const headers = [
    'Name',
    'Phone',
    'Email',
    'Service',
    'Location',
    'Budget',
    'Timeline',
    'Decision Maker',
    'Specific Need',
    'Engaged',
    'Lead Source',
    'Notes',
    'Score',
    'Status',
    'LeadGuard Assessment',
    'Date Added',
    'Last Updated',
  ];

  const rows = leads.map((lead) => {
    return [
      escapeCsvField(lead.name),
      escapeCsvField(lead.phone),
      escapeCsvField(lead.email),
      escapeCsvField(lead.service),
      escapeCsvField(lead.location),
      escapeCsvField(lead.budget_display || (lead.budget !== null ? lead.budget : 'Not provided')),
      escapeCsvField(lead.timeline || 'Not specified'),
      escapeCsvField(lead.decision_maker ? 'Yes' : 'No'),
      escapeCsvField(lead.specific_need || 'Not specified'),
      escapeCsvField(lead.engaged ? 'Yes' : 'No'),
      escapeCsvField(lead.source || 'Other'),
      escapeCsvField(formatNotesForCsv(lead)),
      escapeCsvField(lead.score),
      escapeCsvField(lead.status),
      escapeCsvField(lead.assessment),
      escapeCsvField(lead.date_added),
      escapeCsvField(lead.updated_at || lead.date_added),
    ].join(',');
  });

  // UTF-8 Byte Order Mark (\uFEFF) ensures Excel and third-party tools parse UTF-8 characters properly
  const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = customFilename || `LeadGuard-Leads-${dateStr}.csv`;

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', filename);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[LeadGuard CSV Export] Failed to generate CSV download:', err);
    return false;
  }
}
