import { Routes } from '@angular/router';
import { superAdminGuard, regularUserGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
  },
  // Super admin routes
  {
    path: 'admin',
    canActivate: [superAdminGuard],
    children: [
      {
        path: 'organizations',
        loadComponent: () =>
          import('./admin/organizations-list.component').then((m) => m.OrganizationsListComponent),
      },
      {
        path: 'organizations/:id/users',
        loadComponent: () =>
          import('./admin/organization-users.component').then((m) => m.OrganizationUsersComponent),
      },
      { path: '', redirectTo: 'organizations', pathMatch: 'full' },
    ],
  },
  // Regular org-scoped routes
  {
    path: '',
    canActivate: [regularUserGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./employees/employee-list.component').then((m) => m.EmployeeListComponent),
      },
      {
        path: 'employees/:id',
        loadComponent: () =>
          import('./employees/employee-detail.component').then((m) => m.EmployeeDetailComponent),
      },
      {
        path: 'pay-decisions/:id',
        loadComponent: () =>
          import('./pay-decisions/pay-decision-detail.component').then((m) => m.PayDecisionDetailComponent),
      },
      {
        path: 'imports',
        loadComponent: () =>
          import('./imports/import-list.component').then((m) => m.ImportListComponent),
      },
      {
        path: 'imports/new',
        loadComponent: () =>
          import('./imports/import-wizard.component').then((m) => m.ImportWizardComponent),
      },
      {
        path: 'risk',
        loadComponent: () =>
          import('./risk/risk-dashboard.component').then((m) => m.RiskDashboardComponent),
      },
      {
        path: 'risk/groups/:groupKey',
        loadComponent: () =>
          import('./risk/risk-group-detail.component').then((m) => m.RiskGroupDetailComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./audit/audit-log.component').then((m) => m.AuditLogComponent),
      },
      {
        path: 'rationale-library',
        loadComponent: () =>
          import('./rationale-library/rationale-library-list.component').then(
            (m) => m.RationaleLibraryListComponent,
          ),
      },
      {
        path: 'rationale-library/:code/history',
        loadComponent: () =>
          import('./rationale-library/rationale-version-history.component').then(
            (m) => m.RationaleVersionHistoryComponent,
          ),
      },
      {
        path: 'settings/policy-rules',
        loadComponent: () =>
          import('./settings/policy-rules.component').then((m) => m.PolicyRulesComponent),
      },
      {
        path: 'settings/salary-ranges',
        loadComponent: () =>
          import('./settings/salary-ranges.component').then((m) => m.SalaryRangesComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
