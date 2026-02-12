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
      { path: '', redirectTo: 'employees', pathMatch: 'full' },
    ],
  },
];
