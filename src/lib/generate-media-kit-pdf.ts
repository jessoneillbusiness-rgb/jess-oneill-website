import { jsPDF } from 'jspdf';
import type { mediaKit } from '../config/media-kit';

type MediaKitContent = typeof mediaKit;

interface PlatformMetrics {
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  videos?: number | null;
  totalLikes?: number | null;
  insights?: {
    avgReach?: number | null;
    avgEngagement?: number | null;
    monthlyViews?: number | null;
    avgViews?: number | null;
    monthlyReach?: number | null;
    pageViews?: number | null;
  };
}

interface MediaMetricsResponse {
  updatedAt: string;
  platforms: {
    instagram?: PlatformMetrics;
    tiktok?: PlatformMetrics;
    facebook?: PlatformMetrics;
  };
  totals: {
    audience?: number | null;
  };
}

const TIFFANY: [number, number, number] = [10, 186, 181];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAY: [number, number, number] = [92, 92, 92];
const LIGHT: [number, number, number] = [230, 230, 230];
const OFF_WHITE: [number, number, number] = [248, 248, 248];

const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 287;

function fmt(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return '—';
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 6) {
    doc.addPage();
    drawPageAccent(doc);
    return 28;
  }
  return y;
}

function drawPageAccent(doc: jsPDF) {
  doc.setFillColor(...TIFFANY);
  doc.rect(0, 0, PAGE_W, 8, 'F');
}

function sectionTitle(doc: jsPDF, label: string, y: number): number {
  y = ensureSpace(doc, y, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TIFFANY);
  doc.text(label.toUpperCase(), MARGIN, y);
  y += 5;
  doc.setDrawColor(...TIFFANY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN + 32, y);
  return y + 9;
}

function buildPlatformRows(platform: PlatformMetrics | undefined, insights: PlatformMetrics['insights']) {
  const rows: Array<[string, string]> = [['Followers', fmt(platform?.followers, true)]];

  if (platform?.posts != null) rows.push(['Posts', fmt(platform.posts)]);
  if (platform?.videos != null) rows.push(['Videos', fmt(platform.videos)]);
  if (platform?.totalLikes != null) rows.push(['Total Likes', fmt(platform.totalLikes, true)]);
  if (platform?.following != null) rows.push(['Following', fmt(platform.following)]);

  if (insights?.avgReach != null) rows.push(['Avg. Reach / Post', fmt(insights.avgReach, true)]);
  if (insights?.avgViews != null) rows.push(['Avg. Views / Video', fmt(insights.avgViews, true)]);
  if (insights?.avgEngagement != null) rows.push(['Avg. Engagement', `${insights.avgEngagement}%`]);
  if (insights?.monthlyViews != null) rows.push(['Monthly Views', fmt(insights.monthlyViews, true)]);
  if (insights?.monthlyReach != null) rows.push(['Monthly Reach', fmt(insights.monthlyReach, true)]);
  if (insights?.pageViews != null) rows.push(['Page Views', fmt(insights.pageViews, true)]);

  return rows;
}

export async function generateMediaKitPdf(content: MediaKitContent, socialUrls: Record<string, string>) {
  const response = await fetch('/api/media-metrics');
  if (!response.ok) throw new Error('Could not load metrics');

  const metrics: MediaMetricsResponse = await response.json();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  drawPageAccent(doc);

  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...BLACK);
  doc.text("JESS O'NEILL", MARGIN, y);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TIFFANY);
  doc.text('MEDIA KIT  ·  FOR BRANDS & PR', MARGIN, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BLACK);
  y = wrapText(doc, content.headline, MARGIN, y, CONTENT_W, 6.5);

  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...GRAY);
  y = wrapText(doc, content.subheadline, MARGIN, y, CONTENT_W, 5.2);

  y += 8;
  doc.setFillColor(...OFF_WHITE);
  doc.setDrawColor(...TIFFANY);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('TOTAL CROSS-PLATFORM AUDIENCE', MARGIN + 6, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...TIFFANY);
  doc.text(fmt(metrics.totals.audience), MARGIN + 6, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const updated = new Date(metrics.updatedAt).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  doc.text(`Updated ${updated}`, PAGE_W - MARGIN - 6, y + 8, { align: 'right' });

  y += 36;

  y = sectionTitle(doc, 'Platform Statistics', y);

  const colW = (CONTENT_W - 6) / 3;
  const platforms = [
    { name: 'Instagram', handle: '@jess.oneill', data: metrics.platforms.instagram },
    { name: 'TikTok', handle: '@imjesschillin', data: metrics.platforms.tiktok },
    { name: 'Facebook', handle: 'Jess O\'Neill', data: metrics.platforms.facebook },
  ] as const;

  const maxRows = Math.max(
    ...platforms.map((p) => buildPlatformRows(p.data, p.data?.insights).filter(([, v]) => v !== '—').length),
  );
  const boxH = 14 + maxRows * 8.5;
  y = ensureSpace(doc, y, boxH + 8);

  platforms.forEach((platform, index) => {
    const x = MARGIN + index * (colW + 3);
    const rows = buildPlatformRows(platform.data, platform.data?.insights);

    doc.setFillColor(...OFF_WHITE);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 4, colW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(platform.name, x + 4, y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TIFFANY);
    doc.text(platform.handle, x + 4, y + 7);

    let rowY = y + 13;
    for (const [label, value] of rows) {
      if (value === '—') continue;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...GRAY);
      doc.text(label, x + 4, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...BLACK);
      doc.text(value, x + colW - 4, rowY, { align: 'right' });
      rowY += 8.5;
    }
  });

  y += boxH + 10;

  y = sectionTitle(doc, 'Audience', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  y = wrapText(doc, content.audience.summary, MARGIN, y, CONTENT_W, 5.2);

  y += 3;
  for (const item of content.audience.highlights) {
    y = ensureSpace(doc, y, 6);
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text('•', MARGIN, y);
    y = wrapText(doc, item, MARGIN + 4, y, CONTENT_W - 4, 5);
  }

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  doc.text(`Location: ${content.location}`, MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  y = wrapText(doc, `Niches: ${content.niches.join(' · ')}`, MARGIN, y, CONTENT_W, 5);

  y = sectionTitle(doc, 'Collaborations', y + 4);

  const halfW = (CONTENT_W - 6) / 2;
  let leftY = y;
  let rightY = y;

  content.offerings.forEach((group, index) => {
    const isLeft = index % 2 === 0;
    const x = isLeft ? MARGIN : MARGIN + halfW + 6;
    let colY = isLeft ? leftY : rightY;

    colY = ensureSpace(doc, colY, 12);
    if (isLeft && colY > leftY) leftY = colY;
    if (!isLeft && colY > rightY) rightY = colY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TIFFANY);
    doc.text(group.title.toUpperCase(), x, colY);
    colY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    for (const item of group.items) {
      colY = ensureSpace(doc, colY, 5);
      doc.text('•', x, colY);
      colY = wrapText(doc, item, x + 4, colY, halfW - 4, 4.8);
    }
    colY += 4;

    if (isLeft) leftY = colY;
    else rightY = colY;
  });

  y = Math.max(leftY, rightY) + 4;

  y = sectionTitle(doc, 'Contact', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text('Partnerships & press enquiries:', MARGIN, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TIFFANY);
  doc.text(content.contactEmail, MARGIN, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text('Website: www.jess-oneill.com/media-kit', MARGIN, y);
  y += 5.5;

  for (const [name, url] of Object.entries(socialUrls)) {
    y = ensureSpace(doc, y, 5.5);
    doc.text(`${name}: ${url}`, MARGIN, y);
    y += 5.5;
  }

  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  wrapText(doc, content.pressNote, MARGIN, y, CONTENT_W, 4.2);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("Jess O'Neill  ·  Media Kit  ·  www.jess-oneill.com", PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }

  doc.save('Jess-ONeill-Media-Kit.pdf');
}
