import { requireRole, getDb } from "../../../lib/api-helpers.js";

function normalize(str = "") {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false });
  }

  try {
    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const paymentsColl = db.collection("payments");

    // 🔹 1. ALL CALLS (LIFETIME)
    const calls = await callsColl.find({}).toArray();

    // 🔹 2. ALL PAYMENTS (LIFETIME)
    const payments = await paymentsColl.find({}).toArray();

    // 🔹 3. BUILD PAYMENT MATCH SET
    const paidSet = new Set();

    for (const p of payments) {
      if (!Array.isArray(p.calls)) continue;

      for (const c of p.calls) {
        const key = [
          normalize(c.clientName),
          normalize(c.phone),
          normalize(c.address),
        ].join("|");

        paidSet.add(key);
      }
    }

    // 🔹 4. FINAL CUSTOMER LIST
    const result = calls.map((c) => {
      const key = [
        normalize(c.clientName),
        normalize(c.phone),
        normalize(c.address),
      ].join("|");

      const isPaid = paidSet.has(key);

      return {
        callId: String(c._id),
        clientName: c.clientName || "",
        phone: c.phone || "",
        address: c.address || "",
        price: c.price || 0,
        status: isPaid ? "Paid" : "Pending",
        createdAt: c.createdAt || "",
      };
    });

    return res.json({
      success: true,
      totalCustomers: result.length,
      paidCount: result.filter((r) => r.status === "Paid").length,
      pendingCount: result.filter((r) => r.status === "Pending").length,
      items: result,
    });
  } catch (err) {
    console.error("admin customer payments error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
}

export default requireRole("admin")(handler);
