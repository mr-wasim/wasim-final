import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req, res, user) {
  if (req.method !== 'POST') return res.status(405).end();

  // ✅ नए फील्ड्स 'price' और 'type' को भी destructure किया गया
  const { clientName, phone, address, techId, price, type } = req.body || {};

  const db = await getDb();
  const tech = await db.collection('technicians').findOne({ _id: new ObjectId(techId) });
  if (!tech) return res.status(400).json({ error: 'Technician not found' });

  // ✅ नए फील्ड्स insert में भी जोड़ दिए गए हैं
  await db.collection('forwarded_calls').insertOne({
    clientName,
    phone,
    address,
    price,        // नया field
    type,         // नया field
    techId: tech._id,
    techName: tech.username,
    status: 'Pending',
    createdAt: new Date(),
  });

  res.json({ ok: true });
}

export default requireRole('admin')(handler);
