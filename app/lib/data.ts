import mysql from 'mysql2/promise';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
});

export async function fetchRevenue() {
  try {
    const [rows] = await db.query('SELECT * FROM revenue') as unknown as [Revenue[], any];
    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const [rows] = await db.query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `) as unknown as [LatestInvoiceRaw[], any];

    const latestInvoices = rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const [invoiceCountRows] = await db.query('SELECT COUNT(*) AS count FROM invoices') as unknown as [{ count: number }[], any];
    const [customerCountRows] = await db.query('SELECT COUNT(*) AS count FROM customers') as unknown as [{ count: number }[], any];
    const [invoiceStatusRows] = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
      FROM invoices
    `) as unknown as [{ paid: number; pending: number }[], any];

    return {
      numberOfCustomers: Number(customerCountRows[0]?.count ?? 0),
      numberOfInvoices: Number(invoiceCountRows[0]?.count ?? 0),
      totalPaidInvoices: formatCurrency(invoiceStatusRows[0]?.paid ?? 0),
      totalPendingInvoices: formatCurrency(invoiceStatusRows[0]?.pending ?? 0),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const [rows] = await db.query(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        LOWER(customers.name) LIKE LOWER(?) OR
        LOWER(customers.email) LIKE LOWER(?) OR
        CAST(invoices.amount AS CHAR) LIKE ? OR
        CAST(invoices.date AS CHAR) LIKE ? OR
        LOWER(invoices.status) LIKE LOWER(?)
      ORDER BY invoices.date DESC
      LIMIT ? OFFSET ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, ITEMS_PER_PAGE, offset]) as unknown as [InvoicesTable[], any];

    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS count
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        LOWER(customers.name) LIKE LOWER(?) OR
        LOWER(customers.email) LIKE LOWER(?) OR
        CAST(invoices.amount AS CHAR) LIKE ? OR
        CAST(invoices.date AS CHAR) LIKE ? OR
        LOWER(invoices.status) LIKE LOWER(?)
    `, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]) as unknown as [{ count: number }[], any];

    const totalPages = Math.ceil((rows[0]?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const [rows] = await db.query(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ?
    `, [id]) as unknown as [InvoiceForm[], any];

    const invoice = rows.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `) as unknown as [CustomerField[], any];

    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const [rows] = await db.query(`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        LOWER(customers.name) LIKE LOWER(?) OR
        LOWER(customers.email) LIKE LOWER(?)
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `, [`%${query}%`, `%${query}%`]) as unknown as [CustomersTableType[], any];

    const customers = rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer table.');
  }
}
