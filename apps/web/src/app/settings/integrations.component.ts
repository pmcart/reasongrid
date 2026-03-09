import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { HrisService } from '../core/hris.service';
import { AuthService } from '../core/auth.service';
import type { HrisConnection, HrisTestResult } from '@cdi/shared';

// ─── Connection Dialog ────────────────────────────────────────────────────────

@Component({
  selector: 'app-hris-connection-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDialogModule, MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.connection ? 'Edit' : 'Add' }} BambooHR Connection</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Connection Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Production BambooHR" />
          <mat-hint>A friendly label for this connection</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Company Subdomain</mat-label>
          <input matInput formControlName="subdomain" placeholder="e.g. reasongrid" />
          <mat-hint>From your BambooHR URL: <strong>subdomain</strong>.bamboohr.com</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>API Key</mat-label>
          <input matInput formControlName="apiKey" [type]="showKey ? 'text' : 'password'"
                 placeholder="{{ data.connection ? 'Enter new key to update' : 'Paste your BambooHR API key' }}" />
          <button mat-icon-button matSuffix type="button" (click)="showKey = !showKey">
            <mat-icon>{{ showKey ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (data.connection) {
            <mat-hint>Leave blank to keep the existing key</mat-hint>
          } @else {
            <mat-hint>Generated in BambooHR → My Account → API Keys</mat-hint>
          }
        </mat-form-field>

        @if (testResult) {
          <div class="test-result" [class.success]="testResult.success" [class.error]="!testResult.success">
            <mat-icon>{{ testResult.success ? 'check_circle' : 'error' }}</mat-icon>
            <span>{{ testResult.message }}</span>
          </div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-stroked-button color="primary" type="button"
              [disabled]="testing || !form.get('subdomain')?.value || !form.get('apiKey')?.value"
              (click)="testCredentials()">
        @if (testing) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner> }
        Test Connection
      </button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        @if (saving) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner> }
        {{ data.connection ? 'Save Changes' : 'Add Connection' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 16px; min-width: 420px; padding: 8px 0; }
    .full-width { width: 100%; }
    .test-result {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      border-radius: 6px; font-size: 13px;
      &.success { background: #e8f5e9; color: #2e7d32; mat-icon { color: #2e7d32; } }
      &.error { background: #fce4ec; color: #c62828; mat-icon { color: #c62828; } }
    }
  `],
})
export class HrisConnectionDialogComponent {
  data = inject<{ connection: HrisConnection | null }>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<HrisConnectionDialogComponent>);
  private hrisService = inject(HrisService);
  private cdr = inject(ChangeDetectorRef);

  showKey = false;
  testing = false;
  saving = false;
  testResult: HrisTestResult | null = null;

  form = inject(FormBuilder).nonNullable.group({
    name: [this.data.connection?.name ?? '', Validators.required],
    subdomain: [this.data.connection?.subdomain ?? '', Validators.required],
    apiKey: ['', this.data.connection ? [] : [Validators.required]],
  });

  testCredentials() {
    const sub = this.form.get('subdomain')!.value;
    const key = this.form.get('apiKey')!.value;
    if (!sub || !key) return;
    this.testing = true;
    this.testResult = null;
    this.hrisService.testCredentials(sub, key).subscribe({
      next: (r) => { this.testResult = r; this.testing = false; this.cdr.markForCheck(); },
      error: () => { this.testResult = { success: false, message: 'Request failed' }; this.testing = false; this.cdr.markForCheck(); },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.getRawValue();

    if (this.data.connection) {
      const payload: Record<string, unknown> = { name: v.name, subdomain: v.subdomain };
      if (v.apiKey) payload['apiKey'] = v.apiKey;
      this.hrisService.updateConnection(this.data.connection.id, payload).subscribe({
        next: (c) => { this.saving = false; this.dialogRef.close(c); },
        error: () => { this.saving = false; this.cdr.markForCheck(); },
      });
    } else {
      this.hrisService.createConnection({ provider: 'bamboohr', name: v.name, subdomain: v.subdomain, apiKey: v.apiKey }).subscribe({
        next: (c) => { this.saving = false; this.dialogRef.close(c); },
        error: () => { this.saving = false; this.cdr.markForCheck(); },
      });
    }
  }
}

// ─── Main Integrations Page ───────────────────────────────────────────────────

@Component({
  selector: 'app-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatChipsModule, MatSnackBarModule,
    MatDialogModule, MatProgressSpinnerModule, MatSlideToggleModule,
    MatExpansionModule, MatTooltipModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">HR System Integrations</h1>
          <p class="page-subtitle">
            Connect your HRIS to sync employee data directly into CDI — no CSV upload needed.
          </p>
        </div>
      </div>

      <!-- Setup Instructions -->
      <mat-card class="setup-card">
        <mat-card-header>
          <mat-icon mat-card-avatar class="provider-icon">info_outline</mat-icon>
          <mat-card-title>Before you connect BambooHR</mat-card-title>
          <mat-card-subtitle>Your BambooHR admin needs to complete these steps</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <ol class="setup-steps">
            <li>
              <strong>Log in to BambooHR</strong> as an admin (or a user with <em>View All</em> access to employee and compensation data).
            </li>
            <li>
              Go to <strong>My Account</strong> (click your name, top-right) → <strong>API Keys</strong>.
            </li>
            <li>
              Click <strong>"Add New Key"</strong>, give it a name such as <em>"CDI Integration"</em>, then click Generate.
            </li>
            <li>
              <strong>Copy the API key immediately</strong> — BambooHR only shows it once.
            </li>
            <li>
              Note your <strong>company subdomain</strong>: it's the part before <code>.bamboohr.com</code> in your BambooHR URL
              (e.g. <code>https://<strong>reasongrid</strong>.bamboohr.com</code>).
            </li>
            <li>
              Paste both values into the connection form below and click <strong>Test Connection</strong> to verify.
            </li>
          </ol>

          <div class="tip-box">
            <mat-icon>tips_and_updates</mat-icon>
            <div>
              <strong>Recommended:</strong> Create a dedicated <em>Integration User</em> in BambooHR with read-only access to employee records and compensation data.
              This limits the blast radius if the API key is ever compromised.
            </div>
          </div>

          <div class="tip-box warn">
            <mat-icon>lock</mat-icon>
            <div>
              <strong>Data accessed:</strong> CDI syncs employee identity (name, ID), role details, location, hire date, gender, and compensation (base pay, currency).
              Compensation data requires that the API user has access to the <em>Compensation</em> tab in BambooHR.
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- BambooHR Connections -->
      <mat-card class="connections-card">
        <mat-card-header>
          <div class="provider-header">
            <div class="provider-logo bamboohr-logo">
              <mat-icon>account_tree</mat-icon>
              <span>BambooHR</span>
            </div>
            @if (auth.user()?.role === 'ADMIN' || auth.user()?.role === 'HR_MANAGER') {
              <button mat-flat-button color="primary" (click)="openAddDialog()">
                <mat-icon>add</mat-icon> Add Connection
              </button>
            }
          </div>
        </mat-card-header>
        <mat-card-content>
          @if (loading) {
            <div class="loading-state">
              <mat-spinner diameter="32"></mat-spinner>
              <span>Loading connections…</span>
            </div>
          } @else if (connections.length === 0) {
            <div class="empty-state">
              <mat-icon>cable</mat-icon>
              <p>No BambooHR connections configured yet.</p>
              @if (auth.user()?.role === 'ADMIN' || auth.user()?.role === 'HR_MANAGER') {
                <button mat-stroked-button color="primary" (click)="openAddDialog()">
                  <mat-icon>add</mat-icon> Add your first connection
                </button>
              }
            </div>
          } @else {
            <div class="connections-list">
              @for (conn of connections; track conn.id) {
                <div class="connection-row">
                  <div class="connection-info">
                    <div class="connection-name">
                      <span>{{ conn.name }}</span>
                      <span class="subdomain-chip">{{ conn.subdomain }}.bamboohr.com</span>
                      @if (!conn.isActive) {
                        <span class="status-chip disabled">Disabled</span>
                      } @else {
                        <span class="status-chip active">Active</span>
                      }
                    </div>
                    <div class="connection-meta">
                      @if (conn.lastSyncAt) {
                        Last synced {{ conn.lastSyncAt | date:'dd MMM yyyy, HH:mm' }}
                      } @else {
                        Never synced
                      }
                    </div>
                  </div>
                  <div class="connection-actions">
                    @if (syncing[conn.id]) {
                      <mat-spinner diameter="20"></mat-spinner>
                    }
                    <button mat-icon-button matTooltip="Test connection"
                            [disabled]="!!syncing[conn.id]"
                            (click)="testConnection(conn)">
                      <mat-icon>wifi_tethering</mat-icon>
                    </button>
                    @if (auth.user()?.role === 'ADMIN' || auth.user()?.role === 'HR_MANAGER') {
                      <button mat-icon-button matTooltip="Sync now"
                              [disabled]="!conn.isActive || !!syncing[conn.id]"
                              (click)="syncNow(conn)">
                        <mat-icon>sync</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Edit" (click)="openEditDialog(conn)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      @if (auth.user()?.role === 'ADMIN') {
                        <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteConnection(conn)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- Field Mapping Info -->
      <mat-card class="info-card">
        <mat-card-header>
          <mat-card-title>How employee data is mapped</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="mapping-table-wrapper">
            <table class="mapping-table">
              <thead>
                <tr>
                  <th>CDI Field</th>
                  <th>BambooHR Field</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Employee ID</td><td>employeeNumber</td><td>Stable HR ID (not internal BambooHR ID)</td></tr>
                <tr><td>Full Name</td><td>firstName + lastName</td><td></td></tr>
                <tr><td>Role Title</td><td>jobTitle</td><td></td></tr>
                <tr><td>Job Family</td><td>department</td><td></td></tr>
                <tr><td>Level</td><td>customLevel</td><td>Custom field — ensure it exists in BambooHR. Falls back to <em>department</em>.</td></tr>
                <tr><td>Country</td><td>country</td><td>Normalised to ISO 2-letter code</td></tr>
                <tr><td>Location</td><td>location</td><td></td></tr>
                <tr><td>Base Salary</td><td>payRate</td><td>Automatically annualised based on payPeriod</td></tr>
                <tr><td>Currency</td><td>currency</td><td></td></tr>
                <tr><td>Hire Date</td><td>hireDate</td><td></td></tr>
                <tr><td>Employment Type</td><td>employmentHistoryStatus</td><td>Full-time, Part-time, Contract etc.</td></tr>
                <tr><td>Gender</td><td>gender</td><td>Used for risk analysis only; not shown in manager UI</td></tr>
              </tbody>
            </table>
          </div>
          <p class="mapping-note">
            If your BambooHR instance uses a different custom field for <em>Level</em>, contact your CDI administrator
            to configure the field mapping per connection.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 960px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px; font-size: 24px; font-weight: 600; }
    .page-subtitle { margin: 0; color: #666; font-size: 14px; }

    .setup-card, .connections-card, .info-card { margin-bottom: 24px; }

    /* Setup instructions */
    .setup-steps {
      margin: 0 0 16px; padding-left: 20px;
      li { margin-bottom: 10px; font-size: 14px; line-height: 1.5; }
      code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-family: monospace; }
    }
    .tip-box {
      display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px;
      background: #e3f2fd; font-size: 13px; margin-top: 12px;
      mat-icon { color: #1565c0; font-size: 20px; flex-shrink: 0; margin-top: 1px; }
      &.warn { background: #fff8e1; mat-icon { color: #f57f17; } }
    }

    /* Provider header */
    .provider-header {
      display: flex; justify-content: space-between; align-items: center;
      width: 100%; padding: 4px 0;
    }
    .provider-logo {
      display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px;
      mat-icon { font-size: 22px; }
      &.bamboohr-logo { color: #7ab648; }
    }

    /* Connections list */
    .loading-state, .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 40px; color: #888; text-align: center;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #ccc; }
    }
    .connections-list { display: flex; flex-direction: column; gap: 0; }
    .connection-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 0; border-bottom: 1px solid #f0f0f0;
      &:last-child { border-bottom: none; }
    }
    .connection-info { flex: 1; }
    .connection-name {
      display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
      font-weight: 500; font-size: 14px;
    }
    .subdomain-chip {
      font-size: 12px; color: #555; background: #f5f5f5;
      padding: 2px 8px; border-radius: 12px;
    }
    .status-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 500;
      &.active { background: #e8f5e9; color: #2e7d32; }
      &.disabled { background: #fafafa; color: #999; }
    }
    .connection-meta { font-size: 12px; color: #888; }
    .connection-actions { display: flex; align-items: center; gap: 4px; }

    /* Field mapping table */
    .mapping-table-wrapper { overflow-x: auto; }
    .mapping-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
      th { font-weight: 600; background: #fafafa; }
      td:nth-child(2) { font-family: monospace; font-size: 12px; color: #555; }
    }
    .mapping-note { font-size: 12px; color: #888; margin: 12px 0 0; }
  `],
})
export class IntegrationsComponent implements OnInit {
  private hrisService = inject(HrisService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  auth = inject(AuthService);

  connections: HrisConnection[] = [];
  loading = true;
  syncing: Record<string, boolean> = {};

  ngOnInit() {
    this.loadConnections();
  }

  loadConnections() {
    this.loading = true;
    this.hrisService.listConnections().subscribe({
      next: (c) => { this.connections = c; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openAddDialog() {
    this.dialog.open(HrisConnectionDialogComponent, { data: { connection: null }, width: '500px' })
      .afterClosed().subscribe((result: HrisConnection | undefined) => {
        if (result) {
          this.connections = [...this.connections, result];
          this.snackBar.open('Connection added', 'Dismiss', { duration: 3000 });
          this.cdr.markForCheck();
        }
      });
  }

  openEditDialog(conn: HrisConnection) {
    this.dialog.open(HrisConnectionDialogComponent, { data: { connection: conn }, width: '500px' })
      .afterClosed().subscribe((result: HrisConnection | undefined) => {
        if (result) {
          this.connections = this.connections.map((c) => (c.id === result.id ? result : c));
          this.snackBar.open('Connection updated', 'Dismiss', { duration: 3000 });
          this.cdr.markForCheck();
        }
      });
  }

  testConnection(conn: HrisConnection) {
    this.hrisService.testConnection(conn.id).subscribe({
      next: (r) => {
        this.snackBar.open(r.message, 'Dismiss', { duration: 5000 });
      },
      error: () => this.snackBar.open('Test request failed', 'Dismiss', { duration: 4000 }),
    });
  }

  syncNow(conn: HrisConnection) {
    this.syncing = { ...this.syncing, [conn.id]: true };
    this.cdr.markForCheck();
    this.hrisService.sync(conn.id).subscribe({
      next: (r) => {
        this.syncing = { ...this.syncing, [conn.id]: false };
        this.snackBar.open(`Sync started (Import #${r.importId.slice(0, 8)}…). Check Imports for progress.`, 'View Imports', { duration: 8000 });
        this.cdr.markForCheck();
      },
      error: () => {
        this.syncing = { ...this.syncing, [conn.id]: false };
        this.snackBar.open('Sync failed to start', 'Dismiss', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  deleteConnection(conn: HrisConnection) {
    if (!confirm(`Delete connection "${conn.name}"? This cannot be undone.`)) return;
    this.hrisService.deleteConnection(conn.id).subscribe({
      next: () => {
        this.connections = this.connections.filter((c) => c.id !== conn.id);
        this.snackBar.open('Connection deleted', 'Dismiss', { duration: 3000 });
        this.cdr.markForCheck();
      },
      error: () => this.snackBar.open('Delete failed', 'Dismiss', { duration: 4000 }),
    });
  }
}
