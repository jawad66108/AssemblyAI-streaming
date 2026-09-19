// api/next-question.js
//
// Given the current question, the student's spoken answer, and the prior
// history, asks an LLM to play an oral examiner and return ONE short
// spoken follow-up. Uses Groq's free API (OpenAI-compatible format).

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
- Output EXACTLY ONE sentence, ending in a single question mark. Never output multiple phrasings, alternates, or repeated versions of the same question back to back.
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
          max_tokens: 300,
          reasoning_effort: "low",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Here is the viva so far:\n\n${transcript}\n\nGive your next spoken response now.`,
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
    let nextQuestion =
      data.choices?.[0]?.message?.content?.trim() ||
      "Can you tell me more about that?";

    // Safety net: even with the prompt above, the model occasionally runs
    // multiple phrasings together with no separator. Keep only the first
    // complete sentence so a garbled combo never reaches the student.
    const firstSentence = nextQuestion.match(/^[^?!.]*[?!.]/);
    if (firstSentence) {
      nextQuestion = firstSentence[0].trim();
    }
    res.status(200).json({ nextQuestion });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
