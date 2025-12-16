import { ObjectId } from "mongodb";
import { requireRole, getDb } from "../../../../lib/api-helpers";

export default async function handler(req, res) {
  try {
    // ✅ Only ADMIN allowed
    const user = await requireRole(req, res, ["admin"]);
    if (!user) return;

    const {
      query: { id },
      method,
    } = req;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid payment id" });
    }

    const db = await getDb();
    const paymentsCol = db.collection("payments");

    if (method === "DELETE") {
      // 🔍 Check payment exists
      const payment = await paymentsCol.findOne({ _id: new ObjectId(id) });

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // ❌ Delete payment
      await paymentsCol.deleteOne({ _id: new ObjectId(id) });

      return res.status(200).json({
        success: true,
        message: "Payment deleted successfully",
      });
    }

    // ❌ Method not allowed
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: `Method ${method} not allowed` });

  } catch (err) {
    console.error("DELETE PAYMENT ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
