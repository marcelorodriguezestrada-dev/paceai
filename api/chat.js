/**
 * PaceAI — Backend serverless para Grok (x.ai)
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

  // ── DEBUG: verificar que la key existe
  const keyExists = !!process.env.XAI_API_KEY;
  const keyPrefix = process.env.XAI_API_KEY?.slice(0, 8) || "MISSING";
  console.log(`[chat] key exists: ${keyExists}, prefix: ${keyPrefix}`);

  try {
    const body = {
      model: "grok-3-mini",
      max_tokens,
      messages: system
        ? [{ role: "system", content: system }, ...messages]
        : messages,
    };

    console.log(`[chat] calling xAI, messages count: ${body.messages.length}`);

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // ── DEBUG: loguear respuesta completa de xAI
    console.log(`[chat] xAI status: ${response.status}`);
    console.log(`[chat] xAI response: ${JSON.stringify(data)}`);

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || JSON.stringify(data);
      console.error(`[chat] xAI error: ${errMsg}`);
      return res.status(500).json({ error: errMsg });
    }

    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    console.error(`[chat] catch error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}