import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AdminService, AdminOrg, AdminUser } from './admin.service';
import { UserDialogComponent, UserDialogResult } from './user-dialog.component';

@Component({
  selector: 'app-organization-users',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatMenuModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
    MatChipsModule, MatFormFieldModule, MatInputModule,
  ],
  template: `
    <div class="page-container">
      <div class="breadcrumb">
        <a routerLink="/admin/organizations">Organizations</a>
        <mat-icon class="breadcrumb-sep">chevron_right</mat-icon>
        <span>{{ org?.name || 'Loading...' }}</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">{{ org?.name }} — Users</h1>
          <p class="page-subtitle">
            @if (org) {
              {{ users.length }} user{{ users.length !== 1 ? 's' : '' }}
              · {{ org.employeeCount }} employee{{ org.employeeCount !== 1 ? 's' : '' }}
            }
          </p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>person_add</mat-icon>
          Add User
        </button>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (users.length === 0) {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon class="empty-icon">people</mat-icon>
            <p>No users in this organization yet.</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card>
          <table mat-table [dataSource]="users" class="full-width">
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let user">{{ user.email }}</td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let user">
                <span class="role-badge" [class]="'role-' + user.role.toLowerCase()">
                  {{ formatRole(user.role) }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let user">{{ user.createdAt | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let user">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openEditDialog(user)">
                    <mat-icon>edit</mat-icon>
                    <span>Edit Role</span>
                  </button>
                  <button mat-menu-item (click)="openResetPassword(user)">
                    <mat-icon>lock_reset</mat-icon>
                    <span>Reset Password</span>
                  </button>
                  <button mat-menu-item (click)="deleteUser(user)">
                    <mat-icon>delete</mat-icon>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </mat-card>
      }

      <!-- Reset Password Dialog (inline) -->
      @if (showResetPassword) {
        <div class="overlay" (click)="showResetPassword = false">
          <mat-card class="reset-card" (click)="$event.stopPropagation()">
            <mat-card-header>
              <mat-card-title>Reset Password</mat-card-title>
              <mat-card-subtitle>{{ resetTarget?.email }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>New Password</mat-label>
                <input matInput type="password" [(ngModel)]="newPassword" />
                <mat-hint>Minimum 8 characters</mat-hint>
              </mat-form-field>
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-button (click)="showResetPassword = false">Cancel</button>
              <button mat-raised-button color="primary" [disabled]="newPassword.length < 8" (click)="confirmResetPassword()">
                Reset Password
              </button>
            </mat-card-actions>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0; }

    .breadcrumb {
      display: flex; align-items: center; gap: 4px; margin-bottom: 16px;
      font-size: 14px; color: #64748b;
    }
    .breadcrumb a { color: #4f46e5; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb-sep { font-size: 18px; width: 18px; height: 18px; }

    .loading-container { display: flex; justify-content: center; padding: 48px; }
    .empty-state { text-align: center; padding: 48px 24px; }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; }

    .full-width { width: 100%; }

    .role-badge {
      padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
      display: inline-block;
    }
    .role-admin { background: #ede9fe; color: #6d28d9; }
    .role-hr_manager { background: #dbeafe; color: #1d4ed8; }
    .role-manager { background: #d1fae5; color: #047857; }
    .role-viewer { background: #f1f5f9; color: #475569; }

    .overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
    }
    .reset-card { width: 400px; padding: 8px; }
  `],
})
export class OrganizationUsersComponent implements OnInit {
  orgId = '';
  org: AdminOrg | null = null;
  users: AdminUser[] = [];
  loading = true;
  displayedColumns = ['email', 'role', 'created', 'actions'];

  showResetPassword = false;
  resetTarget: AdminUser | null = null;
  newPassword = '';

  constructor(
    private route: ActivatedRoute,
    private adminService: AdminService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.orgId = this.route.snapshot.paramMap.get('id')!;
    this.load();
  }

  load() {
    this.loading = true;
    this.adminService.getOrganization(this.orgId).subscribe({
      next: (org) => this.org = org,
    });
    this.adminService.getOrganizationUsers(this.orgId).subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load users', 'Dismiss', { duration: 4000 });
      },
    });
  }

  formatRole(role: string): string {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  openCreateDialog() {
    const ref = this.dialog.open(UserDialogComponent, {
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe((result: UserDialogResult | undefined) => {
      if (result) {
        this.adminService.createUser(this.orgId, {
          email: result.email,
          password: result.password!,
          role: result.role,
        }).subscribe({
          next: () => {
            this.snackBar.open('User created', 'Dismiss', { duration: 3000 });
            this.load();
          },
          error: (err) => {
            const msg = err.error?.error || 'Failed to create user';
            this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
          },
        });
      }
    });
  }

  openEditDialog(user: AdminUser) {
    const ref = this.dialog.open(UserDialogComponent, {
      data: { mode: 'edit', email: user.email, role: user.role },
    });
    ref.afterClosed().subscribe((result: UserDialogResult | undefined) => {
      if (result) {
        this.adminService.updateUser(user.id, { email: result.email, role: result.role }).subscribe({
          next: () => {
            this.snackBar.open('User updated', 'Dismiss', { duration: 3000 });
            this.load();
          },
          error: (err) => {
            const msg = err.error?.error || 'Failed to update user';
            this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
          },
        });
      }
    });
  }

  openResetPassword(user: AdminUser) {
    this.resetTarget = user;
    this.newPassword = '';
    this.showResetPassword = true;
  }

  confirmResetPassword() {
    if (!this.resetTarget) return;
    this.adminService.resetPassword(this.resetTarget.id, this.newPassword).subscribe({
      next: () => {
        this.snackBar.open('Password reset successfully', 'Dismiss', { duration: 3000 });
        this.showResetPassword = false;
      },
      error: () => {
        this.snackBar.open('Failed to reset password', 'Dismiss', { duration: 4000 });
      },
    });
  }

  deleteUser(user: AdminUser) {
    if (!confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.snackBar.open('User deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        const msg = err.error?.error || 'Failed to delete user';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }
}
