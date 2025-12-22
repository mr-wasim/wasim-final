import { getDb } from "../../../lib/api-helpers";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
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

    const query = ObjectId.isValid(callId) ? { _id: new ObjectId(callId) } : { _id: callId };

    const call = await db.collection("forwarded_calls").findOne(query);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    let paymentStatus = "Pending";
    if (call.paymentStatus === "Paid") paymentStatus = "Paid";

    return res.json({
      success: true,
      callId,
      paymentStatus,
    });
  } catch (err) {
    console.error("check-payment error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
