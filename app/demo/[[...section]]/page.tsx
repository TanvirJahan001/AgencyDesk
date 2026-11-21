import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Clock, Coffee, DollarSign, FolderKanban, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import DemoTable from "@/components/demo/DemoTable";
import StatCard from "@/components/ui/StatCard";
import { minutesToReadable } from "@/lib/attendance/utils";
import { readDemoRows, type DemoRow } from "@/lib/demo/queries";
import { DEMO_SECTIONS, isDemoSection, type DemoSection } from "@/lib/demo/sections";
import { calculatePeriodPayroll } from "@/lib/payroll/calculator";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
const money = (amount: number) => currency.format(amount);
const text = (value: string | null | undefined) => value || "—";
const label = (value: string) => value.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

function byNewest<T>(rows: T[], date: (row: T) => string): T[] {
  return [...rows].sort((left, right) => date(right).localeCompare(date(left)));
}

function table<T extends { id: string }>(title: string, columns: string[], rows: T[], cells: (row: T) => string[]) {
  return <DemoTable key={title} title={title} columns={columns} rows={rows.map((row) => ({ id: row.id, cells: cells(row) }))} />;
}

function attendanceTable(rows: DemoRow<"attendance_sessions">[], title = "Team attendance") {
  return table(title, ["Employee", "Date", "Clock in", "Clock out", "Work", "Break", "Status"], rows, (row) => [
    row.userName, row.workDate, dateTime.format(new Date(row.clockInAt)),
    row.clockOutAt ? dateTime.format(new Date(row.clockOutAt)) : "—",
    minutesToReadable(row.totalWorkMinutes), minutesToReadable(row.totalBreakMinutes), label(row.status),
  ]);
}

function invoiceTable(rows: DemoRow<"invoices">[]) {
  return table("Invoices", ["Invoice", "Project", "Period", "Total", "Status"], byNewest(rows, (row) => row.createdAt), (row) => [
    row.invoiceNumber, text(row.projectName), row.periodLabel, money(row.total), label(row.status),
  ]);
}

async function Overview() {
  const [people, attendance, projects, clients] = await Promise.all([
    readDemoRows("users"), readDemoRows("attendance_sessions"), readDemoRows("projects"), readDemoRows("clients"),
  ]);
  const recent = byNewest(attendance, (row) => row.clockInAt);
  const latestDate = recent[0]?.workDate;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Employees" value={people.length} icon={Users} iconColor="text-brand-600" iconBg="bg-brand-50" />
        <StatCard title="Working Now" value={attendance.filter((row) => row.status === "working").length} icon={Clock} iconColor="text-green-600" iconBg="bg-green-50" />
        <StatCard title="On Break" value={attendance.filter((row) => row.status === "on_break").length} icon={Coffee} iconColor="text-orange-600" iconBg="bg-orange-50" />
        <StatCard title="Recorded Work" value={minutesToReadable(attendance.reduce((total, row) => total + row.totalWorkMinutes, 0))} icon={TrendingUp} iconColor="text-blue-600" iconBg="bg-blue-50" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Active Projects" value={projects.filter((row) => row.status === "active").length} icon={FolderKanban} iconColor="text-brand-600" iconBg="bg-brand-50" />
        <StatCard title="Active Clients" value={clients.filter((row) => row.status === "active").length} icon={Building2} iconColor="text-blue-600" iconBg="bg-blue-50" />
      </div>
      {attendanceTable(recent.filter((row) => row.workDate === latestDate), "Latest attendance")}
      <Link href="/demo/attendance" className="btn-ghost" prefetch={false}>
        View all attendance <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </>
  );
}

async function Payroll() {
  const [people, attendance] = await Promise.all([readDemoRows("users"), readDemoRows("attendance_sessions")]);
  const rows = people.map((person) => ({
    ...person,
    pay: calculatePeriodPayroll(
      attendance.filter((session) => session.userId === person.id && session.status === "completed"),
      person.hourlyRate ?? 0,
      person.overtimeMultiplier,
    ),
  }));

  return table("Payroll estimates for sample attendance", ["Employee", "Days", "Regular", "Overtime", "Gross pay"], rows, (row) => [
    row.displayName, String(row.pay.totalDays), minutesToReadable(row.pay.regularMinutes),
    minutesToReadable(row.pay.overtimeMinutes), money(row.pay.grossPay),
  ]);
}

async function Finance() {
  const [invoices, expenses] = await Promise.all([readDemoRows("invoices"), readDemoRows("expenses")]);
  const revenue = invoices.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.total, 0);
  const costs = expenses.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.amount, 0);
  const outstanding = invoices.filter((row) => row.status === "issued").reduce((sum, row) => sum + row.total, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Paid Revenue" value={money(revenue)} icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-50" />
        <StatCard title="Approved Expenses" value={money(costs)} icon={Wallet} iconColor="text-orange-600" iconBg="bg-orange-50" />
        <StatCard title="Net Profit" value={money(revenue - costs)} icon={TrendingUp} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Outstanding Invoices" value={money(outstanding)} icon={Receipt} iconColor="text-brand-600" iconBg="bg-brand-50" />
      </div>
      {invoiceTable(invoices)}
    </>
  );
}

async function contentFor(section: DemoSection) {
  switch (section) {
    case "dashboard": return <Overview />;
    case "attendance": return attendanceTable(byNewest(await readDemoRows("attendance_sessions"), (row) => row.clockInAt));
    case "employees": return table("Employee directory", ["Name", "Department", "Position"], await readDemoRows("users"), (row) => [
      row.displayName, text(row.department), text(row.position),
    ]);
    case "departments": return table("Departments", ["Department", "Lead", "Responsibilities"], await readDemoRows("departments"), (row) => [
      row.name, text(row.headName), text(row.description),
    ]);
    case "timesheets": return table("Timesheets", ["Employee", "Period", "Days worked", "Work time", "Status"],
      byNewest(await readDemoRows("timesheets"), (row) => row.periodStart), (row) => [
        row.employeeName, row.periodLabel, String(row.totalDaysWorked), minutesToReadable(Math.round(row.totalWorkMs / 60_000)), label(row.status),
      ]);
    case "payroll": return <Payroll />;
    case "invoices": return invoiceTable(await readDemoRows("invoices"));
    case "clients": return table("Client directory", ["Client", "Industry", "Billing", "Status"], await readDemoRows("clients"), (row) => [
      row.companyName, text(row.industry), label(row.billingType), label(row.status),
    ]);
    case "projects": {
      const [projects, tasks] = await Promise.all([readDemoRows("projects"), readDemoRows("tasks")]);
      return (
        <>
          {table("Projects", ["Project", "Client", "Service", "Manager", "Budget", "Spent", "Deadline", "Status"], projects, (row) => [
            row.name, row.clientName, row.serviceType, row.managerName, money(row.budget), money(row.spent), row.deadline, label(row.status),
          ])}
          {table("Project tasks", ["Task", "Project", "Assignee", "Due date", "Status"], tasks, (row) => [
            row.title, row.projectName, text(row.assigneeName), text(row.dueDate), label(row.status),
          ])}
        </>
      );
    }
    case "leave": return table("Leave requests", ["Employee", "Type", "Start date", "End date", "Days", "Status"],
      byNewest(await readDemoRows("leave_requests"), (row) => row.startDate), (row) => [
        row.employeeName, label(row.type), row.startDate, row.endDate, String(row.totalDays), label(row.status),
      ]);
    case "expenses": return table("Expenses", ["Expense", "Project", "Category", "Date", "Amount", "Status"],
      byNewest(await readDemoRows("expenses"), (row) => row.date), (row) => [
        row.description, text(row.projectName), label(row.category), row.date, money(row.amount), label(row.status),
      ]);
    case "finance": return <Finance />;
    case "announcements": {
      const announcements = byNewest(await readDemoRows("announcements"), (row) => row.createdAt)
        .sort((left, right) => Number(right.pinned) - Number(left.pinned));
      return announcements.length ? announcements.map((row) => (
        <article key={row.id} className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{row.title}</h3>
            {row.pinned && <span className="badge-blue">Pinned</span>}
          </div>
          <p className="whitespace-pre-line text-sm text-slate-700">{row.content}</p>
          <time dateTime={row.createdAt} className="text-xs text-slate-500">{row.createdAt.slice(0, 10)}</time>
        </article>
      )) : <p className="card text-sm text-slate-600">No demo announcements yet.</p>;
    }
  }
}

export default async function DemoPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section: path = [] } = await params;
  const section = path[0] ?? "dashboard";
  if (path.length > 1 || !isDemoSection(section)) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{DEMO_SECTIONS[section]}</h2>
        <p className="mt-1 text-sm text-slate-600">Read-only admin demo with sample data from Firestore.</p>
      </div>
      {await contentFor(section)}
    </div>
  );
}
