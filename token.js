// api/token.js
//
// Runs on Vercel as a serverless function at /api/token.
// The browser calls this instead of ever seeing your real AssemblyAI API key.
// It mints a short-lived streaming token (valid 60s to *open* the socket;
// the session itself can then run for hours) and hands that back.
//
// Docs: https://www.assemblyai.com/docs/api-reference/streaming-api/generate-streaming-token

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "ASSEMBLYAI_API_KEY is not set. Add it in your .env file locally, " +
        "and in Vercel → Project Settings → Environment Variables for deploys.",
    });
    return;
  }

  try {
    const url =
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60";

    const upstream = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: text });
      return;
    }

    const data = await upstream.json(); // { token, expires_in_seconds }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
