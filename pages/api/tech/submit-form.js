
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  if(req.method!=='POST') return res.status(405).end();
  const { clientName, address, payment=0, phone, status, signature } = req.body||{};
  const db = await getDb();
  await db.collection('service_forms').insertOne({
    techId: user.id, techUsername: user.username, clientName, address, payment:Number(payment)||0, phone, status, signature, createdAt: new Date()
  });
  res.json({ ok:true });
}
export default requireRole('technician')(handler);
