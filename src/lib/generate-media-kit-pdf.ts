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
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 286;
const PAGE_START_Y = 26;

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
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawPageAccent(doc: jsPDF) {
  doc.setFillColor(...TIFFANY);
  doc.rect(0, 0, PAGE_W, 6, 'F');
}

function addPage(doc: jsPDF): number {
  doc.addPage();
  drawPageAccent(doc);
  return PAGE_START_Y;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 8) return addPage(doc);
  return y;
}

function sectionTitle(doc: jsPDF, label: string, y: number, x = MARGIN, width = CONTENT_W): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TIFFANY);
  doc.text(label.toUpperCase(), x, y);
  y += 4;
  doc.setDrawColor(...TIFFANY);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + Math.min(30, width * 0.35), y);
  return y + 7;
}

function buildPlatformRows(platform: PlatformMetrics | undefined, insights: PlatformMetrics['insights']) {
  const rows: Array<[string, string]> = [['Followers', fmt(platform?.followers, true)]];

  if (platform?.posts != null) rows.push(['Posts', fmt(platform.posts)]);
  if (platform?.videos != null) rows.push(['Videos', fmt(platform.videos)]);
  if (platform?.totalLikes != null) rows.push(['Total Likes', fmt(platform.totalLikes, true)]);
  if (platform?.following != null) rows.push(['Following', fmt(platform.following)]);

  if (insights?.avgReach != null) rows.push(['Avg. Reach / Post', fmt(insights.avgReach, true)]);
  if (insights?.avgViews != null) rows.push(['Avg. Views / Video', fmt(insights.avgViews, true)]);
  if (insights?.avgLikesPerVideo != null) {
    rows.push(['Avg. Likes / Video', fmt(insights.avgLikesPerVideo, true)]);
  }
  if (insights?.avgEngagement != null) rows.push(['Avg. Engagement', `${insights.avgEngagement}%`]);
  if (insights?.monthlyViews != null) rows.push(['Monthly Views', fmt(insights.monthlyViews, true)]);
  if (insights?.monthlyReach != null) rows.push(['Monthly Reach', fmt(insights.monthlyReach, true)]);
  if (insights?.pageViews != null) rows.push(['Page Views', fmt(insights.pageViews, true)]);

  return rows.filter(([, value]) => value !== '—');
}

function drawPlatformCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
  handle: string,
  rows: Array<[string, string]>,
): void {
  doc.setFillColor(...OFF_WHITE);
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(name, x + 3, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TIFFANY);
  doc.text(handle, x + 3, y + 10.5);

  let rowY = y + 15;
  const rowH = 7;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(label, x + 3, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(value, x + width - 3, rowY, { align: 'right' });
    rowY += rowH;
  }
}

function drawOfferingCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  items: readonly string[],
): number {
  const innerW = width - 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  let contentH = 10;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, innerW - 6) as string[];
    contentH += lines.length * 4.2 + 0.5;
  }
  const boxH = contentH + 4;

  doc.setFillColor(...OFF_WHITE);
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, boxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TIFFANY);
  doc.text(title.toUpperCase(), x + 3, y + 5.5);

  let itemY = y + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  for (const item of items) {
    doc.text('•', x + 3, itemY);
    itemY = wrapText(doc, item, x + 6, itemY, innerW - 6, 4.2);
  }

  return boxH;
}

function drawContactBlock(
  doc: jsPDF,
  y: number,
  content: MediaKitContent,
  socialUrls: Record<string, string>,
): number {
  y = ensureSpace(doc, y, 42);

  const boxH = 38;
  doc.setFillColor(...BLACK);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Let's Work Together", MARGIN + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TIFFANY);
  doc.text(content.contactEmail, MARGIN + 6, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 200, 200);
  doc.text('www.jess-oneill.com/media-kit', MARGIN + 6, y + 22);

  const socialLine = Object.entries(socialUrls)
    .map(([name, url]) => `${name}: ${url.replace('https://www.', '').replace('https://', '')}`)
    .join('   ·   ');
  doc.text(socialLine, MARGIN + 6, y + 28, { maxWidth: CONTENT_W - 12 });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  wrapText(doc, content.pressNote, MARGIN + 6, y + 33, CONTENT_W - 12, 3.5);

  return y + boxH + 6;
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 3, PAGE_W - MARGIN, FOOTER_Y - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text("Jess O'Neill  ·  Media Kit  ·  www.jess-oneill.com", PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

export async function generateMediaKitPdf(content: MediaKitContent, socialUrls: Record<string, string>) {
  const response = await fetch('/api/media-metrics');
  if (!response.ok) throw new Error('Could not load metrics');

  const metrics: MediaMetricsResponse = await response.json();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  drawPageAccent(doc);

  // ── Page 1: Header + audience total + platform stats ──
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...BLACK);
  doc.text("JESS O'NEILL", MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TIFFANY);
  doc.text('MEDIA KIT  ·  FOR BRANDS & PR', MARGIN, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  y = wrapText(doc, content.headline, MARGIN, y + 14, CONTENT_W, 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  y = wrapText(doc, content.subheadline, MARGIN, y + 1, CONTENT_W, 4.5);

  y += 6;
  const statBoxH = 22;
  doc.setFillColor(...OFF_WHITE);
  doc.setDrawColor(...TIFFANY);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, statBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('TOTAL CROSS-PLATFORM AUDIENCE', MARGIN + 5, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TIFFANY);
  doc.text(fmt(metrics.totals.audience), MARGIN + 5, y + 16);

  const updated = new Date(metrics.updatedAt).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`Updated ${updated}`, PAGE_W - MARGIN - 5, y + 6, { align: 'right' });

  y += statBoxH + 8;
  y = sectionTitle(doc, 'Platform Statistics', y);

  const colW = (CONTENT_W - 8) / 3;
  const platforms = [
    { name: 'Instagram', handle: '@jess.oneill', data: metrics.platforms.instagram },
    { name: 'TikTok', handle: '@imjesschillin', data: metrics.platforms.tiktok },
    { name: 'Facebook', handle: 'Jess O\'Neill', data: metrics.platforms.facebook },
  ] as const;

  const platformHeights = platforms.map((p) => {
    const rows = buildPlatformRows(p.data, p.data?.insights);
    return 16 + rows.length * 7;
  });
  const maxPlatformH = Math.max(...platformHeights);

  y = ensureSpace(doc, y, maxPlatformH + 4);

  platforms.forEach((platform, index) => {
    const x = MARGIN + index * (colW + 4);
    const rows = buildPlatformRows(platform.data, platform.data?.insights);
    drawPlatformCard(doc, x, y, colW, maxPlatformH, platform.name, platform.handle, rows);
  });

  y += maxPlatformH + 10;

  // ── Page 2: Audience + Collaborations side-by-side, then contact ──
  y = addPage(doc);

  const gap = 8;
  const leftW = CONTENT_W * 0.48;
  const rightW = CONTENT_W - leftW - gap;
  const rightX = MARGIN + leftW + gap;

  let leftY = sectionTitle(doc, 'Audience', y, MARGIN, leftW);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  leftY = wrapText(doc, content.audience.summary, MARGIN, leftY, leftW, 4.5);

  leftY += 2;
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  for (const item of content.audience.highlights) {
    doc.text('•', MARGIN, leftY);
    leftY = wrapText(doc, item, MARGIN + 3, leftY, leftW - 3, 4.2);
    leftY += 0.5;
  }

  leftY += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text(`Location: ${content.location}`, MARGIN, leftY);
  leftY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  leftY = wrapText(doc, `Niches: ${content.niches.join(' · ')}`, MARGIN, leftY, leftW, 4.2);

  let rightY = sectionTitle(doc, 'Collaborations', y, rightX, rightW);

  const cardW = (rightW - 4) / 2;
  const offerings = content.offerings;
  let gridY = rightY;
  let rowMaxH = 0;

  for (let i = 0; i < offerings.length; i += 2) {
    const topRow = offerings.slice(i, i + 2);
    rowMaxH = 0;

    topRow.forEach((group, colIndex) => {
      const cardX = rightX + colIndex * (cardW + 4);
      const cardH = drawOfferingCard(doc, cardX, gridY, cardW, group.title, group.items);
      rowMaxH = Math.max(rowMaxH, cardH);
    });

    gridY += rowMaxH + 4;
  }

  rightY = gridY;

  y = Math.max(leftY, rightY) + 8;
  y = drawContactBlock(doc, y, content, socialUrls);

  drawFooters(doc);
  doc.save('Jess-ONeill-Media-Kit.pdf');
}
