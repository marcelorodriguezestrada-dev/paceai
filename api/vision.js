/**
 * PaceAI — Backend para análisis de imágenes
 * Groq no soporta visión en modelos gratuitos,
 * usamos llama-4-scout-17b-16e-instruct que sí soporta imágenes
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { imageBase64, imageType, text, system } = req.body;

  if (!imageBase64 || !text) {
    return res.status(400).json({ error: "imageBase64 y text requeridos" });
  }

  try {
    const messages = [];

    if (system) {
      messages.push({ role: "system", content: system });
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${imageType || "image/jpeg"};base64,${imageBase64}`,
          },
        },
        { type: "text", text },
      ],
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 1000,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || JSON.stringify(data);
      console.error(`[vision] Groq error: ${errMsg}`);
      return res.status(500).json({ error: errMsg });
    }

    const result = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content: [{ type: "text", text: result }] });

  } catch (err) {
    console.error(`[vision] catch: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
