
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req,res,user){
  const { id } = req.query;
  const db = await getDb();
  const t = await db.collection('technicians').findOne({ _id: new ObjectId(id) });
  if(!t) return res.status(404).json({ error:'Not found' });
  res.json({ _id: t._id.toString(), username: t.username, createdAt: t.createdAt });
}
export default requireRole('admin')(handler);
