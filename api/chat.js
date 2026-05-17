import https from 'https';

const qaSystemPrompt = `# About Me

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

const intakeSystemPrompt = `# About Me

I am **Snigdha Aggarwal Shah**, founder of **Connecting The Dots**, a consulting firm focused on philanthropy, social sector strategy, and CSR (founded January 2026).

**Background:**
- 15 years in the social sector; ~10 years as Founding CEO of SVP India – Kolkata Chapter (Social Venture Partners)
- Earlier career in corporate strategy, M&A, and investor relations
- MBA in Finance; BBM undergraduate; consistently top-ranking academic
- Deep experience in donor engagement, grant-making, capacity building, and nonprofit governance

**Core strengths:** Forging high-trust partnerships, connecting capital and institutions, translating broad ideas into structured action, managing complexity with clarity.

---

# Proposal Intake Instructions

You are Snigdha's assistant, gathering structured information to build a tailored proposal.

**Your role:**
- Gather exactly six pieces of information, ONE question at a time, in this order:
  1. What does your company/organization do? (industry, size, stage)
  2. What's the challenge or opportunity you're facing?
  3. What have you already tried or considered?
  4. What would success look like for you?
  5. What's your budget range?
  6. What's your email address?

**Rules you MUST follow:**
- Ask only ONE question per response — never more
- Acknowledge the previous answer naturally in one sentence, then ask the next question
- Use Snigdha's warm, direct voice — personal but professional
- Keep responses concise — acknowledgement + one question, nothing more
- No markdown. No bullet lists. Just natural conversation.
- After each answer, append exactly one marker with NO EXCEPTIONS:
  - If you're asking Q1, append: <INTAKE_STEP>1</INTAKE_STEP>
  - If you're asking Q2, append: <INTAKE_STEP>2</INTAKE_STEP>
  - If you're asking Q3, append: <INTAKE_STEP>3</INTAKE_STEP>
  - If you're asking Q4, append: <INTAKE_STEP>4</INTAKE_STEP>
  - If you're asking Q5, append: <INTAKE_STEP>5</INTAKE_STEP>
  - If you're asking Q6 (email), append: <INTAKE_STEP>6</INTAKE_STEP>
  - If Q6's email looks invalid (no @ or obvious typos), re-ask it with: <INTAKE_STEP>6</INTAKE_STEP>
  - Once you have a valid email (has @ and basic format), append: <INTAKE_COMPLETE>{"company":"<Q1 answer>","challenge":"<Q2 answer>","tried":"<Q3 answer>","success":"<Q4 answer>","budget":"<Q5 answer>","email":"<Q6 answer>"}</INTAKE_COMPLETE>

**Email validation:** A valid email has @ and a domain (e.g., user@example.com). If the user provides "not an email", ask for clarification — treat it as invalid and re-ask Q6 with the step 6 marker.

After collecting the valid email and sending the complete marker, you are done. Do not say anything after INTAKE_COMPLETE.`;

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
  const { messages, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
    return res.status(500).json({ error: 'API configuration error' });
  }

  const isIntake = mode === 'intake';
  const systemPrompt = isIntake ? intakeSystemPrompt : qaSystemPrompt;
  const maxTokens = isIntake ? 512 : 256;

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
      max_tokens: maxTokens,
    };

    const response = await makeRequest(options, payload);

    if (response.status !== 200) {
      console.error('OpenRouter error:', response.body);
      return res.status(response.status).json({
        error: response.body.error?.message || 'Failed to get response from API',
      });
    }

    let message = response.body.choices?.[0]?.message?.content;

    if (!message) {
      return res.status(500).json({ error: 'No response generated' });
    }

    // Parse intake markers
    if (isIntake) {
      // Detect completion: look for INTAKE_COMPLETE anywhere in message, then extract the JSON blob
      if (message.includes('INTAKE_COMPLETE') && !message.includes('INTAKE_STEP')) {
        const jsonMatch = message.match(/\{[\s\S]*?"email"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const intakeData = JSON.parse(jsonMatch[0]);
            if (intakeData.email) {
              const cleanMessage = message.replace(/[\s\S]*INTAKE_COMPLETE[\s\S]*?\{[\s\S]*?\}[\s=]*/g, '').trim();
              console.log('Intake complete detected, data:', JSON.stringify(intakeData));
              return res.json({ message: cleanMessage, intake_complete: true, intake_data: intakeData });
            }
          } catch (e) {
            console.error('Failed to parse intake JSON:', jsonMatch[0]);
          }
        }
      }

      // Detect step marker: look for INTAKE_STEP followed by a digit
      const stepMatch = message.match(/INTAKE_STEP[^0-9]*([1-6])/);
      if (stepMatch) {
        const cleanMessage = message.replace(/[^\w\s]*INTAKE_STEP[^0-9]*[1-6][^\w\s]*/g, '').trim();
        return res.json({ message: cleanMessage, intake_step: parseInt(stepMatch[1]) });
      }
    }

    // Q&A fallback (no markers)
    res.json({ message });
  } catch (error) {
    console.error('Chat API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default chat;
