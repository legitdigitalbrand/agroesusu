/**
 * Reporting & Analytics Module
 * 
 * Phase 9: Administration, Reporting & Analytics
 * 
 * Key principle: Reporting is READ-ONLY against existing sources of truth.
 * Aggregated/summary tables or materialized views built here must be clearly
 * derived and rebuildable from the Ledger and module data.
 * 
 * Two categories:
 *   - Operational reporting: real-time queries for day-to-day dashboards
 *   - Compliance/regulatory reporting: on-demand, traceable to Ledger entries
 * 
 * Public API:
 *   - Dashboards: getOperationalDashboard, getPortfolioSummary, getLoanPortfolio, getSavingsPortfolio, getInvestmentPortfolio
 *   - Compliance: getComplianceDepositsReport, getComplianceLoansReport, getReconciliationReport, getKYCStatusReport
 *   - Risk: getRiskReport, getInvestmentPoolPerformance
 *   - Audit: queryAuditLog, queryGovernanceAuditLog, queryAdminActionLog, getAuditLogSummary
 *   - Export: exportReport, getReportGenerationHistory
 *   - Types: OperationalDashboard, ComplianceDepositsReport, etc.
 */

// Dashboards
export {
  getOperationalDashboard, getPortfolioSummary,
  getLoanPortfolio, getSavingsPortfolio, getInvestmentPortfolio,
} from './dashboards';

// Compliance
export {
  getComplianceDepositsReport, getComplianceLoansReport,
  getReconciliationReport, getKYCStatusReport,
} from './compliance';

// Risk
export { getRiskReport, getInvestmentPoolPerformance } from './risk';

// Audit Viewer
export {
  queryAuditLog, queryGovernanceAuditLog, queryAdminActionLog, getAuditLogSummary,
} from './audit-viewer';

// Export
export { toCSV, exportReport, getReportGenerationHistory } from './export';

// Types
export type {
  ReportCategory, RefreshCadence, ReportDefinition,
  PortfolioSummary, LoanPortfolioReport, SavingsPortfolioReport,
  InvestmentPortfolioReport, ProductBreakdown, InvestmentProductBreakdown,
  ComplianceDepositsReport, ComplianceLoansReport, ReconciliationReport,
  KYCStatusReport, AuditLogQuery, AuditLogEntry, AuditLogSummary,
  RiskReport, OperationalDashboard,
} from './types';
