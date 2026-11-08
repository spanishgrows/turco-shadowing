// Cloudflare Worker para Gölge: genera frases de turco (A1-C1) con Workers AI (plan gratuito).
// Requiere un binding de Workers AI llamado "AI".
const ALLOWED = ["https://spanishgrows.github.io", "http://localhost:8766"];
const MODELS = { llama: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", gptoss: "@cf/openai/gpt-oss-120b" };
const DEFAULT = "gptoss";

// Llama usa "messages"; GPT-OSS usa el formato Responses (instructions + input).
async function ask(env, model, sys, user, temperature) {
  if (model.includes("gpt-oss")) return env.AI.run(model, { instructions: sys, input: user, reasoning: { effort: "low" } });
  return env.AI.run(model, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 2000, temperature });
}

const LEVELS = {
  A1: { words: "4 to 9", grammar: "very basic everyday vocabulary; present continuous (-iyor), var/yok, simple questions with mi/ne/nerede/kaç, numbers, polite set phrases (lütfen, teşekkürler)" },
  A2: { words: "5 to 15", grammar: "everyday vocabulary; present continuous, aorist, past (-di), future (-ecek), ability (-ebil), polite requests (-ebilir misiniz), questions with mi, simple connectors (ve, ama, çünkü)" },
  B1: { words: "7 to 18", grammar: "broader vocabulary; reported past (-miş), past continuous (-iyordu), conditionals (-se), necessity (-meli, gerek), relative clauses (-en, -dik), reasons (-diği için), opinions and short explanations" },
  B2: { words: "9 to 22", grammar: "rich vocabulary; complex subordination (-dikten sonra, -ince, -erek, -ken), reported speech (-diğini söyledi), passive and causative where natural, hypotheticals (-seydi), nuanced opinions and arguments" },
  C1: { words: "10 to 25", grammar: "advanced and precise vocabulary, idioms and fixed expressions (deyimler), register nuances (formal/informal), advanced subordination and nominalisations, natural native-like style" }
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

function system(level) {
  return `You are a native Turkish speaker and an expert teacher of Turkish as a foreign language (CEFR ${level}). ` +
    "You write only grammatically perfect, natural, idiomatic Turkish that a native speaker would really say, with correct spelling " +
    "and all special letters (ç ğ ı İ ö ş ü). You translate into natural Latin American Spanish. You answer only with JSON.";
}

function userPrompt(topic, level) {
  const L = LEVELS[level];
  return `Topic: "${topic}". Level: CEFR ${level}.\n` +
    "Write 8 useful sentences that a foreign resident in Turkey would really say or hear in this situation.\n" +
    "Rules:\n" +
    `- Level ${level}: ${L.grammar}.\n` +
    `- Complete sentences of ${L.words} words, mostly first person (ben/biz) and dialogue lines (questions and answers).\n` +
    "- The complexity must clearly match the level. Avoid the passive voice unless the level needs it. No numbering.\n" +
    "- Translate each sentence into natural Latin American Spanish.\n" +
    "- Give a short Turkish title (1-3 words) and its Spanish translation.\n" +
    'Example of the format: {"title":"Fırında","title_es":"En la panadería","sentences":[' +
    '["İki ekmek alabilir miyim, lütfen?","¿Me da dos panes, por favor?"],' +
    '["Simitler taze mi, bu sabah mı pişirdiniz?","¿Los simits están frescos, los hornearon esta mañana?"]]}\n' +
    "Reply ONLY with the JSON object, with exactly 8 sentences.";
}

function reviewPrompt(level, draft) {
  return `You are a meticulous native Turkish editor and CEFR examiner. Review this draft of 8 Turkish sentences for level ${level}.\n` +
    "For EACH sentence:\n" +
    "- Fix every grammar, suffix, vowel harmony, word order and spelling error (all special letters: ç ğ ı İ ö ş ü).\n" +
    "- Replace any word that is not Turkish (English, Portuguese, Spanish…) with the correct Turkish word.\n" +
    "- Make it sound natural, like a native speaker in Turkey would really say it; fix person/tense agreement.\n" +
    `- Make sure the complexity really matches ${level}: ${LEVELS[level].grammar}; length ${LEVELS[level].words} words.\n` +
    "- Correct the Spanish translation so it matches the final Turkish sentence exactly (natural Latin American Spanish).\n" +
    "Also fix the title if it is not natural Turkish.\n" +
    "Return ONLY the corrected JSON object with the same structure and exactly 8 sentences.\n\n" +
    "Draft:\n" + JSON.stringify(draft);
}

function clean(data) {
  return (data.sentences || [])
    .filter(s => Array.isArray(s) && s[0])
    .map(([tr, es]) => [String(tr).trim(), String(es || "").trim()])
    .slice(0, 10);
}

function extract(out) {
  let data = out && (out.response ?? out.result?.response);
  if (data == null && Array.isArray(out?.output)) {
    const msg = out.output.filter(o => o.type === "message").pop();
    data = msg?.content?.map(c => c.text || "").join("") ?? "";
  }
  if (data == null) data = out;
  if (typeof data === "string") data = JSON.parse(data.match(/\{[\s\S]*\}/)[0]);
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
    const level = LEVELS[body.level] ? body.level : "A2";
    if (!topic) return json({ error: "Falta el tema" }, 400, origin);

    const model = MODELS[body.model] || MODELS[DEFAULT];
    try {
      // Primera pasada (con un reintento si la respuesta no es válida)
      let data = null, lastErr = null;
      for (let i = 0; i < 2 && !data; i++) {
        try {
          const d = extract(await ask(env, model, system(level), userPrompt(topic, level), 0.4));
          if (clean(d).length >= 3) data = d;
        } catch (e) { lastErr = e; }
      }
      if (!data) throw lastErr || new Error("pocas frases");
      // Segunda pasada: la IA revisa y corrige su propio borrador. Si falla, se usa el borrador.
      let reviewed = false;
      if (body.review !== false) {
        try {
          const draft = { title: data.title, title_es: data.title_es, sentences: clean(data) };
          const rev = extract(await ask(env, model, system(level), reviewPrompt(level, draft), 0.1));
          if (clean(rev).length >= 6) { data = rev; reviewed = true; }
        } catch (e) {}
      }
      const sentences = clean(data);
      return json({ title: data.title || topic, title_es: data.title_es || topic, level, reviewed, sentences }, 200, origin);
    } catch (e) {
      return json({ error: "No se pudieron generar las frases: " + (e.message || e) }, 502, origin);
    }
  }
};
