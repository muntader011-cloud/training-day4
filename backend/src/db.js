import pg from "pg";

// Render's external PostgreSQL endpoint requires SSL.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const USER_COLUMNS = "id, name, email, role";
const CUSTOMER_COLUMNS = "id, name, email, sales_user_id";

// ---- Users ----

export async function createUser({ name, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
    [name, email, passwordHash]
  );
  return rows[0];
}

// Includes password_hash: only for verifying a login, never return it to a client.
export async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function getUserById(id) {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// ---- Customers ----
// Every function is scoped to the owning sales user, so callers cannot reach other users' customers.

export async function getAllCustomers(userId) {
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE sales_user_id = $1 ORDER BY id`,
    [userId]
  );
  return rows;
}

export async function getCustomerById(userId, id) {
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $2 AND sales_user_id = $1`,
    [userId, id]
  );
  return rows[0] ?? null;
}

export async function searchCustomersByName(userId, name) {
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE sales_user_id = $1 AND name ILIKE $2 ORDER BY id`,
    [userId, `%${name}%`]
  );
  return rows;
}

export async function createCustomer(userId, { name, email }) {
  const { rows } = await pool.query(
    `INSERT INTO customers (name, email, sales_user_id) VALUES ($1, $2, $3) RETURNING ${CUSTOMER_COLUMNS}`,
    [name, email, userId]
  );
  return rows[0];
}

export async function updateCustomer(userId, id, { name, email }) {
  const { rows } = await pool.query(
    `UPDATE customers
        SET name = COALESCE($3, name), email = COALESCE($4, email)
      WHERE id = $2 AND sales_user_id = $1
  RETURNING ${CUSTOMER_COLUMNS}`,
    [userId, id, name ?? null, email ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(userId, id) {
  const { rows } = await pool.query(
    `DELETE FROM customers WHERE id = $2 AND sales_user_id = $1 RETURNING ${CUSTOMER_COLUMNS}`,
    [userId, id]
  );
  return rows[0] ?? null;
}
