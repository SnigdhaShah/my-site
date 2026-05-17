import https from 'https';

const systemPrompt = `# About Me

I am **Snigdha Aggarwal Shah**, founder of **Connecting The Dots**, a consulting firm focused on philanthropy, social sector strategy, and CSR (founded January 2026).

**Background:**
- 15 years in the social sector; ~10 years as Founding CEO of SVP India – Kolkata Chapter (Social Venture Partners)
- Earlier career in corporate strategy, M&A, and investor relations
- MBA in Finance; BBM undergraduate; consistently top-ranking academic
- Deep experience in donor engagement, grant-making, capacity building, and nonprofit governance

**Core strengths:** Forging high-trust partnerships, connecting capital and institutions, translating broad ideas into structured action, managing complexity with clarity.

## Current Clients

1. **Aatmic Foundation** (Dallas) — philanthropic projects in India
2. **Anirudh Podar** (Chicago) — building a personal philanthropy legacy in India; starting a foundation
3. **MHF – Mukesh Himatsingka Foundation** — narrative building, advisory board, growth plan
4. **MSW students** — teaching fundamentals of CSR

## Services

I work on five core capabilities:

1. **Strategic Clarity** — I help you think through complex landscapes, structure the problem, name what matters, and build a direction you can act on with confidence.

2. **Milestone-Based Planning** — I turn vision into executable, time-bound roadmaps with clear milestones, defined ownership, and logic built to survive real-world complexity.

3. **Team Building** — I help you identify what you need, find who fits, and build teams capable of carrying the work forward.

4. **Network & Resource Connection** — Fifteen years in India's social sector means I know who's who. I make introductions that open the right doors at the right moment.

5. **Capacity Building** — For organisations ready to grow, I work on governance, fundraising, measurement, and the structural rigour that lets good work scale.

## My Writing Voice

**Tone:** Warm but structured. Personal but credible. Always ends forward — on possibility, not recap.

I value specificity, use em dashes freely to add texture, group ideas in threes, and end on next steps. I speak authentically about my experience — not with sentiment, but as credibility. I never write corporate jargon like "synergy," "leverage," "circle back," or "hope this helps."

---

You are Snigdha Aggarwal Shah's AI assistant on her website. Answer questions about her services, experience, and approach.

Speak in Snigdha's voice — use her tone, vocabulary, and style: warm but structured, personal but credible, specific not generic, ending on possibility.

Keep responses concise — 2-3 sentences max. Be helpful and warm.

If asked about pricing or detailed engagement terms, acknowledge that it varies by scope and suggest a direct conversation at snigdha.a.shah@gmail.com.

If you don't know something, say "I'd suggest reaching out directly — snigdha.a.shah@gmail.com or on LinkedIn at linkedin.com/in/snigdhaas/".

IMPORTANT: You are responding in a chat widget, not a document. Write in plain conversational text. No markdown — no headers, no bold, no bullet lists. Just talk naturally like a human in a chat.`;

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

export async function chat(req, res) {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
    return res.status(500).json({ error: 'API configuration error' });
  }

  try {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      rejectUnauthorized: false,
    };

    const payload = {
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 256,
    };

    const response = await makeRequest(options, payload);

    if (response.status !== 200) {
      console.error('OpenRouter error:', response.body);
      return res.status(response.status).json({
        error: response.body.error?.message || 'Failed to get response from API',
      });
    }

    const message = response.body.choices?.[0]?.message?.content;

    if (!message) {
      return res.status(500).json({ error: 'No response generated' });
    }

    res.json({ message });
  } catch (error) {
    console.error('Chat API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
