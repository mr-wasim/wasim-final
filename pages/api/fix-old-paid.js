import { getDb } from "../../lib/api-helpers";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const db = await getDb();

    const payments = db.collection("payments");
    const calls = db.collection("forwarded_calls");

    // सभी payments लाओ जिसमें calls array है
    const allPayments = await payments.find({ "calls.callId": { $exists: true } }).toArray();

    let updated = 0;

    for (const p of allPayments) {
      for (const c of p.calls) {
        if (!c.callId) continue;

        const id = ObjectId.isValid(c.callId) ? new ObjectId(c.callId) : c.callId;

        const resUpdate = await calls.updateOne(
          { _id: id },
          { $set: { paymentStatus: "Paid" } }
        );

        if (resUpdate.modifiedCount > 0) updated++;
      }
    }

    return res.json({
      success: true,
      message: "Old paid calls updated",
      updated,
    });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, error: "Error fixing old data" });
  }
}
