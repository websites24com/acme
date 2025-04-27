import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';
import { v4 as uuidv4 } from 'uuid';

const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
});

async function seedUsers() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const id = user.id || uuidv4();
      await db.query(
        `INSERT IGNORE INTO users (id, name, email, password) VALUES (?, ?, ?, ?)`,
        [id, user.name, user.email, hashedPassword]
      );
    }),
  );

  return insertedUsers;
}

async function seedInvoices() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id CHAR(36) PRIMARY KEY,
      customer_id CHAR(36) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `);

  const insertedInvoices = await Promise.all(
    invoices.map(async (invoice) => {
      // const id = invoice.id || uuidv4(); // ❌ Commented out - caused error
      const id = uuidv4(); // ✅ Corrected line - always create a new ID
      await db.query(
        `INSERT IGNORE INTO invoices (id, customer_id, amount, status, date) VALUES (?, ?, ?, ?, ?)`,
        [id, invoice.customer_id, invoice.amount, invoice.status, invoice.date]
      );
    }),
  );

  return insertedInvoices;
}

async function seedCustomers() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `);

  const insertedCustomers = await Promise.all(
    customers.map(async (customer) => {
      const id = customer.id || uuidv4();
      await db.query(
        `INSERT IGNORE INTO customers (id, name, email, image_url) VALUES (?, ?, ?, ?)`,
        [id, customer.name, customer.email, customer.image_url]
      );
    }),
  );

  return insertedCustomers;
}

async function seedRevenue() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `);

  const insertedRevenue = await Promise.all(
    revenue.map(async (rev) => {
      await db.query(
        `INSERT IGNORE INTO revenue (month, revenue) VALUES (?, ?)`,
        [rev.month, rev.revenue]
      );
    }),
  );

  return insertedRevenue;
}

export async function GET() {
  try {
    await seedUsers();
    await seedCustomers();
    await seedInvoices();
    await seedRevenue();

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
