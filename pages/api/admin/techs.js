
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  const db = await getDb();
  const items = await db.collection('technicians').find().sort({createdAt:-1}).toArray();
  res.json({ items: items.map(x=>({ ...x, _id: x._id.toString() })) });
}
export default requireRole('admin')(handler);
