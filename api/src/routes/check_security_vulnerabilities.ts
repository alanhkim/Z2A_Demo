// ============================================================================
// check_security_vulnerabilities.ts
// Security vulnerabilities have been remediated in this file.
// ============================================================================
import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";

// --------------------------------------------------------------------------
// FIX 1: SQL Injection
// Use parameterized queries instead of string interpolation so user input
// is never treated as SQL syntax.
// --------------------------------------------------------------------------
export function searchProducts(req: Request, res: Response) {
  const keyword = req.query.keyword as string;
  // Parameterized query: the placeholder $1 is bound separately by the driver,
  // so user input can never alter the query structure.
  const query = "SELECT * FROM products WHERE name LIKE $1";
  const params = [`%${keyword}%`];
  // db.execute(query, params) would safely execute the parameterized query
  res.json({ query: query, params: params });
}

// --------------------------------------------------------------------------
// FIX 2: Cross-Site Scripting (XSS)
// HTML-encode user-supplied values before embedding them in HTML output.
// --------------------------------------------------------------------------
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function renderGreeting(req: Request, res: Response) {
  const username = escapeHtml((req.query.name as string) ?? "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<html><body><h1>Welcome, ${username}!</h1></body></html>`);
}

// --------------------------------------------------------------------------
// FIX 3: Command Injection
// Validate the host against a strict allowlist pattern and use execFile
// (which does not spawn a shell) so arguments cannot contain shell metacharacters.
// --------------------------------------------------------------------------
const SAFE_HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

export function pingHost(req: Request, res: Response) {
  const host = req.query.host as string;
  if (!host || !SAFE_HOST_RE.test(host)) {
    res.status(400).json({ error: "Invalid host" });
    return;
  }
  execFile("ping", ["-c", "4", host], { timeout: 10000 }, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: "Ping failed" });
      return;
    }
    res.json({ output: stdout, error: stderr });
  });
}

// --------------------------------------------------------------------------
// FIX 4: Path Traversal
// Resolve the absolute path and verify it stays inside the uploads directory.
// --------------------------------------------------------------------------
const UPLOADS_DIR = path.resolve("./uploads");

export function getDocument(req: Request, res: Response) {
  const filename = req.params.filename;
  const filepath = path.resolve(UPLOADS_DIR, filename);
  // Ensure the resolved path starts inside the uploads directory.
  if (!filepath.startsWith(UPLOADS_DIR + path.sep)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    // Resolve symlinks so a symlink pointing outside the uploads dir is also rejected.
    const realpath = fs.realpathSync(filepath);
    if (!realpath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const content = fs.readFileSync(realpath, "utf-8");
    res.send(content);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
}

// --------------------------------------------------------------------------
// FIX 5: Hardcoded Secrets
// Load secrets from environment variables; never embed them in source code.
// --------------------------------------------------------------------------
const API_KEY = process.env.API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

export function getConfig(req: Request, res: Response) {
  // Indicate which secrets are configured without revealing their values.
  res.json({
    apiKeyConfigured: !!API_KEY,
    dbPasswordConfigured: !!DB_PASSWORD,
    jwtSecretConfigured: !!JWT_SECRET,
  });
}

// --------------------------------------------------------------------------
// FIX 6: Insecure Deserialization
// Use JSON.parse() instead of eval() so user input is never executed as code.
// --------------------------------------------------------------------------
export function importData(req: Request, res: Response) {
  try {
    const rawData = req.body.data as string;
    const parsed = JSON.parse(rawData);
    res.json({ imported: parsed });
  } catch {
    res.status(400).json({ error: "Invalid JSON data" });
  }
}

// --------------------------------------------------------------------------
// FIX 7: Missing Authentication & Authorization
// Verify a bearer token before allowing access to sensitive admin actions.
// --------------------------------------------------------------------------
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken || !authHeader) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const provided = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${expectedToken}`);
  // Use constant-time comparison to prevent timing-based token enumeration.
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function deleteAllUsers(req: Request, res: Response) {
  requireAdminAuth(req, res, () => {
    // db.execute("DELETE FROM users");
    res.json({ message: "All users deleted" });
  });
}

export function getAdminDashboard(req: Request, res: Response) {
  requireAdminAuth(req, res, () => {
    res.json({ totalRevenue: 1250000 });
  });
}

// --------------------------------------------------------------------------
// FIX 8: Insecure HTTP Headers / CORS Misconfiguration
// Restrict CORS to known origins and add essential security headers.
// --------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "";

export function secureCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

// --------------------------------------------------------------------------
// FIX 9: Insufficient Logging & Error Leakage
// Return a generic error message to the client; log details server-side only.
// --------------------------------------------------------------------------
export function riskyOperation(req: Request, res: Response) {
  try {
    // Parse the payload to validate it is well-formed JSON; processing happens downstream.
    JSON.parse(req.body.payload);
    res.json({ success: true });
  } catch (error: any) {
    // Log the full error server-side for diagnostics, never send it to the client.
    console.error("riskyOperation error:", error);
    res.status(500).json({ error: "An internal server error occurred" });
  }
}

// --------------------------------------------------------------------------
// FIX 10: Denial of Service via Regex (ReDoS)
// Use a linear-time email validation approach without catastrophic backtracking.
// --------------------------------------------------------------------------
export function validateEmail(req: Request, res: Response) {
  const email = req.body.email as string;
  // Simple, linear-time check: one @ with non-empty local and domain parts,
  // domain must contain at least one dot.
  const atIndex = typeof email === "string" ? email.indexOf("@") : -1;
  let isValid = false;
  if (atIndex > 0 && atIndex === email.lastIndexOf("@")) {
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    isValid = local.length > 0 && domain.includes(".") && domain.length > 2;
  }
  res.json({ valid: isValid });
}
