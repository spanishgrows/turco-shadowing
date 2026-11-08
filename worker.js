// Cloudflare Worker para Gölge: genera frases A2 de turco con Workers AI (plan gratuito).
// Requiere un binding de Workers AI llamado "AI".
const ALLOWED = ["https://spanishgrows.github.io", "http://localhost:8766"];
const MODELS = {
  llama: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  gemma: "@cf/google/gemma-3-12b-it",
  qwen: "@cf/qwen/qwen3-30b-a3b-fp8",
  scout: "@cf/meta/llama-4-scout-17b-16e-instruct",
  mistral: "@cf/mistralai/mistral-small-3.1-24b-instruct"
};
const DEFAULT = "llama";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
const json = (data, status, origin) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } });

const SYSTEM =
  "You are a native Turkish speaker and an expert teacher of Turkish as a foreign language (CEFR A2). " +
  "You write only grammatically perfect, natural, idiomatic Turkish that a native speaker would really say, with correct spelling " +
  "and all special letters (ç ğ ı İ ö ş ü). You translate into natural Latin American Spanish. You answer only with JSON.";

function userPrompt(topic) {
  return `Topic: "${topic}".\n` +
    "Write 8 useful sentences that a foreign resident in Turkey would really say or hear in this situation.\n" +
    "Rules:\n" +
    "- CEFR A2: everyday vocabulary; present continuous (-iyor), aorist, past (-di), future (-ecek), can (-ebil), imperative/polite requests (-ebilir misiniz), questions with mi.\n" +
    "- Complete sentences of 5 to 10 words, mostly first person (ben/biz) and dialogue lines (questions and answers).\n" +
    "- Avoid the passive voice and rare words. No numbering.\n" +
    "- Translate each sentence into natural Latin American Spanish.\n" +
    "- Give a short Turkish title (1-3 words) and its Spanish translation.\n" +
    'Example for the topic "en la panadería": {"title":"Fırında","title_es":"En la panadería","sentences":[' +
    '["İki ekmek alabilir miyim, lütfen?","¿Me da dos panes, por favor?"],' +
    '["Simitler taze mi?","¿Los simits están frescos?"],' +
    '["Evet, bu sabah pişirdik.","Sí, los horneamos esta mañana."]]}\n' +
    "Reply ONLY with the JSON object, with exactly 8 sentences.";
}

function extract(out) {
  let data = out && (out.response ?? out.result?.response ?? out.choices?.[0]?.message?.content ?? out);
  if (typeof data === "string") {
    data = data.replace(/<think>[\s\S]*?<\/think>/g, "");
    data = JSON.parse(data.match(/\{[\s\S]*\}/)[0]);
  }
  return data;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (req.method !== "POST") return json({ error: "Usa POST" }, 405, origin);
    if (!ALLOWED.includes(origin)) return json({ error: "Origen no permitido" }, 403, origin);

    let body = {};
    try { body = await req.json(); } catch (e) {}
    const topic = String(body.topic || "").trim().slice(0, 80);
    if (!topic) return json({ error: "Falta el tema" }, 400, origin);
    const model = MODELS[body.model] || MODELS[DEFAULT];

    try {
      const out = await env.AI.run(model, {
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt(topic) }],
        max_tokens: 1500, temperature: 0.4
      });
      const data = extract(out);
      const sentences = (data.sentences || [])
        .filter(s => Array.isArray(s) && s[0])
        .map(([tr, es]) => [String(tr).trim(), String(es || "").trim()])
        .slice(0, 10);
      if (sentences.length < 3) throw new Error("pocas frases");
      return json({ title: data.title || topic, title_es: data.title_es || topic, sentences }, 200, origin);
    } catch (e) {
      return json({ error: "No se pudieron generar las frases: " + (e.message || e) }, 502, origin);
    }
  }
};
