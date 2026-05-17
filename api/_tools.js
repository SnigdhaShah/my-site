// Shared tool implementations — used by generate-proposal and approve-proposal
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// pdf-lib only supports WinAnsi — strip/replace anything outside printable ASCII
export function sanitizeForPdf(text) {
  if (!text) return '';
  return text
    .replace(/₹/g, 'INR ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/[–—―]/g, '-')
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‹›]/g, "'")
    .replace(/[«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/[     ]/g, ' ')
    .replace(/[•‣◦⁃]/g, '-')
    .replace(/✓/g, '[x]')
    .replace(/✗/g, '[ ]')
    .replace(/×/g, 'x')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

// Returns { base64, pages, size_kb } — no module-level side effects
export async function renderProposalPdf({ company_name, contact_name, sections }) {
  company_name = sanitizeForPdf(company_name);
  contact_name = sanitizeForPdf(contact_name);
  sections = sections.map(s => ({
    heading: sanitizeForPdf(s.heading),
    body: sanitizeForPdf(s.body),
  }));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const brandPrimary = rgb(0.110, 0.169, 0.227);
  const brandAccent  = rgb(0.769, 0.467, 0.353);
  const black = rgb(0.1, 0.1, 0.1);
  const gray  = rgb(0.35, 0.35, 0.35);

  // Cover page
  const cover = pdf.addPage([612, 792]);
  cover.drawRectangle({ x: 0, y: 692, width: 612, height: 100, color: brandPrimary });
  cover.drawText('SNIGDHA AGGARWAL SHAH', { x: 50, y: 732, size: 22, font: fontBold, color: rgb(1, 1, 1) });
  cover.drawText('Connecting The Dots - Philanthropy Strategy & India Expertise', { x: 50, y: 710, size: 12, font, color: rgb(0.8, 0.8, 0.8) });
  cover.drawText('PROPOSAL', { x: 50, y: 600, size: 36, font: fontBold, color: brandPrimary });
  cover.drawText(`Prepared for ${contact_name}`, { x: 50, y: 565, size: 16, font, color: black });
  cover.drawText(company_name, { x: 50, y: 542, size: 14, font, color: gray });
  cover.drawText(
    new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
    { x: 50, y: 510, size: 12, font, color: gray }
  );

  // Content pages
  let y = 720;
  let page = pdf.addPage([612, 792]);
  const maxWidth = 500;

  function drawLine(text, opts) {
    if (y < 60) { page = pdf.addPage([612, 792]); y = 720; }
    page.drawText(text, { x: 50, y, ...opts });
    y -= opts.lineHeight || 18;
  }

  for (const section of sections) {
    if (y < 120) { page = pdf.addPage([612, 792]); y = 720; }
    page.drawLine({ start: { x: 50, y: y + 20 }, end: { x: 120, y: y + 20 }, thickness: 2, color: brandAccent });
    drawLine(section.heading, { size: 16, font: fontBold, color: brandPrimary, lineHeight: 28 });

    for (const paragraph of section.body.split('\n')) {
      if (!paragraph.trim()) { y -= 10; continue; }
      let line = '';
      for (const word of paragraph.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, 11) > maxWidth && line) {
          drawLine(line, { size: 11, font, color: black });
          line = word;
        } else {
          line = test;
        }
      }
      if (line) drawLine(line, { size: 11, font, color: black });
    }
    y -= 20;
  }

  const lastPage = pdf.getPages()[pdf.getPageCount() - 1];
  lastPage.drawText('snigdha.a.shah@gmail.com', { x: 50, y: 30, size: 9, font, color: gray });

  const pdfBytes = await pdf.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');
  return { base64, pages: pdf.getPageCount(), size_kb: Math.round(pdfBytes.length / 1024) };
}

// pdfBase64 is passed explicitly — no shared state
export async function sendEmail({ to, subject, body, attach_pdf }, pdfBase64 = null) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const payload = {
    from: 'Snigdha Aggarwal Shah <onboarding@resend.dev>',
    to,
    subject,
    text: body,
  };
  if (attach_pdf && pdfBase64) {
    payload.attachments = [{ filename: 'proposal.pdf', content: pdfBase64 }];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return { success: false, error: `Resend error: ${res.status}` };
  }

  const data = await res.json();
  return { success: true, email_id: data.id };
}

export async function alertOwner({ message }, pdfBase64 = null) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_USER_ID;
  if (!botToken || !chatId) return { success: false, error: 'Telegram not configured' };

  const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  if (!textRes.ok) {
    const err = await textRes.text();
    console.error('Telegram error:', err);
    return { success: false, error: `Telegram error: ${textRes.status}` };
  }

  if (pdfBase64) {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), 'proposal.pdf');
    formData.append('caption', 'Proposal PDF');
    await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: formData });
  }

  return { success: true };
}

export async function storeLead(leadData) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return { success: false, error: 'Supabase not configured' };

  const row = {
    name:      leadData.name     || null,
    company:   leadData.company  || null,
    email:     leadData.email    || null,
    industry:  leadData.industry || null,
    challenge: leadData.challenge || null,
    budget:    leadData.budget   || null,
    score:     leadData.score    || null,
    status:    leadData.status   || 'proposal_sent',
  };

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('storeLead error:', res.status, err);
    return { success: false, error: `Supabase error: ${res.status}` };
  }

  return { success: true };
}
