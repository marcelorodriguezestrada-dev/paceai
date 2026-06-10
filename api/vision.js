/**
 * PaceAI — Backend para análisis de imágenes con Grok Vision
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

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-2-vision-1212",
        max_tokens: 1000,
        messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const result = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content: [{ type: "text", text: result }] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
