// Pending proposal storage — Supabase primary, in-memory fallback
// NOTE: in-memory does NOT persist across serverless instances.
// Approval mode requires Supabase to be configured.

const inMemoryStore = new Map();

function supabaseHeaders() {
  return {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

export async function storePendingProposal(data) {
  if (hasSupabase()) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/pending_proposals`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('storePendingProposal error:', JSON.stringify(result));
        return { id: null, error: JSON.stringify(result) };
      }
      return { id: result[0]?.id, error: null };
    } catch (e) {
      console.error('storePendingProposal threw:', e.message);
      return { id: null, error: e.message };
    }
  }

  const id = crypto.randomUUID();
  inMemoryStore.set(id, { ...data, id, created_at: new Date().toISOString() });
  return { id, error: null };
}

export async function getPendingProposal(id) {
  if (hasSupabase()) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/pending_proposals?id=eq.${id}&select=*`;
    try {
      const res = await fetch(url, { headers: supabaseHeaders() });
      const result = await res.json();
      if (!res.ok) return { data: null, error: JSON.stringify(result) };
      return { data: result[0] || null, error: null };
    } catch (e) {
      return { data: null, error: e.message };
    }
  }

  return { data: inMemoryStore.get(id) || null, error: null };
}

export async function updateProposalStatus(id, status) {
  if (hasSupabase()) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/pending_proposals?id=eq.${id}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: err };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  const proposal = inMemoryStore.get(id);
  if (proposal) inMemoryStore.set(id, { ...proposal, status });
  return { success: true };
}
