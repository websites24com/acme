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

// Connect to MySQL using connection pool
const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
});

// --- 1. Fetch all revenue rows
export async function fetchRevenue() {
  try {
    const [rows] = await db.query<Revenue[]>('SELECT * FROM revenue');
    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

// --- 2. Fetch 5 most recent invoices
export async function fetchLatestInvoices() {
  try {
    const [rows] = await db.query<LatestInvoiceRaw[]>(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `);

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

// --- 3. Fetch dashboard stats: # of invoices/customers, totals
export async function fetchCardData() {
  try {
    const [invoiceCountRows] = await db.query<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM invoices'
    );

    const [customerCountRows] = await db.query<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM customers'
    );

    const [invoiceStatusRows] = await db.query<{ paid: number; pending: number }[]>(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
      FROM invoices
    `);

    return {
      numberOfCustomers: customerCountRows[0]?.count ?? 0,
      numberOfInvoices: invoiceCountRows[0]?.count ?? 0,
      totalPaidInvoices: formatCurrency(invoiceStatusRows[0]?.paid ?? 0),
      totalPendingInvoices: formatCurrency(invoiceStatusRows[0]?.pending ?? 0),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

// --- 4. Pagination logic
const ITEMS_PER_PAGE = 6;

// --- 5. Fetch invoices with search and pagination
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const [rows] = await db.query<InvoicesTable[]>(
      `
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
      `,
      [
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ITEMS_PER_PAGE,
        offset,
      ]
    );

    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

// --- 6. Count pages for search results
export async function fetchInvoicesPages(query: string) {
  try {
    const [rows] = await db.query<{ count: number }[]>(
      `
      SELECT COUNT(*) AS count
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        LOWER(customers.name) LIKE LOWER(?) OR
        LOWER(customers.email) LIKE LOWER(?) OR
        CAST(invoices.amount AS CHAR) LIKE ? OR
        CAST(invoices.date AS CHAR) LIKE ? OR
        LOWER(invoices.status) LIKE LOWER(?)
      `,
      [
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
      ]
    );

    const totalPages = Math.ceil((rows[0]?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

// --- 7. Fetch invoice by ID (used for editing)
export async function fetchInvoiceById(id: string) {
  try {
    const [rows] = await db.query<InvoiceForm[]>(
      `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ?
      `,
      [id]
    );

    const invoice = rows.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));
    console.log('Invoice is empty', invoice); // Invoice is an empty array []
    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

// --- 8. Fetch all customers (minimal data)
export async function fetchCustomers() {
  try {
    const [rows] = await db.query<CustomerField[]>(
      `
      SELECT id, name
      FROM customers
      ORDER BY name ASC
      `
    );

    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all customers.');
  }
}

// --- 9. Fetch filtered customers (with stats)
export async function fetchFilteredCustomers(query: string) {
  try {
    const [rows] = await db.query<CustomersTableType[]>(
      `
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
      `,
      [`%${query}%`, `%${query}%`]
    );

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
