/**
 * Verifica el pago de Mercado Pago por collection_id y devuelve el estado final.
 * Env var requerida: MP_ACCESS_TOKEN
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { collectionId, preferenceId, planId, expectedAmount } = req.body || {};
  if (!collectionId || !planId || expectedAmount == null) {
    return res.status(400).json({ error: "collectionId, planId y expectedAmount son requeridos" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN no está configurado" });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${collectionId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.message || JSON.stringify(data);
      console.error("[mercadopago-verify] error:", errorMsg);
      return res.status(response.status).json({ error: errorMsg });
    }

    if (data.status !== "approved") {
      return res.status(400).json({ error: `Pago no aprobado: ${data.status}`, collectionStatus: data.status });
    }

    if (Number(data.transaction_amount) !== Number(expectedAmount)) {
      return res.status(400).json({ error: "El monto pagado no coincide con el monto esperado." });
    }

    if (preferenceId && data.preference_id !== preferenceId) {
      console.warn("[mercadopago-verify] preference_id mismatch", preferenceId, data.preference_id);
    }

    return res.status(200).json({
      approved: true,
      collectionId: data.id,
      status: data.status,
      preferenceId: data.preference_id,
      paymentType: data.payment_type_id,
      transactionAmount: data.transaction_amount,
      currency: data.currency_id,
      payerEmail: data.payer?.email || null,
    });
  } catch (err) {
    console.error("[mercadopago-verify] catch:", err);
    return res.status(500).json({ error: err.message });
  }
}
