import mysql from 'mysql2/promise';

// Create a database pool using your environment variable
const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function GET() {
  try {
    // Simple query to check if DB is alive
    const [rows] = await db.query('SELECT 1');

    return Response.json({
      status: 'success',
      message: 'Database connection successful!',
      data: rows,
      your_project: 'https://acme-sooty-eight.vercel.app/',
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    return Response.json(
      { 
        status: 'error', 
        message: (error as Error).message,
        your_project: 'https://acme-sooty-eight.vercel.app/',
      },
      { status: 500 }
    );
  }
}
