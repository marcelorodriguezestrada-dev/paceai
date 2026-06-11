/**
 * PaceAI — Backend serverless para Groq
 * Modelo: llama-3.3-70b-versatile (gratis, muy rápido)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { messages, system, max_tokens = 1000 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages requerido" });
  }

  try {
    const body = {
      model: "llama-3.3-70b-versatile",
      max_tokens,
      messages: system
        ? [{ role: "system", content: system }, ...messages]
        : messages,
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || JSON.stringify(data);
      console.error(`[chat] Groq error: ${errMsg}`);
      return res.status(500).json({ error: errMsg });
    }

    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    console.error(`[chat] catch: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
