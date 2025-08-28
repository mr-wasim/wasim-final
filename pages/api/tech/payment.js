
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  if(req.method!=='POST') return res.status(405).end();
  const { receiver, mode, onlineAmount=0, cashAmount=0, receiverSignature } = req.body||{};
  const db = await getDb();
  await db.collection('payments').insertOne({
    techId: require('mongodb').ObjectId.isValid(user.id) ? new (require('mongodb').ObjectId)(user.id) : user.id,
    techUsername: user.username,
    receiver, mode, onlineAmount:Number(onlineAmount)||0, cashAmount:Number(cashAmount)||0,
    receiverSignature, createdAt: new Date()
  });
  res.json({ ok:true });
}
export default requireRole('technician')(handler);
