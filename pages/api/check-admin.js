import { getDb } from "../../lib/api-helpers";

export default async function handler(req, res) {
  const db = await getDb();

  const listCollections = await db.listCollections().toArray();
  const collectionsData = {};

  for (let col of listCollections) {
    const docs = await db.collection(col.name).find({}).toArray();
    collectionsData[col.name] = docs;
  }

  res.json({
    database: db.databaseName,
    collections: listCollections.map(c => c.name),
    data: collectionsData,
  });
}
