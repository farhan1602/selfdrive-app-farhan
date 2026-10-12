// Vercel serverless function: AI price suggestion.
// Needs three environment variables in the Vercel project settings:
//   ANTHROPIC_API_KEY   your key from console.anthropic.com
//   SUPABASE_URL        https://<your-project>.supabase.co  (the real URL, not the /supabase proxy)
//   SUPABASE_ANON_KEY   your Supabase publishable key
// Only signed-in users of your platform can call it.
const hits = new Map();
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY)
    return res.status(501).json({ error: "AI pricing is not set up yet. Add ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_ANON_KEY in Vercel." });
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ error: "Not signed in" });
  let user;
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return res.status(401).json({ error: "Not signed in" });
    user = await u.json();
  } catch (e) { return res.status(502).json({ error: "Could not verify your login" }); }
  // simple per-user limit: 30 requests per hour
  const now = Date.now(), list = (hits.get(user.id) || []).filter(t => now - t < 3600e3);
  if (list.length >= 30) return res.status(429).json({ error: "Too many AI requests. Try again later." });
  list.push(now); hits.set(user.id, list);
  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== "string" || !prompt || prompt.length > 8000) return res.status(400).json({ error: "Bad request" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "The AI service returned an error" });
    const text = (j.content || []).map(x => x.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) { return res.status(502).json({ error: "Could not reach the AI service" }); }
};
