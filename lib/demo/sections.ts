export const DEMO_SECTIONS = {
  dashboard: "Dashboard",
  employees: "Employees",
  departments: "Departments",
  attendance: "Attendance",
  timesheets: "Timesheets",
  payroll: "Payroll",
  invoices: "Invoices",
  clients: "Clients",
  projects: "Projects",
  leave: "Leave Management",
  expenses: "Expenses",
  finance: "Finance",
  announcements: "Announcements",
} as const;

export type DemoSection = keyof typeof DEMO_SECTIONS;

export function isDemoSection(value: string): value is DemoSection {
  return Object.hasOwn(DEMO_SECTIONS, value);
}
