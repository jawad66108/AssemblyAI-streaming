// api/next-question.js
//
// Given the current question, the student's spoken answer, and the prior
// history, asks an LLM to play an oral examiner and return ONE short
// spoken follow-up. This is the piece that makes Viva an agent rather
// than a transcriber.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set. Run: vercel env add ANTHROPIC_API_KEY",
    });
    return;
  }

  const { question, answer, history } = req.body || {};
  if (!answer) {
    res.status(400).json({ error: "Missing 'answer' in request body." });
    return;
  }

  const systemPrompt = `You are an oral examiner ("viva" examiner) testing a student's understanding of a technical topic.

Rules:
- If their answer is vague, incomplete, or wrong, ask ONE short, pointed follow-up question that presses on the specific weak spot. Do not explain the right answer yourself.
- If their answer is solid, briefly acknowledge it in one short clause, then ask ONE new short question that moves to a related but different concept.
- Never ask more than one question at a time.
- Keep it under 25 words — this gets read aloud, not displayed as text.
- Respond with ONLY the exact words you'd say out loud. No labels, no quotes, no markdown.`;

  const priorTurns = (history || [])
    .map((h) => `Q: ${h.question}\nA: ${h.answer}`)
    .join("\n\n");
  const currentTurn = `Q: ${question}\nA: ${answer}`;
  const transcript = priorTurns
    ? `${priorTurns}\n\n${currentTurn}`
    : currentTurn;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here is the viva so far:\n\n${transcript}\n\nGive your next spoken response now.`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: text });
      return;
    }

    const data = await upstream.json();
    const nextQuestion =
      data.content?.[0]?.text?.trim() || "Can you tell me more about that?";
    res.status(200).json({ nextQuestion });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
