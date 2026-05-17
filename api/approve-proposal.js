// Proposal approval endpoint — human-in-the-loop review before visitor delivery
// GET  ?id=xxx         — show approval page
// POST action=approve  — send proposal email to visitor
// POST action=revise   — regenerate proposal with instructions, show new approval page

import { renderProposalPdf, sendEmail, alertOwner } from './_tools.js';
import { getPendingProposal, storePendingProposal, updateProposalStatus } from './_store.js';

// ── Revision agent ────────────────────────────────────────────────────────────
// Calls OpenRouter to rewrite the proposal given revision instructions,
// then re-renders the PDF. Returns the new PDF base64 or null on failure.

async function runRevisionAgent(pendingProposal, instructions) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const { intake_data: intakeData, email_body, lead_score } = pendingProposal;

  const systemPrompt = `You are revising a proposal on behalf of Snigdha Aggarwal Shah (Connecting The Dots).
Apply the revision instructions and call render_proposal_pdf with the updated proposal.
Write 4-5 clear sections. Use Snigdha's warm, structured tone — specific, forward-looking, no corporate jargon.
Keep the same company_name and contact_name as the original.`;

  const userMessage = `INTAKE DATA:\n${JSON.stringify(intakeData || {}, null, 2)}\n\nPREVIOUS EMAIL BODY (for context):\n${email_body || '(not available)'}\n\nREVISION INSTRUCTIONS:\n${instructions}\n\nApply these changes and call render_proposal_pdf with the revised sections.`;

  const tools = [{
    type: 'function',
    function: {
      name: 'render_proposal_pdf',
      description: 'Renders the revised proposal PDF.',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          contact_name: { type: 'string' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: { heading: { type: 'string' }, body: { type: 'string' } },
              required: ['heading', 'body'],
            },
          },
        },
        required: ['company_name', 'contact_name', 'sections'],
      },
    },
  }];

  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let newPdfBase64 = null;

  for (let turn = 1; turn <= 3; turn++) {
    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-4o', messages, tools, max_tokens: 4096, stream: false }),
      });
    } catch (e) {
      console.error('Revision agent fetch error:', e.message);
      break;
    }

    if (!response.ok) { console.error('Revision OpenRouter error:', response.status); break; }

    let data;
    try { data = await response.json(); } catch { break; }

    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);

    if (!msg.tool_calls?.length) break;

    for (const tc of msg.tool_calls) {
      if (tc.function.name === 'render_proposal_pdf') {
        try {
          const args = JSON.parse(tc.function.arguments);
          const result = await renderProposalPdf(args);
          newPdfBase64 = result.base64;
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ success: true, pages: result.pages }) });
        } catch (e) {
          console.error('Revision render error:', e.message);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ success: false, error: e.message }) });
        }
      }
    }

    if (newPdfBase64) break;
  }

  return newPdfBase64;
}

// ── HTML approval page ────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score === 'HIGH')   return '#1a7a4a';
  if (score === 'MEDIUM') return '#b87a00';
  return '#cc3333';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPage(proposal, id, flash = null) {
  const intake  = proposal.intake_data || {};
  const score   = proposal.lead_score  || 'MEDIUM';
  const isPending = proposal.status === 'pending';

  const statusBanner = !isPending
    ? `<div class="banner banner-info">This proposal has already been <strong>${escapeHtml(proposal.status)}</strong>.</div>`
    : '';

  const flashHtml = flash
    ? `<div class="banner banner-${flash.type}">${escapeHtml(flash.message)}</div>`
    : '';

  const actionHtml = isPending ? `
    <form method="POST" style="display:inline">
      <input type="hidden" name="id" value="${escapeHtml(id)}">
      <input type="hidden" name="action" value="approve">
      <button type="submit" class="btn-approve">Approve &amp; Send to Visitor</button>
    </form>

    <div class="revise-section">
      <h2>Request Changes</h2>
      <form method="POST">
        <input type="hidden" name="id" value="${escapeHtml(id)}">
        <input type="hidden" name="action" value="revise">
        <label for="instructions">Describe what to change:</label>
        <textarea id="instructions" name="instructions" placeholder="e.g. Make the pricing section more specific. Add a section on timeline. Soften the opening paragraph."></textarea>
        <button type="submit" class="btn-revise">Regenerate Proposal</button>
      </form>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proposal Review — Connecting The Dots</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f5f7; color: #1C2B3A; }
    .header { background: #1C2B3A; color: #fff; padding: 20px 32px; }
    .header h1 { font-size: 20px; font-weight: 600; }
    .header p  { font-size: 13px; color: #aab; margin-top: 4px; }
    .container { max-width: 760px; margin: 32px auto; padding: 0 16px 60px; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 20px; }
    .card h2 { font-size: 15px; font-weight: 600; color: #1C2B3A; margin-bottom: 14px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #C4775A; padding-bottom: 8px; }
    .field { margin-bottom: 10px; font-size: 14px; }
    .field strong { display: inline-block; width: 110px; color: #666; }
    .score { font-weight: 700; font-size: 15px; }
    .email-subject { font-weight: 600; margin-bottom: 10px; font-size: 14px; }
    .email-body { white-space: pre-wrap; font-size: 13px; line-height: 1.6; color: #333; background: #f9f9f9; padding: 14px; border-radius: 4px; }
    .btn-approve { background: #1C2B3A; color: #fff; border: none; padding: 13px 28px; font-size: 15px; font-weight: 600; border-radius: 6px; cursor: pointer; }
    .btn-approve:hover { background: #2a3f55; }
    .revise-section { margin-top: 28px; }
    .revise-section h2 { font-size: 15px; font-weight: 600; color: #1C2B3A; margin-bottom: 12px; }
    label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; }
    textarea { width: 100%; height: 90px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: inherit; resize: vertical; }
    .btn-revise { margin-top: 10px; background: #C4775A; color: #fff; border: none; padding: 11px 22px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; }
    .btn-revise:hover { background: #b06548; }
    .banner { padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; font-size: 14px; }
    .banner-info    { background: #fff8e6; border: 1px solid #f0c070; }
    .banner-success { background: #e6f4ec; border: 1px solid #6abf82; }
    .banner-error   { background: #fde8e8; border: 1px solid #e07070; }
    .revision-badge { font-size: 12px; color: #888; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Proposal Review</h1>
    <p>Connecting The Dots — Human-in-the-Loop Approval</p>
  </div>
  <div class="container">
    ${statusBanner}
    ${flashHtml}

    <div class="card">
      <h2>Lead Summary</h2>
      <div class="field"><strong>Company</strong> ${escapeHtml(intake.company || '—')}</div>
      <div class="field"><strong>Email</strong> ${escapeHtml(proposal.visitor_email || intake.email || '—')}</div>
      <div class="field"><strong>Challenge</strong> ${escapeHtml(intake.challenge || '—')}</div>
      <div class="field"><strong>Budget</strong> ${escapeHtml(intake.budget || '—')}</div>
      <div class="field"><strong>Score</strong> <span class="score" style="color:${scoreColor(score)}">${escapeHtml(score)}</span></div>
      ${proposal.revision_count > 0 ? `<p class="revision-badge">Revision ${proposal.revision_count}</p>` : ''}
    </div>

    <div class="card">
      <h2>Email to Visitor</h2>
      <div class="email-subject">Subject: ${escapeHtml(proposal.email_subject || '(no subject)')}</div>
      <div class="email-body">${escapeHtml(proposal.email_body || '(no body)')}</div>
    </div>

    ${actionHtml}
  </div>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).send('Method not allowed');
}

async function handleGet(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).send('<p>Missing proposal ID</p>');

  const { data: proposal, error } = await getPendingProposal(id);
  if (error) return res.status(500).send(`<p>Storage error: ${escapeHtml(error)}</p>`);
  if (!proposal) return res.status(404).send('<p>Proposal not found or expired.</p>');

  res.setHeader('Content-Type', 'text/html');
  return res.send(renderPage(proposal, id));
}

async function handlePost(req, res) {
  const body = req.body || {};
  const { action, id, instructions } = body;

  if (!id)     return res.status(400).send('<p>Missing proposal ID</p>');
  if (!action) return res.status(400).send('<p>Missing action</p>');

  const { data: proposal, error } = await getPendingProposal(id);
  if (error)    return res.status(500).send(`<p>Storage error: ${escapeHtml(error)}</p>`);
  if (!proposal) return res.status(404).send('<p>Proposal not found.</p>');

  if (proposal.status !== 'pending') {
    res.setHeader('Content-Type', 'text/html');
    return res.send(renderPage(proposal, id, { type: 'info', message: `This proposal was already ${proposal.status}.` }));
  }

  // ── Approve ─────────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const visitorEmail = proposal.visitor_email;
    if (!visitorEmail) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'No visitor email on record — cannot send.' }));
    }

    let emailOk = false;
    try {
      const result = await sendEmail({
        to:         visitorEmail,
        subject:    proposal.email_subject || 'Your Proposal from Connecting The Dots',
        body:       proposal.email_body    || '',
        attach_pdf: true,
      }, proposal.pdf_base64);
      emailOk = result.success;
      if (!emailOk) console.error('Approve send_email failed:', result.error);
    } catch (e) {
      console.error('Approve send_email threw:', e.message);
    }

    if (!emailOk) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'Failed to send email. Check RESEND_API_KEY.' }));
    }

    await updateProposalStatus(id, 'approved');

    const intake  = proposal.intake_data || {};
    const company = intake.company || 'the visitor';

    await alertOwner({
      message: `APPROVED - Proposal sent\n\nCompany: ${company}\nScore: ${proposal.lead_score || 'MEDIUM'}\nSent to: ${visitorEmail}`,
    }, null);

    res.setHeader('Content-Type', 'text/html');
    return res.send(renderPage({ ...proposal, status: 'approved' }, id, {
      type: 'success',
      message: `Proposal sent to ${visitorEmail}. Telegram confirmation dispatched.`,
    }));
  }

  // ── Revise ──────────────────────────────────────────────────────────────────
  if (action === 'revise') {
    if (!instructions?.trim()) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'Please describe the changes you want.' }));
    }

    const revisionCount = (proposal.revision_count || 0) + 1;
    if (revisionCount > 5) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'Maximum revisions (5) reached.' }));
    }

    console.log(`Running revision ${revisionCount} for proposal ${id}...`);

    const newPdfBase64 = await runRevisionAgent(proposal, instructions);
    if (!newPdfBase64) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'Revision failed — could not generate new proposal. Try again.' }));
    }

    await updateProposalStatus(id, 'revised');

    const { id: newId, error: newStoreError } = await storePendingProposal({
      visitor_email:  proposal.visitor_email,
      intake_data:    proposal.intake_data,
      lead_score:     proposal.lead_score,
      email_subject:  proposal.email_subject,
      email_body:     proposal.email_body,
      pdf_base64:     newPdfBase64,
      status:         'pending',
      revision_count: revisionCount,
    });

    if (newStoreError || !newId) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(renderPage(proposal, id, { type: 'error', message: 'Revision generated but failed to save. Try again.' }));
    }

    console.log(`Revision stored as new proposal ${newId}`);
    return res.redirect(302, `/api/approve-proposal?id=${newId}`);
  }

  return res.status(400).send('<p>Unknown action</p>');
}
