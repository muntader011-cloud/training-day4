import pg from "pg";

// Render's external PostgreSQL endpoint requires SSL.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function getAllCustomers() {
  const { rows } = await pool.query("SELECT id, name, email FROM customers ORDER BY id");
  return rows;
}

export async function getCustomerById(id) {
  const { rows } = await pool.query("SELECT id, name, email FROM customers WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function searchCustomersByName(name) {
  const { rows } = await pool.query(
    "SELECT id, name, email FROM customers WHERE name ILIKE $1 ORDER BY id",
    [`%${name}%`]
  );
  return rows;
}

export async function createCustomer({ name, email }) {
  const { rows } = await pool.query(
    "INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING id, name, email",
    [name, email]
  );
  return rows[0];
}

export async function updateCustomer(id, { name, email }) {
  const { rows } = await pool.query(
    `UPDATE customers
        SET name = COALESCE($2, name), email = COALESCE($3, email)
      WHERE id = $1
  RETURNING id, name, email`,
    [id, name ?? null, email ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(id) {
  const { rows } = await pool.query("DELETE FROM customers WHERE id = $1 RETURNING id, name, email", [id]);
  return rows[0] ?? null;
}
