// ============================================================================
// refactor_optimization.ts
// Refactored to follow clean code principles:
//   - TypeScript interfaces for all domain types
//   - Named constants replacing magic numbers
//   - God function broken into focused helpers
//   - Duplicated count functions consolidated via a shared helper
//   - Deeply nested conditionals replaced with guard clauses
//   - Array methods (.filter, .map, .reduce, .find) used throughout
// ============================================================================
import { Request, Response } from "express";

// ----------------------------------------------------------------------------
// Domain interfaces
// ----------------------------------------------------------------------------
interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  active: boolean;
  level: string;
  departmentId: number;
  salary: number;
  yearsOfService: number;
  rating: number;
}

interface Department {
  id: number;
  name: string;
}

interface Timesheet {
  employeeId: number;
  month: string | number;
  year: string | number;
  hours: number;
}

interface PayrollEntry {
  employeeId: number;
  name: string;
  department: string;
  level: string;
  hoursWorked: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  grossPay: number;
  tax: number;
  netPay: number;
}

interface DepartmentSummary {
  id: number;
  name: string;
  employeeCount: number;
  totalSalary: number;
  averageSalary: number;
}

// ----------------------------------------------------------------------------
// Named constants
// ----------------------------------------------------------------------------
const PAY_RATES: Record<string, number> = {
  junior: 25,
  mid: 40,
  senior: 60,
  lead: 80,
  director: 100,
};
const DEFAULT_PAY_RATE = 20;
const OVERTIME_MULTIPLIER = 1.5;
const DAILY_HOURS_LIMIT = 8;

const TAX_BRACKETS: Array<{ threshold: number; rate: number }> = [
  { threshold: 10000, rate: 0.35 },
  { threshold: 7000, rate: 0.30 },
  { threshold: 4000, rate: 0.25 },
  { threshold: 2000, rate: 0.20 },
  { threshold: 0, rate: 0.15 },
];

const BONUS_SERVICE_TIERS: Array<{ yearsRequired: number; rate: number }> = [
  { yearsRequired: 10, rate: 0.15 },
  { yearsRequired: 5, rate: 0.10 },
  { yearsRequired: 2, rate: 0.05 },
  { yearsRequired: 0, rate: 0.02 },
];
const BONUS_RATING_MULTIPLIERS: Array<{ minRating: number; multiplier: number }> = [
  { minRating: 4.5, multiplier: 1.5 },
  { minRating: 3.5, multiplier: 1.2 },
];
const LOW_RATING_THRESHOLD = 2.0;
const LOW_RATING_MULTIPLIER = 0.5;
const LEVEL_BONUS_ADDITIONS: Record<string, number> = {
  director: 5000,
  lead: 3000,
  senior: 1500,
};

// ----------------------------------------------------------------------------
// In-memory data stores
// ----------------------------------------------------------------------------
let employees: Employee[] = [];
let departments: Department[] = [];
let timesheets: Timesheet[] = [];

// ----------------------------------------------------------------------------
// Helpers — payroll calculation
// ----------------------------------------------------------------------------
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getHourTotals(
  employeeId: number,
  month: string,
  year: string
): { hoursWorked: number; overtimeHours: number } {
  // Use loose equality so numeric month/year values in Timesheet also match string query params.
  const relevant = timesheets.filter(
    // eslint-disable-next-line eqeqeq
    (ts) => ts.employeeId === employeeId && ts.month == month && ts.year == year
  );
  return relevant.reduce(
    (totals, ts) => ({
      hoursWorked: totals.hoursWorked + ts.hours,
      overtimeHours:
        totals.overtimeHours + Math.max(0, ts.hours - DAILY_HOURS_LIMIT),
    }),
    { hoursWorked: 0, overtimeHours: 0 }
  );
}

function calculateBasePay(level: string, hoursWorked: number): number {
  const rate = PAY_RATES[level] ?? DEFAULT_PAY_RATE;
  return hoursWorked * rate;
}

function calculateTax(grossPay: number): number {
  const bracket = TAX_BRACKETS.find((b) => grossPay > b.threshold);
  const rate = bracket ? bracket.rate : TAX_BRACKETS[TAX_BRACKETS.length - 1].rate;
  return grossPay * rate;
}

function findDepartmentName(departmentId: number): string {
  return departments.find((d) => d.id === departmentId)?.name ?? "";
}

function buildPayrollEntry(
  employee: Employee,
  month: string,
  year: string
): PayrollEntry {
  const { hoursWorked, overtimeHours } = getHourTotals(
    employee.id,
    month,
    year
  );
  const basePay = calculateBasePay(employee.level, hoursWorked);
  const hourlyRate = hoursWorked > 0 ? basePay / hoursWorked : 0;
  const overtimePay = overtimeHours * OVERTIME_MULTIPLIER * hourlyRate;
  const grossPay = basePay + overtimePay;
  const tax = calculateTax(grossPay);
  const netPay = grossPay - tax;

  return {
    employeeId: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    department: findDepartmentName(employee.departmentId),
    level: employee.level,
    hoursWorked,
    overtimeHours,
    basePay: round2(basePay),
    overtimePay: round2(overtimePay),
    grossPay: round2(grossPay),
    tax: round2(tax),
    netPay: round2(netPay),
  };
}

// ----------------------------------------------------------------------------
// Route handlers
// ----------------------------------------------------------------------------

export function generatePayrollReport(req: Request, res: Response): void {
  const { month, year } = req.query;

  const report = employees
    .filter((emp) => emp.active)
    .map((emp) => buildPayrollEntry(emp, month as string, year as string));

  const totalPayout = round2(report.reduce((sum, e) => sum + e.netPay, 0));
  const totalTax = round2(report.reduce((sum, e) => sum + e.tax, 0));
  const totalOvertimeHours = report.reduce((sum, e) => sum + e.overtimeHours, 0);

  res.json({
    period: `${month}/${year}`,
    employees: report,
    summary: {
      totalEmployees: report.length,
      totalPayout,
      totalTax,
      totalOvertimeHours,
    },
  });
}

// ----------------------------------------------------------------------------
// Helpers — employee counts
// ----------------------------------------------------------------------------
function countEmployees(predicate: (emp: Employee) => boolean): number {
  return employees.filter(predicate).length;
}

export function getActiveEmployeeCount(_req: Request, res: Response): void {
  res.json({ activeEmployees: countEmployees((emp) => emp.active) });
}

export function getInactiveEmployeeCount(_req: Request, res: Response): void {
  res.json({ inactiveEmployees: countEmployees((emp) => !emp.active) });
}

export function getJuniorEmployeeCount(_req: Request, res: Response): void {
  res.json({
    juniorEmployees: countEmployees((emp) => emp.active && emp.level === "junior"),
  });
}

export function getSeniorEmployeeCount(_req: Request, res: Response): void {
  res.json({
    seniorEmployees: countEmployees((emp) => emp.active && emp.level === "senior"),
  });
}

export function getLeadEmployeeCount(_req: Request, res: Response): void {
  res.json({
    leadEmployees: countEmployees((emp) => emp.active && emp.level === "lead"),
  });
}

// ----------------------------------------------------------------------------
// transferEmployee — guard clauses replace deeply nested conditionals
// ----------------------------------------------------------------------------
export function transferEmployee(req: Request, res: Response): void {
  const employeeId: number | undefined =
    req.body.employeeId != null ? Number(req.body.employeeId) : undefined;
  const newDeptId: number | undefined =
    req.body.departmentId != null ? Number(req.body.departmentId) : undefined;

  if (employeeId == null) {
    res.status(400).json({ error: "Employee ID is required" });
    return;
  }
  if (newDeptId == null) {
    res.status(400).json({ error: "Department ID is required" });
    return;
  }

  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  if (!employee.active) {
    res.status(400).json({ error: "Cannot transfer inactive employee" });
    return;
  }

  const dept = departments.find((d) => d.id === newDeptId);
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  if (dept.id === employee.departmentId) {
    res.status(400).json({ error: "Employee already in that department" });
    return;
  }

  employee.departmentId = dept.id;
  res.json({ message: `Employee transferred to ${dept.name}` });
}

// ----------------------------------------------------------------------------
// calculateBonus — named constants replace magic numbers
// ----------------------------------------------------------------------------
function calculateServiceBonus(employee: Employee): number {
  const tier = BONUS_SERVICE_TIERS.find(
    (t) => employee.yearsOfService > t.yearsRequired
  );
  return employee.salary * (tier ? tier.rate : BONUS_SERVICE_TIERS[BONUS_SERVICE_TIERS.length - 1].rate);
}

function applyRatingMultiplier(bonus: number, rating: number): number {
  const match = BONUS_RATING_MULTIPLIERS.find((r) => rating >= r.minRating);
  if (match) return bonus * match.multiplier;
  if (rating < LOW_RATING_THRESHOLD) return bonus * LOW_RATING_MULTIPLIER;
  return bonus;
}

function applyLevelBonus(bonus: number, level: string): number {
  return bonus + (LEVEL_BONUS_ADDITIONS[level] ?? 0);
}

export function calculateBonus(req: Request, res: Response): void {
  const employeeId = Number(req.body.employeeId);
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  let bonus = calculateServiceBonus(employee);
  bonus = applyRatingMultiplier(bonus, employee.rating);
  bonus = applyLevelBonus(bonus, employee.level);

  res.json({
    employeeId: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    bonus: round2(bonus),
  });
}

// ----------------------------------------------------------------------------
// getDepartmentSummary — typed interfaces and array methods
// ----------------------------------------------------------------------------
export function getDepartmentSummary(_req: Request, res: Response): void {
  const summary: DepartmentSummary[] = departments.map((dept) => {
    const activeInDept = employees.filter(
      (emp) => emp.active && emp.departmentId === dept.id
    );
    const totalSalary = activeInDept.reduce((sum, emp) => sum + emp.salary, 0);
    const employeeCount = activeInDept.length;
    const averageSalary = employeeCount > 0 ? round2(totalSalary / employeeCount) : 0;

    return {
      id: dept.id,
      name: dept.name,
      employeeCount,
      totalSalary,
      averageSalary,
    };
  });

  res.json(summary);
}
