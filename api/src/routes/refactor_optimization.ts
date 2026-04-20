// ============================================================================
// refactor_optimization.ts
// This file contains working but poorly written code for demo purposes.
// ============================================================================
import { Request, Response } from "express";

var employees: any[] = [];
var departments: any[] = [];
var timesheets: any[] = [];

// --------------------------------------------------------------------------
// SMELL 1: God function — does way too many things in one place
// Calculates payroll, applies taxes, generates report, and sends response
// all in a single 80-line function with deeply nested logic.
// --------------------------------------------------------------------------
export function generatePayrollReport(req: Request, res: Response) {
  var month = req.query.month;
  var year = req.query.year;
  var report: any[] = [];
  var totalPayout = 0;
  var totalTax = 0;
  var totalOvertime = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].active == true) {
      var emp = employees[i];
      var hoursWorked = 0;
      var overtimeHours = 0;
      for (var j = 0; j < timesheets.length; j++) {
        if (timesheets[j].employeeId == emp.id) {
          if (timesheets[j].month == month && timesheets[j].year == year) {
            hoursWorked = hoursWorked + timesheets[j].hours;
            if (timesheets[j].hours > 8) {
              overtimeHours = overtimeHours + (timesheets[j].hours - 8);
            }
          }
        }
      }
      var basePay = 0;
      if (emp.level == "junior") {
        basePay = hoursWorked * 25;
      } else if (emp.level == "mid") {
        basePay = hoursWorked * 40;
      } else if (emp.level == "senior") {
        basePay = hoursWorked * 60;
      } else if (emp.level == "lead") {
        basePay = hoursWorked * 80;
      } else if (emp.level == "director") {
        basePay = hoursWorked * 100;
      } else {
        basePay = hoursWorked * 20;
      }
      var overtimePay = overtimeHours * 1.5 * (basePay / hoursWorked || 0);
      var grossPay = basePay + overtimePay;
      var tax = 0;
      if (grossPay > 10000) {
        tax = grossPay * 0.35;
      } else if (grossPay > 7000) {
        tax = grossPay * 0.30;
      } else if (grossPay > 4000) {
        tax = grossPay * 0.25;
      } else if (grossPay > 2000) {
        tax = grossPay * 0.20;
      } else {
        tax = grossPay * 0.15;
      }
      var netPay = grossPay - tax;
      var deptName = "";
      for (var k = 0; k < departments.length; k++) {
        if (departments[k].id == emp.departmentId) {
          deptName = departments[k].name;
        }
      }
      totalPayout = totalPayout + netPay;
      totalTax = totalTax + tax;
      totalOvertime = totalOvertime + overtimeHours;
      report.push({
        employeeId: emp.id,
        name: emp.firstName + " " + emp.lastName,
        department: deptName,
        level: emp.level,
        hoursWorked: hoursWorked,
        overtimeHours: overtimeHours,
        basePay: Math.round(basePay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        netPay: Math.round(netPay * 100) / 100,
      });
    }
  }
  res.json({
    period: month + "/" + year,
    employees: report,
    summary: {
      totalEmployees: report.length,
      totalPayout: Math.round(totalPayout * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalOvertimeHours: totalOvertime,
    },
  });
}

// --------------------------------------------------------------------------
// SMELL 2: Massive repetition / copy-paste code
// Each stat function repeats nearly identical filtering and aggregation
// logic with only minor differences.
// --------------------------------------------------------------------------
export function getActiveEmployeeCount(req: Request, res: Response) {
  var count = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].active == true) {
      count = count + 1;
    }
  }
  res.json({ activeEmployees: count });
}

export function getInactiveEmployeeCount(req: Request, res: Response) {
  var count = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].active == false) {
      count = count + 1;
    }
  }
  res.json({ inactiveEmployees: count });
}

export function getJuniorEmployeeCount(req: Request, res: Response) {
  var count = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].level == "junior" && employees[i].active == true) {
      count = count + 1;
    }
  }
  res.json({ juniorEmployees: count });
}

export function getSeniorEmployeeCount(req: Request, res: Response) {
  var count = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].level == "senior" && employees[i].active == true) {
      count = count + 1;
    }
  }
  res.json({ seniorEmployees: count });
}

export function getLeadEmployeeCount(req: Request, res: Response) {
  var count = 0;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].level == "lead" && employees[i].active == true) {
      count = count + 1;
    }
  }
  res.json({ leadEmployees: count });
}

// --------------------------------------------------------------------------
// SMELL 3: Deeply nested conditionals / arrow code
// The transfer logic is buried under 6 levels of nesting, making it
// nearly impossible to read or maintain.
// --------------------------------------------------------------------------
export function transferEmployee(req: Request, res: Response) {
  var employeeId = req.body.employeeId;
  var newDeptId = req.body.departmentId;
  if (employeeId != null && employeeId != undefined) {
    if (newDeptId != null && newDeptId != undefined) {
      var employee = null;
      for (var i = 0; i < employees.length; i++) {
        if (employees[i].id == employeeId) {
          employee = employees[i];
        }
      }
      if (employee != null) {
        if (employee.active == true) {
          var dept = null;
          for (var j = 0; j < departments.length; j++) {
            if (departments[j].id == newDeptId) {
              dept = departments[j];
            }
          }
          if (dept != null) {
            if (dept.id != employee.departmentId) {
              employee.departmentId = dept.id;
              res.json({ message: "Employee transferred to " + dept.name });
            } else {
              res.status(400).json({ error: "Employee already in that department" });
            }
          } else {
            res.status(404).json({ error: "Department not found" });
          }
        } else {
          res.status(400).json({ error: "Cannot transfer inactive employee" });
        }
      } else {
        res.status(404).json({ error: "Employee not found" });
      }
    } else {
      res.status(400).json({ error: "Department ID is required" });
    }
  } else {
    res.status(400).json({ error: "Employee ID is required" });
  }
}

// --------------------------------------------------------------------------
// SMELL 4: Magic numbers everywhere
// Hardcoded numeric values with no explanation of what they represent.
// --------------------------------------------------------------------------
export function calculateBonus(req: Request, res: Response) {
  var employeeId = req.body.employeeId;
  var employee = null;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].id == employeeId) {
      employee = employees[i];
    }
  }
  if (employee == null) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  var bonus = 0;
  if (employee.yearsOfService > 10) {
    bonus = employee.salary * 0.15;
  } else if (employee.yearsOfService > 5) {
    bonus = employee.salary * 0.10;
  } else if (employee.yearsOfService > 2) {
    bonus = employee.salary * 0.05;
  } else {
    bonus = employee.salary * 0.02;
  }

  if (employee.rating >= 4.5) {
    bonus = bonus * 1.5;
  } else if (employee.rating >= 3.5) {
    bonus = bonus * 1.2;
  } else if (employee.rating < 2.0) {
    bonus = bonus * 0.5;
  }

  if (employee.level == "director") {
    bonus = bonus + 5000;
  } else if (employee.level == "lead") {
    bonus = bonus + 3000;
  } else if (employee.level == "senior") {
    bonus = bonus + 1500;
  }

  res.json({
    employeeId: employee.id,
    name: employee.firstName + " " + employee.lastName,
    bonus: Math.round(bonus * 100) / 100,
  });
}

// --------------------------------------------------------------------------
// SMELL 5: No types, no interfaces, callback-style everything
// Everything is `any`, variable names are unclear, and the entire
// data transformation pipeline is written imperatively with manual loops
// instead of functional array methods.
// --------------------------------------------------------------------------
export function getDepartmentSummary(req: Request, res: Response) {
  var d: any[] = [];
  for (var i = 0; i < departments.length; i++) {
    var x: any = {};
    x.n = departments[i].name;
    x.id = departments[i].id;
    x.c = 0;
    x.s = 0;
    x.a = 0;
    for (var j = 0; j < employees.length; j++) {
      if (employees[j].departmentId == departments[i].id && employees[j].active == true) {
        x.c = x.c + 1;
        x.s = x.s + employees[j].salary;
      }
    }
    if (x.c > 0) {
      x.a = x.s / x.c;
    }
    x.a = Math.round(x.a * 100) / 100;
    d.push(x);
  }
  res.json(d);
}
