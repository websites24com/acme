import mysql from 'mysql2/promise';

// Create a connection pool to MySQL
const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
});

// Function to query invoices where amount = 666
async function listInvoices() {
  const [rows] = await db.query(`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `);

  return rows;
}

// API route for GET request
export async function GET() {
  try {
    const invoices = await listInvoices();
    return Response.json(invoices);
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
