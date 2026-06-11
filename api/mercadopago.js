/**
 * Mercado Pago Checkout Pro create preference.
 * Env var required: MP_ACCESS_TOKEN
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, planName, price, email } = req.body || {};

  if (!planId || !planName || price == null) {
    return res.status(400).json({ error: "planId, planName y price son requeridos" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN no está configurado" });
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const body = {
    items: [
      {
        title: `Plan ${planName}`,
        description: `Suscripción ${planName} en PaceAI`,
        quantity: 1,
        unit_price: Number(price),
        currency_id: "ARS",
      },
    ],
    payer: {
      email: email || "usuario@mercadopago.test",
    },
    back_urls: {
      success: `${origin}/?payment=success&plan=${encodeURIComponent(planId)}`,
      failure: `${origin}/?payment=failure&plan=${encodeURIComponent(planId)}`,
      pending: `${origin}/?payment=pending&plan=${encodeURIComponent(planId)}`,
    },
    auto_return: "approved",
    metadata: {
      planId,
      planName,
      userEmail: email || "guest",
    },
  };

  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.message || JSON.stringify(data);
      console.error("[mercadopago] create preference error:", errorMsg);
      return res.status(response.status).json({ error: errorMsg });
    }
    return res.status(200).json({ init_point: data.init_point, sandbox_init_point: data.sandbox_init_point, preference_id: data.id });
  } catch (err) {
    console.error("[mercadopago] catch:", err);
    return res.status(500).json({ error: err.message });
  }
}
