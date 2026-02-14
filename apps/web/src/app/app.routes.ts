import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
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
      { path: '', redirectTo: 'employees', pathMatch: 'full' },
    ],
  },
];
