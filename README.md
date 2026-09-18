# Viva — Day 1: streaming STT proof

This proves the core pipeline works before anything else gets built:
**mic → minted token → AssemblyAI streaming WebSocket → live transcript.**
No agent logic yet — that starts Day 3 (turn-controller) per the build plan.

## 1. Get an AssemblyAI API key
Sign up at https://www.assemblyai.com/dashboard — free trial credit is enough
for this stage.

## 2. Set up your local environment
```bash
cp .env.example .env
# then edit .env and paste your real key in place of "your_key_here"
```

## 3. Install the Vercel CLI (if you don't have it)
```bash
npm i -g vercel
```

## 4. Run it locally
```bash
vercel dev
```
Open the URL it prints (usually http://localhost:3000). Click **Start**,
allow microphone access, and talk. You should see:
- a grey italic line updating live as you speak (partial transcript)
- a black line appearing each time you pause (final transcript, one per turn)

## 5. Deploy it (so you have a public URL for later submission)
```bash
vercel --prod
```
Then in the Vercel dashboard → your project → **Settings → Environment
Variables**, add `ASSEMBLYAI_API_KEY` with your real key (the `.env` file is
only for local dev — it's never uploaded). Redeploy once the env var is set.

## What's deliberately missing right now
- No conversation logic — it just transcribes. The turn-controller
  (deciding when you've *finished* an answer, and reacting to it) is Day 3.
- No LLM call yet — that's `/api/next-question`, Day 3–4.
- No text-to-speech reply — Day 4.
- Uses the deprecated `ScriptProcessorNode` for audio capture because it's
  the fastest path to a working demo in one file. Swap for an
  `AudioWorkletNode` later if you want to clean it up — not worth the time
  this week.

## Troubleshooting
- **"ASSEMBLYAI_API_KEY is not set" error**: `vercel dev` reads `.env`
  automatically — make sure the file is named exactly `.env` and sits next
  to `package.json`.
- **No transcript appears**: open the browser console — the `log` div at
  the bottom of the page also mirrors session events and errors.
- **Mic permission denied**: `getUserMedia` requires `localhost` or HTTPS —
  both `vercel dev` and a Vercel deploy satisfy this automatically.
