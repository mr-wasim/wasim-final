import { getDb } from "../../../lib/api-helpers";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({
        success: false,
        message: "callId missing",
      });
    }

    const db = await getDb();

    const updateResult = await db.collection("forwarded_calls").updateOne(
      { _id: new ObjectId(callId) },
      { $set: { paymentStatus: "Paid" } }
    );

    return res.json({
      success: true,
      updated: updateResult.modifiedCount ? true : false,
    });

  } catch (err) {
    console.error("Payment Status Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
