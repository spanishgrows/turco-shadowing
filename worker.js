// Cloudflare Worker para Gölge: genera frases A2 de turco con Workers AI (plan gratuito).
// Requiere un binding de Workers AI llamado "AI" (Settings → Bindings → Add → Workers AI).
const ALLOWED = ["https://spanishgrows.github.io", "http://localhost:8766"];
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    title_es: { type: "string" },
    sentences: { type: "array", items: { type: "array", items: { type: "string" } } }
  },
  required: ["title", "title_es", "sentences"]
};

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

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (req.method !== "POST") return json({ error: "Usa POST" }, 405, origin);
    if (!ALLOWED.includes(origin)) return json({ error: "Origen no permitido" }, 403, origin);

    let topic = "";
    try { topic = String((await req.json()).topic || "").trim().slice(0, 80); } catch (e) {}
    if (!topic) return json({ error: "Falta el tema" }, 400, origin);

    const messages = [
      { role: "system", content:
        "You are an expert teacher of Turkish as a foreign language. You write perfectly correct, natural Turkish " +
        "with all special letters (ç ğ ı İ ö ş ü) and natural Latin American Spanish translations. You answer only with JSON." },
      { role: "user", content:
        `Create 8 natural, everyday Turkish sentences at CEFR A2 level about this topic: "${topic}". ` +
        "Use simple A2 grammar (present continuous, aorist, past -di, future -ecek, -ebil, imperative, yes/no questions with mi). " +
        "4 to 10 words per sentence. Useful for real life in Turkey, varied (questions and answers). " +
        "Translate each sentence into natural Latin American Spanish. Also give a short Turkish title (1-3 words) and its Spanish translation. " +
        'Format: {"title":"...","title_es":"...","sentences":[["turkish sentence","spanish translation"], ...]}' }
    ];

    try {
      const out = await env.AI.run(MODEL, {
        messages, max_tokens: 1200, temperature: 0.6,
        response_format: { type: "json_schema", json_schema: SCHEMA }
      });
      let data = out.response;
      if (typeof data === "string") data = JSON.parse(data.match(/\{[\s\S]*\}/)[0]);
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
