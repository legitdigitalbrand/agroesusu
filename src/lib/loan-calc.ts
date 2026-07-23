/**
 * Agroesusu Loan Calculation Utilities
 * 
 * Uses flat-rate interest (common in Nigerian microfinance):
 * Total Interest = Principal × Monthly Rate × (Tenor in months)
 * Total Repayment = Principal + Total Interest
 * Monthly Repayment = Total Repayment / Number of Months
 */

export interface LoanCalculation {
  principal: number;
  monthlyRate: number;
  tenorDays: number;
  tenorMonths: number;
  totalInterest: number;
  totalRepayment: number;
  monthlyRepayment: number;
}

export function calculateLoan(
  principal: number,
  monthlyRate: number,
  tenorDays: number
): LoanCalculation {
  const tenorMonths = tenorDays / 30;
  const totalInterest = principal * monthlyRate * tenorMonths;
  const totalRepayment = principal + totalInterest;
  const monthlyRepayment = totalRepayment / tenorMonths;

  return {
    principal,
    monthlyRate,
    tenorDays,
    tenorMonths,
    totalInterest: Math.ceil(totalInterest),
    totalRepayment: Math.ceil(totalRepayment),
    monthlyRepayment: Math.ceil(monthlyRepayment),
  };
}

/**
 * Generate a repayment schedule for a loan
 */
export interface RepaymentScheduleItem {
  due_date: string; // ISO date string
  amount_due: number;
}

export function generateRepaymentSchedule(
  principal: number,
  monthlyRate: number,
  tenorDays: number,
  startDate: Date = new Date()
): RepaymentScheduleItem[] {
  const calc = calculateLoan(principal, monthlyRate, tenorDays);
  const tenorMonths = Math.ceil(tenorDays / 30);
  const schedule: RepaymentScheduleItem[] = [];

  for (let i = 1; i <= tenorMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + Math.round((tenorDays / tenorMonths) * i));
    schedule.push({
      due_date: dueDate.toISOString().split('T')[0],
      amount_due: Math.ceil(calc.totalRepayment / tenorMonths),
    });
  }

  // Adjust last payment for rounding difference
  if (schedule.length > 0) {
    const sum = schedule.reduce((acc, s) => acc + s.amount_due, 0);
    const diff = calc.totalRepayment - sum;
    if (diff !== 0) {
      schedule[schedule.length - 1].amount_due += diff;
    }
  }

  return schedule;
}
