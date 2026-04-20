import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  generatePayrollReport,
  getActiveEmployeeCount,
  getInactiveEmployeeCount,
  getJuniorEmployeeCount,
  getSeniorEmployeeCount,
  getLeadEmployeeCount,
  transferEmployee,
  calculateBonus,
  getDepartmentSummary,
  resetData,
} from "./refactor_optimization";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const seedEmployees = [
  {
    id: 1,
    firstName: "Alice",
    lastName: "Smith",
    active: true,
    level: "senior",
    departmentId: 10,
    salary: 90000,
    yearsOfService: 8,
    rating: 4.7,
  },
  {
    id: 2,
    firstName: "Bob",
    lastName: "Jones",
    active: true,
    level: "junior",
    departmentId: 20,
    salary: 50000,
    yearsOfService: 1,
    rating: 3.8,
  },
  {
    id: 3,
    firstName: "Carol",
    lastName: "White",
    active: false,
    level: "lead",
    departmentId: 10,
    salary: 110000,
    yearsOfService: 12,
    rating: 4.0,
  },
  {
    id: 4,
    firstName: "Dan",
    lastName: "Brown",
    active: true,
    level: "lead",
    departmentId: 20,
    salary: 100000,
    yearsOfService: 6,
    rating: 2.8,
  },
  {
    id: 5,
    firstName: "Eve",
    lastName: "Green",
    active: true,
    level: "director",
    departmentId: 10,
    salary: 150000,
    yearsOfService: 15,
    rating: 1.5,
  },
];

const seedDepartments = [
  { id: 10, name: "Engineering" },
  { id: 20, name: "Marketing" },
];

// Timesheets for month "1" / year "2024"
// Each entry represents one work day
const seedTimesheets = [
  // Alice: 2 days × 10 hours each → hoursWorked=20, overtimeHours=4
  { employeeId: 1, month: "1", year: "2024", hours: 10 },
  { employeeId: 1, month: "1", year: "2024", hours: 10 },
  // Bob: 1 day × 8 hours → hoursWorked=8, overtimeHours=0
  { employeeId: 2, month: "1", year: "2024", hours: 8 },
  // Dan: 1 day × 9 hours → hoursWorked=9, overtimeHours=1
  { employeeId: 4, month: "1", year: "2024", hours: 9 },
  // Eve: 1 day × 8 hours → hoursWorked=8, overtimeHours=0
  { employeeId: 5, month: "1", year: "2024", hours: 8 },
];

// ---------------------------------------------------------------------------
// App factory — creates a fresh Express app wired to individual handlers
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.get("/payroll", generatePayrollReport);
  app.get("/employees/active", getActiveEmployeeCount);
  app.get("/employees/inactive", getInactiveEmployeeCount);
  app.get("/employees/junior", getJuniorEmployeeCount);
  app.get("/employees/senior", getSeniorEmployeeCount);
  app.get("/employees/lead", getLeadEmployeeCount);
  app.post("/employees/transfer", transferEmployee);
  app.post("/employees/bonus", calculateBonus);
  app.get("/departments/summary", getDepartmentSummary);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("refactor_optimization handlers", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    resetData(seedEmployees, seedDepartments, seedTimesheets);
  });

  // -------------------------------------------------------------------------
  // generatePayrollReport
  // -------------------------------------------------------------------------
  describe("generatePayrollReport", () => {
    it("returns only active employees", async () => {
      const res = await request(app).get("/payroll?month=1&year=2024");
      expect(res.status).toBe(200);
      const ids = res.body.employees.map((e: { employeeId: number }) => e.employeeId);
      // Carol (id=3) is inactive and must be absent
      expect(ids).not.toContain(3);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(4);
      expect(ids).toContain(5);
    });

    it("includes correct period string", async () => {
      const res = await request(app).get("/payroll?month=3&year=2025");
      expect(res.body.period).toBe("3/2025");
    });

    it("calculates basePay using PAY_RATES lookup", async () => {
      // Alice is senior (rate=60), 20 hours → basePay = 20 * 60 = 1200
      const res = await request(app).get("/payroll?month=1&year=2024");
      const alice = res.body.employees.find((e: { employeeId: number }) => e.employeeId === 1);
      expect(alice.basePay).toBe(1200);
    });

    it("calculates overtime pay correctly", async () => {
      // Alice: 20 hrs total, 4 OT hrs, hourlyRate=60 → overtimePay = 4 * 1.5 * 60 = 360
      const res = await request(app).get("/payroll?month=1&year=2024");
      const alice = res.body.employees.find((e: { employeeId: number }) => e.employeeId === 1);
      expect(alice.overtimeHours).toBe(4);
      expect(alice.overtimePay).toBe(360);
    });

    it("applies tax brackets to grossPay", async () => {
      // Alice: grossPay = 1200 + 360 = 1560 → bracket > 0, rate = 0.15 → tax = 234
      const res = await request(app).get("/payroll?month=1&year=2024");
      const alice = res.body.employees.find((e: { employeeId: number }) => e.employeeId === 1);
      expect(alice.grossPay).toBe(1560);
      expect(alice.tax).toBe(234);
      expect(alice.netPay).toBe(1326);
    });

    it("resolves department name for each entry", async () => {
      const res = await request(app).get("/payroll?month=1&year=2024");
      const alice = res.body.employees.find((e: { employeeId: number }) => e.employeeId === 1);
      expect(alice.department).toBe("Engineering");
      const bob = res.body.employees.find((e: { employeeId: number }) => e.employeeId === 2);
      expect(bob.department).toBe("Marketing");
    });

    it("provides correct summary totals", async () => {
      const res = await request(app).get("/payroll?month=1&year=2024");
      const { summary } = res.body;
      expect(summary.totalEmployees).toBe(4); // Alice, Bob, Dan, Eve
      expect(typeof summary.totalPayout).toBe("number");
      expect(typeof summary.totalTax).toBe("number");
      expect(typeof summary.totalOvertimeHours).toBe("number");
    });

    it("returns empty report when no timesheets match the period", async () => {
      const res = await request(app).get("/payroll?month=12&year=2099");
      expect(res.body.employees).toHaveLength(4); // active employees still appear, with 0 pay
      expect(res.body.summary.totalPayout).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Employee count handlers
  // -------------------------------------------------------------------------
  describe("getActiveEmployeeCount", () => {
    it("counts only active employees", async () => {
      const res = await request(app).get("/employees/active");
      expect(res.status).toBe(200);
      // 4 active: Alice, Bob, Dan, Eve
      expect(res.body.activeEmployees).toBe(4);
    });
  });

  describe("getInactiveEmployeeCount", () => {
    it("counts only inactive employees", async () => {
      const res = await request(app).get("/employees/inactive");
      expect(res.status).toBe(200);
      // 1 inactive: Carol
      expect(res.body.inactiveEmployees).toBe(1);
    });
  });

  describe("getJuniorEmployeeCount", () => {
    it("counts active junior employees", async () => {
      const res = await request(app).get("/employees/junior");
      expect(res.status).toBe(200);
      // 1: Bob
      expect(res.body.juniorEmployees).toBe(1);
    });
  });

  describe("getSeniorEmployeeCount", () => {
    it("counts active senior employees", async () => {
      const res = await request(app).get("/employees/senior");
      expect(res.status).toBe(200);
      // 1: Alice
      expect(res.body.seniorEmployees).toBe(1);
    });
  });

  describe("getLeadEmployeeCount", () => {
    it("counts only active lead employees (not inactive ones)", async () => {
      const res = await request(app).get("/employees/lead");
      expect(res.status).toBe(200);
      // Dan is active lead; Carol is inactive lead → count = 1
      expect(res.body.leadEmployees).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // transferEmployee
  // -------------------------------------------------------------------------
  describe("transferEmployee", () => {
    it("transfers an active employee to a new department", async () => {
      // Bob (id=2) is in dept 20, move him to dept 10
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 2, departmentId: 10 });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Employee transferred to Engineering");
    });

    it("returns 400 when employeeId is missing", async () => {
      const res = await request(app)
        .post("/employees/transfer")
        .send({ departmentId: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Employee ID is required");
    });

    it("returns 400 when departmentId is missing", async () => {
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Department ID is required");
    });

    it("returns 404 when employee does not exist", async () => {
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 999, departmentId: 10 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Employee not found");
    });

    it("returns 400 when employee is inactive", async () => {
      // Carol (id=3) is inactive
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 3, departmentId: 20 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot transfer inactive employee");
    });

    it("returns 404 when target department does not exist", async () => {
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 1, departmentId: 999 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Department not found");
    });

    it("returns 400 when employee is already in the target department", async () => {
      // Alice (id=1) is already in dept 10
      const res = await request(app)
        .post("/employees/transfer")
        .send({ employeeId: 1, departmentId: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Employee already in that department");
    });
  });

  // -------------------------------------------------------------------------
  // calculateBonus
  // -------------------------------------------------------------------------
  describe("calculateBonus", () => {
    it("returns 404 for unknown employee", async () => {
      const res = await request(app).post("/employees/bonus").send({ employeeId: 999 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Employee not found");
    });

    it("applies service tier rate to salary", async () => {
      // Alice: yearsOfService=8 → tier > 5 → rate=0.10 → base=90000*0.10=9000
      // rating=4.7 ≥ 4.5 → multiplier=1.5 → 9000*1.5=13500
      // level=senior → +1500 → 15000
      const res = await request(app).post("/employees/bonus").send({ employeeId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.bonus).toBe(15000);
      expect(res.body.name).toBe("Alice Smith");
    });

    it("applies low-rating multiplier (< 2.0)", async () => {
      // Eve: yearsOfService=15 → rate=0.15 → base=150000*0.15=22500
      // rating=1.5 < 2.0 → multiplier=0.5 → 22500*0.5=11250
      // level=director → +5000 → 16250
      const res = await request(app).post("/employees/bonus").send({ employeeId: 5 });
      expect(res.status).toBe(200);
      expect(res.body.bonus).toBe(16250);
    });

    it("applies no rating multiplier when rating is between 2.0 and 3.5", async () => {
      // Dan: yearsOfService=6 → rate=0.10 → base=100000*0.10=10000
      // rating=2.8 (not < 2, not >= 3.5) → multiplier=1.0 → 10000
      // level=lead → +3000 → 13000
      const res = await request(app).post("/employees/bonus").send({ employeeId: 4 });
      expect(res.status).toBe(200);
      expect(res.body.bonus).toBe(13000);
    });

    it("applies 1.2× multiplier for rating between 3.5 and 4.5", async () => {
      // Bob: yearsOfService=1 → rate=0.02 → base=50000*0.02=1000
      // rating=3.8 ≥ 3.5 → multiplier=1.2 → 1200
      // level=junior → +0 → 1200
      const res = await request(app).post("/employees/bonus").send({ employeeId: 2 });
      expect(res.status).toBe(200);
      expect(res.body.bonus).toBe(1200);
    });
  });

  // -------------------------------------------------------------------------
  // getDepartmentSummary
  // -------------------------------------------------------------------------
  describe("getDepartmentSummary", () => {
    it("returns a summary for every department", async () => {
      const res = await request(app).get("/departments/summary");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("includes correct department names and ids", async () => {
      const res = await request(app).get("/departments/summary");
      const engineering = res.body.find((d: { id: number }) => d.id === 10);
      const marketing = res.body.find((d: { id: number }) => d.id === 20);
      expect(engineering.name).toBe("Engineering");
      expect(marketing.name).toBe("Marketing");
    });

    it("counts only active employees per department", async () => {
      const res = await request(app).get("/departments/summary");
      const engineering = res.body.find((d: { id: number }) => d.id === 10);
      // Alice (active) + Eve (active) in Engineering; Carol is inactive → count = 2
      expect(engineering.employeeCount).toBe(2);
    });

    it("calculates average salary from active employees only", async () => {
      const res = await request(app).get("/departments/summary");
      const engineering = res.body.find((d: { id: number }) => d.id === 10);
      // (90000 + 150000) / 2 = 120000
      expect(engineering.averageSalary).toBe(120000);
    });

    it("returns averageSalary of 0 for a department with no active employees", async () => {
      resetData(
        [{ id: 99, firstName: "X", lastName: "Y", active: false, level: "junior", departmentId: 10, salary: 50000, yearsOfService: 1, rating: 3.0 }],
        [{ id: 10, name: "Engineering" }],
        []
      );
      const res = await request(app).get("/departments/summary");
      expect(res.body[0].averageSalary).toBe(0);
    });
  });
});
