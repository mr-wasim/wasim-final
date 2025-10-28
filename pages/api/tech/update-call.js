
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req,res,user){
  if(req.method!=='POST') return res.status(405).end();
  const { id, status } = req.body||{};
  const db = await getDb();
  await db.collection('forwarded_calls').updateOne({ _id: new ObjectId(id), techId: { $in:[user.id, new ObjectId(user.id)] } }, { $set: { status } });
  res.json({ ok:true });
}
export default requireRole('technician')(handler);
