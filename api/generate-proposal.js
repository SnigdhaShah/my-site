// ============================================================================
// AGENTIC PROPOSAL ENGINE
// ============================================================================
// AI agent that writes proposals and delivers them via email/Telegram/Supabase.
//
// Two modes:
//   Default (APPROVAL_MODE unset):  proposal emailed to visitor automatically
//   APPROVAL_MODE=true:             proposal held for owner review first
// ============================================================================

import { renderProposalPdf, sendEmail, alertOwner, storeLead } from './_tools.js';
import { storePendingProposal } from './_store.js';

// ── Tool schemas for the agent ───────────────────────────────────────────────

const CORE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'render_proposal_pdf',
      description: 'Renders a branded proposal PDF. Returns page count and size.',
      parameters: {
        type: 'object',
        properties: {
          company_name:  { type: 'string' },
          contact_name:  { type: 'string' },
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
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Sends an email to the prospect with optional PDF attachment.',
      parameters: {
        type: 'object',
        properties: {
          to:         { type: 'string' },
          subject:    { type: 'string' },
          body:       { type: 'string' },
          attach_pdf: { type: 'boolean' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alert_owner',
      description: 'Sends a Telegram alert to the owner with lead summary.',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
  },
];

const STORE_LEAD_TOOL = {
  type: 'function',
  function: {
    name: 'store_lead',
    description: 'Stores the lead in the CRM database.',
    parameters: {
      type: 'object',
      properties: {
        name:      { type: 'string' },
        company:   { type: 'string' },
        email:     { type: 'string' },
        industry:  { type: 'string' },
        challenge: { type: 'string' },
        budget:    { type: 'string' },
        score:     { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        status:    { type: 'string' },
      },
      required: ['name', 'company', 'email', 'score', 'status'],
    },
  },
};

function getTools() {
  const tools = [...CORE_TOOLS];
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) tools.push(STORE_LEAD_TOOL);
  return tools;
}

// ── Agent system prompt ──────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are an AI agent acting on behalf of Snigdha Aggarwal Shah, founder of Connecting The Dots.

You have received intake data from a website visitor. Your job:
1. Write a personalized proposal in Snigdha's voice — warm but structured, specific to their situation
2. Score the lead using the triage rules below
3. Use your tools to: render the proposal as a PDF, email it to the visitor, store the lead (if available), and alert Snigdha on Telegram

## IDENTITY & VOICE

Snigdha is a philanthropy strategist and social sector advisor with 15 years in the sector. She was the Founding CEO of SVP India – Kolkata Chapter for ~10 years. Her core strengths: forging high-trust partnerships, connecting capital to institutions, translating complex ideas into structured action, and managing complexity with clarity.

**Tone:** Warm but structured. Personal but credible. Always forward-looking — on possibility, not recap. Use em dashes freely. Be specific, name things precisely. Never generic or transactional.

## SERVICES

1. **Philanthropy Strategy & Foundation Building** — designing governance, advisory boards, theory of change, 5-year strategies for HNI and family foundations
2. **India Context Advisory** — budgeting, due diligence, ecosystem mapping, recruitment support, troubleshooting for organizations launching/scaling work in India
3. **Capacity Building & CSR Alignment** — strengthening nonprofits and corporate CSR teams in governance, fundraising, measurement, strategy
4. **Narrative & Proposal Development** — crafting compelling, authentic proposals and positioning
5. **Strategic Workshops & Facilitation** — designing and leading growth strategy sessions, 5-year planning workshops, board retreats
6. **Philanthropy Mentorship** — serving as a "sherpa" for individuals building personal legacies, conducting research, designing workflows

## IDEAL CLIENTS & PRICING

- **HNI individuals & families** building personal legacies or foundations: INR 15k-50k+ annually for multi-month advisory
- **Foundations** (domestic or US-based) seeking India expansion, growth strategy, governance refresh: retainer relationships
- **Corporate CSR teams** wanting to move beyond compliance to strategy: project/workshop engagements
- **Scaling nonprofits** ready to professionalize: capacity-building engagements

## LEAD SCORING RULES

**HIGH** — Move forward. Strong alignment with firm strengths.
- HNI/individual building/starting a foundation with clear vision and budget
- Foundation seeking strategy refresh, India expansion, 5-year planning; decision-maker engaged
- Warm referral from SVP India network, existing clients, or colleagues
- India-focused challenge; organization launching/scaling work in India; ready to invest
- Retainer or long-term engagement (6+ months) signaled
- Budget allocated; no haggling expected

**MEDIUM** — Qualify further. Potential fit but unclear scope/budget/timing.
- Corporate CSR team wanting to strengthen strategy; budget constrained
- Nonprofit with governance need; strong mission fit; limited budget
- One-off project; clear scope; no signals of ongoing relationship
- US foundation exploring India; early-stage; no India on-ground experience
- Referred without context; requires initial call to qualify
- Budget signals vague

**LOW** — Not the right fit. Redirect or pass.
- Student or academic inquiry (unless formal teaching program)
- Generic CSR/nonprofit consulting; no India focus; no governance angle
- Nonprofit seeking discounted/free advice
- No clear problem statement
- Geographic misalignment (Africa, Southeast Asia, Global North)
- Cold outreach with no warm introduction
- Compliance-only CSR with no strategy appetite

## PROPOSAL STRUCTURE

Write 4-5 sections:
1. **Understanding Your Challenge** — show you listened; name the problem in their words
2. **Recommended Approach** — what you would do and why; specific to their problem
3. **Proposed Engagement** — which service(s), scope, timeline, deliverables
4. **Investment** — pricing range based on scope and complexity
5. **Next Steps** — what happens after they review; clear path forward

## INSTRUCTIONS
- Write the proposal in Snigdha's voice — warm, structured, direct, specific. Use em dashes. End forward on possibility.
- Score the lead (HIGH/MEDIUM/LOW)
- Call render_proposal_pdf with the proposal sections
- Call send_email with a warm, short email and the PDF attached
- If store_lead tool is available, call it with all lead data and score
- Call alert_owner with a summary: company, contact, challenge, score, and one line on why this matters
- You decide the order. Call multiple tools at once if they're independent.`;

// ── Request state ────────────────────────────────────────────────────────────
// Tracks per-request values that tools need to share (PDF base64, captured args)

function makeState(approvalMode) {
  return { approvalMode, pdfBase64: null, capturedEmail: null, capturedScore: null };
}

function extractScore(msg) {
  if (!msg) return null;
  const m = msg.match(/\b(HIGH|MEDIUM|LOW)\b/i);
  return m ? m[1].toUpperCase() : null;
}

// ── Tool dispatcher ──────────────────────────────────────────────────────────

async function executeTool(name, args, state) {
  switch (name) {
    case 'render_proposal_pdf': {
      const result = await renderProposalPdf(args);
      state.pdfBase64 = result.base64;
      return { success: true, pages: result.pages, size_kb: result.size_kb };
    }

    case 'send_email':
      if (state.approvalMode) {
        state.capturedEmail = args;
        return { success: true, queued_for_approval: true };
      }
      return sendEmail(args, state.pdfBase64);

    case 'store_lead':
      return storeLead(args);

    case 'alert_owner':
      if (state.approvalMode) {
        state.capturedScore = extractScore(args.message);
        return { success: true, queued_for_approval: true };
      }
      return alertOwner(args, state.pdfBase64);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function generateProposal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversation, intakeData } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  if (!conversation && !intakeData) return res.status(400).json({ error: 'conversation or intakeData required' });

  const approvalMode = process.env.APPROVAL_MODE === 'true';
  const state = makeState(approvalMode);
  const tools = getTools();
  const supabaseEnabled = tools.some(t => t.function?.name === 'store_lead');

  console.log(`Agent starting with ${tools.length} tools (approval=${approvalMode}, supabase=${supabaseEnabled})`);

  const intakeContext = intakeData
    ? `VISITOR INTAKE DATA:\n${JSON.stringify(intakeData, null, 2)}`
    : `CONVERSATION TRANSCRIPT:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  const approvalNote = approvalMode
    ? '\n\n[APPROVAL MODE ACTIVE]: Call send_email with the email you would send to the visitor — it will be held for review, not sent immediately. Call alert_owner starting with "PENDING APPROVAL:" followed by the lead score and a brief summary.'
    : '';

  let messages = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: `${intakeContext}${approvalNote}\n\nPlease write a personalized proposal, score this lead, and use your tools to send everything.` },
  ];

  const results = { proposal: false, email: false, stored: false, alerted: false };

  for (let turn = 1; turn <= 5; turn++) {
    console.log(`Agent turn ${turn}...`);

    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.headers?.host ? `https://${req.headers.host}` : 'http://localhost:3000',
        },
        body: JSON.stringify({ model: 'openai/gpt-4o', messages, tools, max_tokens: 4096, stream: false }),
      });
    } catch (e) {
      console.error('Agent fetch error:', e.message);
      return res.status(502).json({ error: 'Failed to connect to OpenRouter', details: e.message });
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter error:', err);
      return res.status(502).json({ error: 'Agent API call failed', details: err });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Response parse error:', e.message);
      return res.status(502).json({ error: 'Failed to parse OpenRouter response' });
    }

    const choice = data.choices?.[0];
    if (!choice) { console.error('No choice in response'); break; }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      console.log(`Turn ${turn}: agent completed (no more tool calls)`);
      break;
    }

    console.log(`Turn ${turn}: called ${assistantMessage.tool_calls.map(tc => tc.function.name).join(', ')}`);

    for (const toolCall of assistantMessage.tool_calls) {
      let args;
      try { args = JSON.parse(toolCall.function.arguments); }
      catch (e) {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: 'Failed to parse arguments' }) });
        continue;
      }

      let result;
      try { result = await executeTool(toolCall.function.name, args, state); }
      catch (e) {
        console.error(`Tool ${toolCall.function.name} threw:`, e.message);
        result = { success: false, error: e.message };
      }

      if (toolCall.function.name === 'render_proposal_pdf' && result.success) results.proposal = true;
      if (toolCall.function.name === 'send_email'  && result.success && !result.queued_for_approval) results.email = true;
      if (toolCall.function.name === 'store_lead'  && result.success) results.stored = true;
      if (toolCall.function.name === 'alert_owner' && result.success && !result.queued_for_approval) results.alerted = true;

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  // ── Approval mode: store proposal and notify owner ───────────────────────
  if (approvalMode && state.pdfBase64) {
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

    const { id, error: storeError } = await storePendingProposal({
      visitor_email:  state.capturedEmail?.to  || intakeData?.email  || null,
      intake_data:    intakeData               || null,
      lead_score:     state.capturedScore      || 'MEDIUM',
      email_subject:  state.capturedEmail?.subject || `Proposal from Connecting The Dots`,
      email_body:     state.capturedEmail?.body    || '',
      pdf_base64:     state.pdfBase64,
      status:         'pending',
      revision_count: 0,
    });

    if (storeError) {
      console.error('Failed to store pending proposal:', storeError);
    } else {
      const approvalUrl = `${baseUrl}/api/approve-proposal?id=${id}`;
      const score   = state.capturedScore || 'MEDIUM';
      const company = intakeData?.company  || 'New Lead';

      await alertOwner({
        message: `PENDING APPROVAL\n\nCompany: ${company}\nScore: ${score}\nChallenge: ${intakeData?.challenge || 'N/A'}\nBudget: ${intakeData?.budget || 'N/A'}\nEmail: ${intakeData?.email || 'N/A'}\n\nReview and approve:\n${approvalUrl}`,
      }, state.pdfBase64);

      const ownerEmail = process.env.OWNER_EMAIL || 'snigdha.a.shah@gmail.com';
      await sendEmail({
        to: ownerEmail,
        subject: `[REVIEW] Proposal for ${company} — ${score}`,
        body: `A new proposal is ready for your review.\n\nCompany: ${company}\nScore: ${score}\nChallenge: ${intakeData?.challenge || 'N/A'}\nBudget: ${intakeData?.budget || 'N/A'}\nVisitor email: ${intakeData?.email || 'N/A'}\n\nApprove or request changes:\n${approvalUrl}`,
        attach_pdf: true,
      }, state.pdfBase64);

      results.pending_approval_id = id;
      results.approval_url = approvalUrl;
      console.log('Approval notification sent, id:', id);
    }
  }

  // ── Fallback: store lead if agent didn't call store_lead ─────────────────
  if (!results.stored && intakeData) {
    try {
      const stored = await storeLead({
        company:   intakeData.company   || null,
        email:     intakeData.email     || null,
        challenge: intakeData.challenge || null,
        budget:    intakeData.budget    || null,
        score:     'MEDIUM',
        status:    approvalMode ? 'pending_approval' : 'proposal_sent',
      });
      if (stored.success) results.stored = true;
      else console.error('Fallback store_lead failed:', stored.error);
    } catch (e) {
      console.error('Fallback store_lead threw:', e.message);
    }
  }

  console.log('Agent pipeline complete:', results);
  return res.json({ success: true, results });
}

export default generateProposal;
