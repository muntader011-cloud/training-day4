import { Router } from "express";
import * as db from "../db.js";
import { EMAIL_RE } from "../auth.js";

const router = Router();

function parseId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "id must be a positive integer" });
    return null;
  }
  return id;
}

function validate(body, { partial }) {
  const { name, email } = body ?? {};
  if (!partial && (!name || !email)) return "name and email are required";
  if (name !== undefined && (typeof name !== "string" || !name.trim())) return "name must be a non-empty string";
  if (email !== undefined && (typeof email !== "string" || !EMAIL_RE.test(email))) return "email must be a valid email address";
  if (partial && name === undefined && email === undefined) return "provide name and/or email";
  return null;
}

router.get("/", async (req, res) => {
  const { name } = req.query;
  res.json(name ? await db.searchCustomersByName(req.user.id, String(name)) : await db.getAllCustomers(req.user.id));
});

router.get("/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const customer = await db.getCustomerById(req.user.id, id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(customer);
});

router.post("/", async (req, res) => {
  const error = validate(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const customer = await db.createCustomer(req.user.id, { name: req.body.name.trim(), email: req.body.email.trim() });
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const error = validate(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const customer = await db.updateCustomer(req.user.id, id, {
    name: req.body.name?.trim(),
    email: req.body.email?.trim(),
  });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(customer);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const customer = await db.deleteCustomer(req.user.id, id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json({ message: "Customer deleted", customer });
});

export default router;
