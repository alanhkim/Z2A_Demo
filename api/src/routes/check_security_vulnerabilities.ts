// ============================================================================
// check_security_vulnerabilities.ts
// This file contains intentional security vulnerabilities for demo purposes.
// ============================================================================
import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { exec } from "child_process";

// --------------------------------------------------------------------------
// VULNERABILITY 1: SQL Injection
// User input is directly interpolated into a query string with no
// parameterization or sanitization.
// --------------------------------------------------------------------------
export function searchProducts(req: Request, res: Response) {
  var keyword = req.query.keyword;
  var query = "SELECT * FROM products WHERE name LIKE '%" + keyword + "%'";
  // db.execute(query) would run the unsanitized query
  res.json({ query: query });
}

// --------------------------------------------------------------------------
// VULNERABILITY 2: Cross-Site Scripting (XSS)
// User-supplied HTML is rendered directly into the response without encoding.
// --------------------------------------------------------------------------
export function renderGreeting(req: Request, res: Response) {
  var username = req.query.name;
  res.send("<html><body><h1>Welcome, " + username + "!</h1></body></html>");
}

// --------------------------------------------------------------------------
// VULNERABILITY 3: Command Injection
// User input is passed directly into a shell command.
// --------------------------------------------------------------------------
export function pingHost(req: Request, res: Response) {
  var host = req.query.host as string;
  exec("ping -c 4 " + host, (error, stdout, stderr) => {
    res.json({ output: stdout, error: stderr });
  });
}

// --------------------------------------------------------------------------
// VULNERABILITY 4: Path Traversal
// User-controlled file path with no validation allows reading arbitrary files
// from the server filesystem.
// --------------------------------------------------------------------------
export function getDocument(req: Request, res: Response) {
  var filename = req.params.filename;
  var filepath = "./uploads/" + filename;
  var content = fs.readFileSync(filepath, "utf-8");
  res.send(content);
}

// --------------------------------------------------------------------------
// VULNERABILITY 5: Hardcoded Secrets
// API keys and credentials are embedded directly in source code.
// --------------------------------------------------------------------------
var API_KEY = "sk-live-4f3c2b1a0987654321abcdef00000000";
var DB_PASSWORD = "SuperSecret123!";
var JWT_SECRET = "my-jwt-secret-key-do-not-share";

export function getConfig(req: Request, res: Response) {
  res.json({
    apiKey: API_KEY,
    dbPassword: DB_PASSWORD,
    jwtSecret: JWT_SECRET,
  });
}

// --------------------------------------------------------------------------
// VULNERABILITY 6: Insecure Deserialization
// Blindly parsing and evaluating user-supplied JSON without validation.
// --------------------------------------------------------------------------
export function importData(req: Request, res: Response) {
  var rawData = req.body.data;
  var parsed = eval("(" + rawData + ")");
  res.json({ imported: parsed });
}

// --------------------------------------------------------------------------
// VULNERABILITY 7: Missing Authentication & Authorization
// Sensitive admin actions have no auth checks whatsoever.
// --------------------------------------------------------------------------
export function deleteAllUsers(req: Request, res: Response) {
  // No authentication check — anyone can call this!
  // db.execute("DELETE FROM users");
  res.json({ message: "All users deleted" });
}

export function getAdminDashboard(req: Request, res: Response) {
  // No role verification — any user can access admin data
  res.json({
    totalRevenue: 1250000,
    userCredentials: [
      { email: "admin@corp.com", password: "admin123" },
      { email: "cfo@corp.com", password: "finance456" },
    ],
  });
}

// --------------------------------------------------------------------------
// VULNERABILITY 8: Insecure HTTP Headers / CORS Misconfiguration
// Wildcard CORS and missing security headers expose the application.
// --------------------------------------------------------------------------
export function insecureCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // Missing: X-Content-Type-Options, X-Frame-Options, Content-Security-Policy,
  //          Strict-Transport-Security, etc.
  next();
}

// --------------------------------------------------------------------------
// VULNERABILITY 9: Insufficient Logging & Error Leakage
// Full stack traces and internal details are sent to the client.
// --------------------------------------------------------------------------
export function riskyOperation(req: Request, res: Response) {
  try {
    var data = JSON.parse(req.body.payload);
    // ... process data ...
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,          // leaks internal paths and code structure
      env: process.env,            // leaks all environment variables!
    });
  }
}

// --------------------------------------------------------------------------
// VULNERABILITY 10: Denial of Service via Regex (ReDoS)
// A catastrophic backtracking regex pattern on user input.
// --------------------------------------------------------------------------
export function validateEmail(req: Request, res: Response) {
  var email = req.body.email as string;
  var emailRegex = /^([a-zA-Z0-9]+\.)*[a-zA-Z0-9]+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
  var isValid = emailRegex.test(email);
  res.json({ email: email, valid: isValid });
}
