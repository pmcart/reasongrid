import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isSuperAdmin()) {
    return true;
  }
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/employees']);
  }
  return router.createUrlTree(['/login']);
};

export const regularUserGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && !auth.isSuperAdmin()) {
    return true;
  }
  if (auth.isSuperAdmin()) {
    return router.createUrlTree(['/admin']);
  }
  return router.createUrlTree(['/login']);
};
