import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import AppLayout from "./pages/layout/AppLayout.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import DashboardPage from "./pages/dashboard/page.tsx";
import CustomersPage from "./pages/customers/page.tsx";
import CustomerDetailPage from "./pages/customers/[id]/page.tsx";
import UsersPage from "./pages/admin/users/page.tsx";
import LaboratoriesPage from "./pages/admin/laboratories/page.tsx";
import DepartmentsPage from "./pages/admin/departments/page.tsx";
import TestMethodsPage from "./pages/admin/methods/page.tsx";
import TestCataloguePage from "./pages/admin/tests/page.tsx";
import SamplesPage from "./pages/samples/page.tsx";
import SampleDetailPage from "./pages/samples/[id]/page.tsx";
import WorksheetPage from "./pages/samples/[id]/worksheet/page.tsx";
import RegisterSamplePage from "./pages/samples/register/page.tsx";
import WorkAssignmentPage from "./pages/laboratory/work-assignment/page.tsx";
import MyTestsPage from "./pages/laboratory/my-tests/page.tsx";
import TechnicalReviewPage from "./pages/quality/technical-review/page.tsx";
import QaApprovalPage from "./pages/quality/qa-approval/page.tsx";
import CoaPage from "./pages/quality/coa/page.tsx";
import ValidationPage from "./pages/quality/validation/page.tsx";
import ReportsPage from "./pages/reports/page.tsx";
import InstrumentsPage from "./pages/instruments/page.tsx";
import InstrumentDetailPage from "./pages/instruments/[id]/page.tsx";
import InventoryPage from "./pages/inventory/page.tsx";
import QualityManagementPage from "./pages/quality-management/page.tsx";
import BillingPage from "./pages/billing/page.tsx";
import CustomerPortalPage from "./pages/portal/page.tsx";
import AiCopilotPage from "./pages/ai-copilot/page.tsx";
import AnalyticsPage from "./pages/analytics/page.tsx";
import SchedulingPage from "./pages/scheduling/page.tsx";
import DocumentManagementPage from "./pages/documents/page.tsx";
import AuditManagementPage from "./pages/audits/page.tsx";
import SuppliersPage from "./pages/suppliers/page.tsx";
import TrainingPage from "./pages/training/page.tsx";
import StoragePage from "./pages/storage/page.tsx";
import SystemConfigPage from "./pages/admin/config/page.tsx";
import RolesPage from "./pages/admin/roles/page.tsx";
import UserReportsPage from "./pages/admin/user-reports/page.tsx";
import RevenuePage from "./pages/revenue/page.tsx";
import ProfilePage from "./pages/profile/page.tsx";
import CalculationsPage from "./pages/laboratory/calculations/page.tsx";
import SpecificationsPage from "./pages/laboratory/specifications/page.tsx";
import RetestPage from "./pages/laboratory/retest/page.tsx";
import AiIntelligencePage from "./pages/ai/intelligence/page.tsx";
import ErrorLogsPage from "./pages/admin/error-logs/page.tsx";

import InstrumentIntegrationPage from "./pages/instruments/integration/page.tsx";
import InstrumentQcPage from "./pages/instruments/qc/page.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <DefaultProviders>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/samples" element={<SamplesPage />} />
            <Route path="/samples/register" element={<RegisterSamplePage />} />
            <Route path="/samples/:id" element={<SampleDetailPage />} />
            <Route path="/samples/:id/worksheet" element={<WorksheetPage />} />
            <Route path="/laboratory/work-assignment" element={<WorkAssignmentPage />} />
            <Route path="/laboratory/my-tests" element={<MyTestsPage />} />
            <Route path="/quality/technical-review" element={<TechnicalReviewPage />} />
            <Route path="/quality/qa-approval" element={<QaApprovalPage />} />
            <Route path="/quality/coa/:sampleId" element={<CoaPage />} />
            <Route path="/quality/validation" element={<ValidationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/instruments" element={<InstrumentsPage />} />
            <Route path="/instruments/integration" element={<InstrumentIntegrationPage />} />
            <Route path="/instruments/qc" element={<InstrumentQcPage />} />
            <Route path="/instruments/:id" element={<InstrumentDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/quality-management" element={<QualityManagementPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/portal" element={<CustomerPortalPage />} />
            <Route path="/ai-copilot" element={<AiCopilotPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
            <Route path="/documents" element={<DocumentManagementPage />} />
            <Route path="/audits" element={<AuditManagementPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/admin/config" element={<SystemConfigPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/laboratories" element={<LaboratoriesPage />} />
            <Route path="/admin/departments" element={<DepartmentsPage />} />
            <Route path="/admin/methods" element={<TestMethodsPage />} />
            <Route path="/admin/tests" element={<TestCataloguePage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
            <Route path="/admin/user-reports" element={<UserReportsPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/laboratory/calculations" element={<CalculationsPage />} />
            <Route path="/laboratory/specifications" element={<SpecificationsPage />} />
            <Route path="/laboratory/retest" element={<RetestPage />} />
            <Route path="/ai/intelligence" element={<AiIntelligencePage />} />
            <Route path="/admin/error-logs" element={<ErrorLogsPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DefaultProviders>
    </BrowserRouter>
  );
}
