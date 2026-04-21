// ============================================================================
// refactor_optimization.ts
// Refactored for clarity, maintainability, and type safety.
// ============================================================================
import { Request, Response } from "express";

// ----------------------------------------------------------------------------
// Interfaces
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
  activeEmployeeCount: number;
  totalSalary: number;
  averageSalary: number;
}

let employees: Employee[] = [];
let departments: Department[] = [];
let timesheets: Timesheet[] = [];

// ----------------------------------------------------------------------------
// Constants — SMELL 4 fix: named constants replace magic numbers
// ----------------------------------------------------------------------------

// Hourly rates by level
const HOURLY_RATE: Record<string, number> = {
  junior: 25,
  mid: 40,
  senior: 60,
  lead: 80,
  director: 100,
  default: 20,
};

// Overtime multiplier (time-and-a-half)
const OVERTIME_MULTIPLIER = 1.5;
// Daily hours threshold after which overtime begins
const OVERTIME_DAILY_THRESHOLD = 8;

// Tax brackets: [minimumGross, rate]
const TAX_BRACKETS: Array<{ threshold: number; rate: number }> = [
  { threshold: 10000, rate: 0.35 },
  { threshold: 7000,  rate: 0.30 },
  { threshold: 4000,  rate: 0.25 },
  { threshold: 2000,  rate: 0.20 },
  { threshold: 0,     rate: 0.15 },
];

// Tenure-based bonus rates as a fraction of salary
const TENURE_BONUS_RATES: Array<{ minYears: number; rate: number }> = [
  { minYears: 10, rate: 0.15 },
  { minYears: 5,  rate: 0.10 },
  { minYears: 2,  rate: 0.05 },
  { minYears: 0,  rate: 0.02 },
];

// Performance rating multipliers
const RATING_EXCELLENT_THRESHOLD = 4.5;
const RATING_GOOD_THRESHOLD = 3.5;
const RATING_POOR_THRESHOLD = 2.0;
const RATING_EXCELLENT_MULTIPLIER = 1.5;
const RATING_GOOD_MULTIPLIER = 1.2;
const RATING_POOR_MULTIPLIER = 0.5;

// Level-based bonus stipends
const LEVEL_BONUS_STIPEND: Record<string, number> = {
  director: 5000,
  lead: 3000,
  senior: 1500,
};

// ----------------------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getHourlyRate(level: string): number {
  return HOURLY_RATE[level] ?? HOURLY_RATE.default;
}

function getEmployeeHours(
  employeeId: number,
  month: string | string[],
  year: string | string[]
): { hoursWorked: number; overtimeHours: number } {
  let hoursWorked = 0;
  let overtimeHours = 0;
  for (const sheet of timesheets) {
    if (sheet.employeeId === employeeId && sheet.month == month && sheet.year == year) {
      hoursWorked += sheet.hours;
      if (sheet.hours > OVERTIME_DAILY_THRESHOLD) {
        overtimeHours += sheet.hours - OVERTIME_DAILY_THRESHOLD;
      }
    }
  }
  return { hoursWorked, overtimeHours };
}

function calculateBasePay(level: string, hoursWorked: number): number {
  return hoursWorked * getHourlyRate(level);
}

function calculateTax(grossPay: number): number {
  const bracket = TAX_BRACKETS.find((b) => grossPay > b.threshold)!;
  return grossPay * bracket.rate;
}

function getDepartmentName(departmentId: number): string {
  return departments.find((d) => d.id === departmentId)?.name ?? "";
}

function buildPayrollEntry(emp: Employee, month: string | string[], year: string | string[]): PayrollEntry {
  const { hoursWorked, overtimeHours } = getEmployeeHours(emp.id, month, year);
  const hourlyRate = getHourlyRate(emp.level);
  const basePay = calculateBasePay(emp.level, hoursWorked);
  const overtimePay = overtimeHours * OVERTIME_MULTIPLIER * hourlyRate;
  const grossPay = basePay + overtimePay;
  const tax = calculateTax(grossPay);
  const netPay = grossPay - tax;

  return {
    employeeId: emp.id,
    name: `${emp.firstName} ${emp.lastName}`,
    department: getDepartmentName(emp.departmentId),
    level: emp.level,
    hoursWorked,
    overtimeHours,
    basePay: round2(basePay),
    overtimePay: round2(overtimePay),
    grossPay: round2(grossPay),
    tax: round2(tax),
    netPay: round2(netPay),
  };
}

function countEmployees(predicate: (emp: Employee) => boolean): number {
  return employees.filter(predicate).length;
}

// ----------------------------------------------------------------------------
// SMELL 1 (fixed): God function split into focused helpers above.
// generatePayrollReport is now a thin orchestrator.
// ----------------------------------------------------------------------------
export function generatePayrollReport(req: Request, res: Response) {
  const { month, year } = req.query as { month: string; year: string };

  const report = employees
    .filter((emp) => emp.active)
    .map((emp) => buildPayrollEntry(emp, month, year));

  const totalPayout = report.reduce((sum, e) => sum + e.netPay, 0);
  const totalTax = report.reduce((sum, e) => sum + e.tax, 0);
  const totalOvertimeHours = report.reduce((sum, e) => sum + e.overtimeHours, 0);

  res.json({
    period: `${month}/${year}`,
    employees: report,
    summary: {
      totalEmployees: report.length,
      totalPayout: round2(totalPayout),
      totalTax: round2(totalTax),
      totalOvertimeHours,
    },
  });
}

// ----------------------------------------------------------------------------
// SMELL 2 (fixed): Shared countEmployees helper eliminates repetition.
// ----------------------------------------------------------------------------
export function getActiveEmployeeCount(_req: Request, res: Response) {
  res.json({ activeEmployees: countEmployees((emp) => emp.active) });
}

export function getInactiveEmployeeCount(_req: Request, res: Response) {
  res.json({ inactiveEmployees: countEmployees((emp) => !emp.active) });
}

export function getJuniorEmployeeCount(_req: Request, res: Response) {
  res.json({ juniorEmployees: countEmployees((emp) => emp.active && emp.level === "junior") });
}

export function getSeniorEmployeeCount(_req: Request, res: Response) {
  res.json({ seniorEmployees: countEmployees((emp) => emp.active && emp.level === "senior") });
}

export function getLeadEmployeeCount(_req: Request, res: Response) {
  res.json({ leadEmployees: countEmployees((emp) => emp.active && emp.level === "lead") });
}

// ----------------------------------------------------------------------------
// SMELL 3 (fixed): Early returns replace deeply nested conditionals.
// ----------------------------------------------------------------------------
export function transferEmployee(req: Request, res: Response) {
  const { employeeId, departmentId: newDeptId } = req.body;

  if (employeeId == null) {
    res.status(400).json({ error: "Employee ID is required" });
    return;
  }
  if (newDeptId == null) {
    res.status(400).json({ error: "Department ID is required" });
    return;
  }

  const employee = employees.find((e) => e.id == employeeId);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  if (!employee.active) {
    res.status(400).json({ error: "Cannot transfer inactive employee" });
    return;
  }

  const dept = departments.find((d) => d.id == newDeptId);
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
// SMELL 4 (fixed): Named constants replace all magic numbers above.
// ----------------------------------------------------------------------------
export function calculateBonus(req: Request, res: Response) {
  const { employeeId } = req.body;
  const employee = employees.find((e) => e.id == employeeId);

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const tenureTier =
    TENURE_BONUS_RATES.find((t) => employee.yearsOfService > t.minYears) ??
    TENURE_BONUS_RATES[TENURE_BONUS_RATES.length - 1];
  let bonus = employee.salary * tenureTier.rate;

  if (employee.rating >= RATING_EXCELLENT_THRESHOLD) {
    bonus *= RATING_EXCELLENT_MULTIPLIER;
  } else if (employee.rating >= RATING_GOOD_THRESHOLD) {
    bonus *= RATING_GOOD_MULTIPLIER;
  } else if (employee.rating < RATING_POOR_THRESHOLD) {
    bonus *= RATING_POOR_MULTIPLIER;
  }

  bonus += LEVEL_BONUS_STIPEND[employee.level] ?? 0;

  res.json({
    employeeId: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    bonus: round2(bonus),
  });
}

// ----------------------------------------------------------------------------
// SMELL 5 (fixed): Typed interface, descriptive names, functional array methods.
// ----------------------------------------------------------------------------
export function getDepartmentSummary(_req: Request, res: Response) {
  const summaries: DepartmentSummary[] = departments.map((dept) => {
    const activeEmployees = employees.filter(
      (emp) => emp.departmentId === dept.id && emp.active
    );
    const totalSalary = activeEmployees.reduce((sum, emp) => sum + emp.salary, 0);
    const averageSalary = activeEmployees.length > 0
      ? round2(totalSalary / activeEmployees.length)
      : 0;

    return {
      id: dept.id,
      name: dept.name,
      activeEmployeeCount: activeEmployees.length,
      totalSalary,
      averageSalary,
    };
  });

  res.json(summaries);
}
