import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService, AdminOrg, AdminStats } from './admin.service';
import { OrgDialogComponent, OrgDialogResult } from './org-dialog.component';

@Component({
  selector: 'app-organizations-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatMenuModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Organizations</h1>
          <p class="page-subtitle">Manage organizations and their users</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          Create Organization
        </button>
      </div>

      @if (stats) {
        <div class="stats-row">
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-value">{{ stats.orgCount }}</div>
              <div class="stat-label">Organizations</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-value">{{ stats.userCount }}</div>
              <div class="stat-label">Users</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-value">{{ stats.employeeCount }}</div>
              <div class="stat-label">Employees</div>
            </mat-card-content>
          </mat-card>
        </div>
      }

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (organizations.length === 0) {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon class="empty-icon">business</mat-icon>
            <p>No organizations yet. Create one to get started.</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card>
          <table mat-table [dataSource]="organizations" class="full-width">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let org">
                <a [routerLink]="['/admin/organizations', org.id, 'users']" class="org-link">
                  {{ org.name }}
                </a>
              </td>
            </ng-container>

            <ng-container matColumnDef="slug">
              <th mat-header-cell *matHeaderCellDef>Slug</th>
              <td mat-cell *matCellDef="let org">
                <code class="slug-badge">{{ org.slug }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="users">
              <th mat-header-cell *matHeaderCellDef>Users</th>
              <td mat-cell *matCellDef="let org">{{ org.userCount }}</td>
            </ng-container>

            <ng-container matColumnDef="employees">
              <th mat-header-cell *matHeaderCellDef>Employees</th>
              <td mat-cell *matCellDef="let org">{{ org.employeeCount }}</td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let org">{{ org.createdAt | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let org">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="['/admin/organizations', org.id, 'users']">
                    <mat-icon>people</mat-icon>
                    <span>Manage Users</span>
                  </a>
                  <button mat-menu-item (click)="openEditDialog(org)">
                    <mat-icon>edit</mat-icon>
                    <span>Edit</span>
                  </button>
                  <button mat-menu-item (click)="deleteOrg(org)" [disabled]="org.userCount > 0 || org.employeeCount > 0">
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
    </div>
  `,
  styles: [`
    .page-container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0; }

    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #4f46e5; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 2px; }

    .loading-container { display: flex; justify-content: center; padding: 48px; }
    .empty-state { text-align: center; padding: 48px 24px; }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; }

    .full-width { width: 100%; }
    .org-link { color: #4f46e5; text-decoration: none; font-weight: 500; }
    .org-link:hover { text-decoration: underline; }
    .slug-badge {
      background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px;
      font-size: 12px; font-family: monospace;
    }
  `],
})
export class OrganizationsListComponent implements OnInit {
  organizations: AdminOrg[] = [];
  stats: AdminStats | null = null;
  loading = true;
  displayedColumns = ['name', 'slug', 'users', 'employees', 'created', 'actions'];

  constructor(
    private adminService: AdminService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.adminService.getStats().subscribe({
      next: (stats) => this.stats = stats,
    });
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load organizations', 'Dismiss', { duration: 4000 });
      },
    });
  }

  openCreateDialog() {
    const ref = this.dialog.open(OrgDialogComponent, {
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe((result: OrgDialogResult | undefined) => {
      if (result) {
        this.adminService.createOrganization(result).subscribe({
          next: () => {
            this.snackBar.open('Organization created', 'Dismiss', { duration: 3000 });
            this.load();
          },
          error: (err) => {
            const msg = err.error?.error || 'Failed to create organization';
            this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
          },
        });
      }
    });
  }

  openEditDialog(org: AdminOrg) {
    const ref = this.dialog.open(OrgDialogComponent, {
      data: { mode: 'edit', name: org.name, slug: org.slug },
    });
    ref.afterClosed().subscribe((result: OrgDialogResult | undefined) => {
      if (result) {
        this.adminService.updateOrganization(org.id, result).subscribe({
          next: () => {
            this.snackBar.open('Organization updated', 'Dismiss', { duration: 3000 });
            this.load();
          },
          error: (err) => {
            const msg = err.error?.error || 'Failed to update organization';
            this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
          },
        });
      }
    });
  }

  deleteOrg(org: AdminOrg) {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    this.adminService.deleteOrganization(org.id).subscribe({
      next: () => {
        this.snackBar.open('Organization deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        const msg = err.error?.error || 'Failed to delete organization';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }
}
