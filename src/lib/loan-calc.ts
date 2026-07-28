// ============================================================================
// Loan Calculation Engine
// ============================================================================

export interface LoanCalcParams {
  principal: number;
  annualInterestRate: number; // e.g., 12.5 for 12.5%
  durationMonths: number;
}

export interface LoanCalcResult {
  monthlyRepayment: number;
  totalRepayable: number;
  totalInterest: number;
  schedule: Array<{
    installmentNumber: number;
    principalComponent: number;
    interestComponent: number;
    balanceAfter: number;
    dueDate: Date;
  }>;
}

/**
 * Calculate loan repayment using the reducing balance method (amortization).
 * Formula: M = P * r * (1+r)^n / ((1+r)^n - 1)
 * where:
 *   M = monthly repayment
 *   P = principal
 *   r = monthly interest rate (annual / 12 / 100)
 *   n = number of months
 */
export function calculateLoan(params: LoanCalcParams): LoanCalcResult {
  const { principal, annualInterestRate, durationMonths } = params;
  const monthlyRate = annualInterestRate / 100 / 12;

  let monthlyRepayment: number;
  if (monthlyRate === 0) {
    monthlyRepayment = principal / durationMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, durationMonths);
    monthlyRepayment = (principal * monthlyRate * factor) / (factor - 1);
  }

  const totalRepayable = monthlyRepayment * durationMonths;
  const totalInterest = totalRepayable - principal;

  // Generate amortization schedule
  const schedule: LoanCalcResult["schedule"] = [];
  let remainingBalance = principal;
  const today = new Date();

  for (let i = 1; i <= durationMonths; i++) {
    const interestComponent = remainingBalance * monthlyRate;
    const principalComponent = monthlyRepayment - interestComponent;
    remainingBalance = Math.max(0, remainingBalance - principalComponent);

    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNumber: i,
      principalComponent: Math.round(principalComponent * 100) / 100,
      interestComponent: Math.round(interestComponent * 100) / 100,
      balanceAfter: Math.round(remainingBalance * 100) / 100,
      dueDate,
    });
  }

  return {
    monthlyRepayment: Math.round(monthlyRepayment * 100) / 100,
    totalRepayable: Math.round(totalRepayable * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule,
  };
}

export function calculateSavingsInterest(
  currentBalance: number,
  annualRate: number,
  daysElapsed: number
): number {
  // Simple daily interest: (balance * rate / 365 * days)
  return Math.round(((currentBalance * annualRate) / 100 / 365) * daysElapsed * 100) / 100;
}

export function calculateEarlyWithdrawalPenalty(
  balance: number,
  penaltyRate: number
): number {
  return Math.round(((balance * penaltyRate) / 100) * 100) / 100;
}
