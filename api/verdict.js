// api/verdict.js
//
// Takes the full question/answer history from one viva session and asks
// the LLM to produce a structured breakdown: what the student clearly
// understood, what they couldn't defend, and a short overall summary.
// This is the "verdict card" — the demo's payoff shot.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "GROQ_API_KEY is not set. Run: vercel env add GROQ_API_KEY",
    });
    return;
  }

  const { history } = req.body || {};
  if (!history || !history.length) {
    res.status(400).json({ error: "Missing 'history' in request body." });
    return;
  }

  const transcript = history
    .map((h) => `Q: ${h.question}\nA: ${h.answer}`)
    .join("\n\n");

  const systemPrompt = `You are an oral examiner writing a final verdict after a viva session.

Look at the full transcript of questions and answers below. Identify:
- Which concepts the student clearly understood and defended well.
- Which concepts they got wrong, were vague on, or couldn't defend under follow-up questioning.

Respond with ONLY valid JSON, no markdown code fences, no commentary before or after, in exactly this shape:
{"overallSummary": "one short paragraph, spoken tone", "strong": ["short phrase", "short phrase"], "weak": ["short phrase", "short phrase"]}`;

  try {
    const upstream = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          max_tokens: 500,
          reasoning_effort: "low",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Here is the full viva transcript:\n\n${transcript}\n\nGive your verdict now, as JSON only.`,
            },
          ],
        }),
      },
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: text });
      return;
    }

    const data = await upstream.json();
    let raw = data.choices?.[0]?.message?.content?.trim() || "{}";

    // Safety net in case the model wraps the JSON in a code fence anyway.
    raw = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { overallSummary: raw, strong: [], weak: [] };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
