/** Live check of voice notes: OpenAI text-to-speech → the app's transcribeAudio(), en + pt-BR. */
import { transcribeAudio } from '../src/agent/transcribe';
const key = process.env.OPENAI_API_KEY ?? '';
const model = process.argv[2] ?? 'gpt-4o-mini-transcribe';
for (const said of ['For lunch I had 200 grams of grilled chicken and a cup of rice.', 'No almoço comi duas conchas de feijão e um bife grelhado.']) {
  const tts = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', input: said, response_format: 'mp3' }),
  });
  if (!tts.ok) { console.log('TTS failed', tts.status, await tts.text()); continue; }
  const blob = new Blob([await tts.arrayBuffer()], { type: 'audio/mpeg' });
  const t0 = Date.now();
  const text = await transcribeAudio(blob, { provider: 'openai', apiKey: key, model });
  console.log(`said:  ${said}\nheard: ${text}  (${model}, ${((Date.now() - t0) / 1000).toFixed(1)} s, ${Math.round(blob.size / 1024)} KB)\n`);
}
