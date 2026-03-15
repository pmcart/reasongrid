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
import type { HrisConnection, HrisProvider, HrisTestResult } from '@cdi/shared';
import { hrisProviderLabels } from '@cdi/shared';

// ─── Connection Dialog (provider-aware) ──────────────────────────────────────

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
    <h2 mat-dialog-title>{{ data.connection ? 'Edit' : 'Add' }} {{ providerLabel }} Connection</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Connection Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Production {{ providerLabel }}" />
          <mat-hint>A friendly label for this connection</mat-hint>
        </mat-form-field>

        @if (data.provider === 'bamboohr') {
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
        }

        @if (data.provider === 'hibob') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Service User ID</mat-label>
            <input matInput formControlName="subdomain" placeholder="e.g. SERVICE-12345" />
            <mat-hint>From HiBob admin: Settings → Integrations → Service Users</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Service User Token</mat-label>
            <input matInput formControlName="apiKey" [type]="showKey ? 'text' : 'password'"
                   placeholder="{{ data.connection ? 'Enter new token to update' : 'Paste your HiBob service user token' }}" />
            <button mat-icon-button matSuffix type="button" (click)="showKey = !showKey">
              <mat-icon>{{ showKey ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (data.connection) {
              <mat-hint>Leave blank to keep the existing token</mat-hint>
            } @else {
              <mat-hint>Generated when creating the service user — copy it immediately, it's shown only once</mat-hint>
            }
          </mat-form-field>
        }

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
  data = inject<{ provider: HrisProvider; connection: HrisConnection | null }>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<HrisConnectionDialogComponent>);
  private hrisService = inject(HrisService);
  private cdr = inject(ChangeDetectorRef);

  showKey = false;
  testing = false;
  saving = false;
  testResult: HrisTestResult | null = null;

  get providerLabel() {
    return hrisProviderLabels[this.data.provider] ?? this.data.provider;
  }

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
    this.hrisService.testCredentials(sub, key, this.data.provider).subscribe({
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
      this.hrisService.createConnection({
        provider: this.data.provider,
        name: v.name,
        subdomain: v.subdomain,
        apiKey: v.apiKey,
      }).subscribe({
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
        <h1 class="page-title">HR System Integrations</h1>
        <p class="page-subtitle">Connect your HRIS to sync employee data directly into CDI.</p>
      </div>

      <!-- BambooHR ──────────────────────────────────────────────────────────── -->
      <mat-card class="provider-card">
        <mat-card-content>
          <div class="provider-header">
            <div class="provider-identity bamboohr-color">
              <mat-icon>account_tree</mat-icon>
              <span class="provider-name">BambooHR</span>
            </div>
            @if (canManage) {
              <button mat-stroked-button (click)="openAddDialog('bamboohr')">
                <mat-icon>add</mat-icon> Add Connection
              </button>
            }
          </div>

          <ng-container *ngTemplateOutlet="connectionList; context: { $implicit: bamboohrConnections }"></ng-container>

          <mat-expansion-panel class="setup-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>Setup guide</mat-panel-title>
              <mat-panel-description>How to get your API key</mat-panel-description>
            </mat-expansion-panel-header>
            <ol class="setup-steps">
              <li>Log in to BambooHR as an admin → <strong>My Account → API Keys</strong>.</li>
              <li>Click <strong>"Add New Key"</strong>, name it <em>"CDI Integration"</em>, then click Generate.</li>
              <li><strong>Copy the API key immediately</strong> — it's only shown once.</li>
              <li>Your <strong>company subdomain</strong> is the part before <code>.bamboohr.com</code> in your URL.</li>
            </ol>
            <div class="data-note">
              <mat-icon>lock_outline</mat-icon>
              <span>Reads: employee identity, role, location, hire date, gender, and compensation.</span>
            </div>
          </mat-expansion-panel>
        </mat-card-content>
      </mat-card>

      <!-- HiBob ────────────────────────────────────────────────────────────── -->
      <mat-card class="provider-card">
        <mat-card-content>
          <div class="provider-header">
            <div class="provider-identity hibob-color">
              <mat-icon>people_alt</mat-icon>
              <span class="provider-name">HiBob</span>
            </div>
            @if (canManage) {
              <button mat-stroked-button (click)="openAddDialog('hibob')">
                <mat-icon>add</mat-icon> Add Connection
              </button>
            }
          </div>

          <ng-container *ngTemplateOutlet="connectionList; context: { $implicit: hibobConnections }"></ng-container>

          <mat-expansion-panel class="setup-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>Setup guide</mat-panel-title>
              <mat-panel-description>How to create a Service User</mat-panel-description>
            </mat-expansion-panel-header>
            <ol class="setup-steps">
              <li>Log in to HiBob as an admin → <strong>Settings → Integrations → Service Users</strong>.</li>
              <li>Click <strong>"Create service user"</strong>, name it <em>"CDI Integration"</em>.</li>
              <li>Grant read access to: <strong>Basic Info, Work Info, Personal Info, Address, and Payroll</strong>.</li>
              <li>Click Create — copy the <strong>Service User ID</strong> and <strong>Token</strong> immediately. The token is only shown once.</li>
            </ol>
            <div class="data-note">
              <mat-icon>lock_outline</mat-icon>
              <span>Reads: employee identity, job title, department, site, start date, gender, and compensation.</span>
            </div>
          </mat-expansion-panel>
        </mat-card-content>
      </mat-card>

      <!-- Shared connection list template -->
      <ng-template #connectionList let-conns>
        @if (loading) {
          <div class="loading-state">
            <mat-spinner diameter="28"></mat-spinner>
          </div>
        } @else if (conns.length === 0) {
          <div class="empty-state">No connections configured yet.</div>
        } @else {
          <div class="connections-list">
            @for (conn of conns; track conn.id) {
              <div class="connection-row">
                <div class="connection-info">
                  <div class="connection-name">
                    {{ conn.name }}
                    <span class="mono-chip">{{ conn.subdomain }}</span>
                    <span class="status-chip" [class.active]="conn.isActive" [class.inactive]="!conn.isActive">
                      {{ conn.isActive ? 'Active' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="connection-meta">
                    @if (conn.lastSyncAt) { Last synced {{ conn.lastSyncAt | date:'d MMM yyyy, HH:mm' }} }
                    @else { Never synced }
                  </div>
                </div>
                <div class="connection-actions">
                  @if (syncing[conn.id]) { <mat-spinner diameter="18"></mat-spinner> }
                  <button mat-icon-button matTooltip="Test connection" [disabled]="!!syncing[conn.id]" (click)="testConnection(conn)">
                    <mat-icon>wifi_tethering</mat-icon>
                  </button>
                  @if (canManage) {
                    <button mat-icon-button matTooltip="Sync now" [disabled]="!conn.isActive || !!syncing[conn.id]" (click)="syncNow(conn)">
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
      </ng-template>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 860px; }
    .page-header { margin-bottom: 20px; }
    .page-title { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
    .page-subtitle { margin: 0; color: #666; font-size: 14px; }

    .provider-card { margin-bottom: 16px; }
    .provider-card mat-card-content { padding: 20px !important; }

    .provider-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }
    .provider-identity {
      display: flex; align-items: center; gap: 8px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .provider-name { font-size: 16px; font-weight: 600; }
    .bamboohr-color { color: #7ab648; }
    .hibob-color { color: #5b4fe9; }

    .loading-state { display: flex; justify-content: center; padding: 24px; }
    .empty-state { color: #999; font-size: 13px; padding: 12px 0 16px; }

    .connections-list { margin-bottom: 8px; }
    .connection-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid #f0f0f0;
      &:last-child { border-bottom: none; }
    }
    .connection-info { flex: 1; min-width: 0; }
    .connection-name {
      display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;
      margin-bottom: 2px;
    }
    .mono-chip {
      font-size: 11px; font-family: monospace; color: #555;
      background: #f5f5f5; padding: 2px 7px; border-radius: 10px;
    }
    .status-chip {
      font-size: 11px; padding: 2px 7px; border-radius: 10px; font-weight: 500;
      &.active { background: #e8f5e9; color: #2e7d32; }
      &.inactive { background: #f5f5f5; color: #999; }
    }
    .connection-meta { font-size: 12px; color: #999; }
    .connection-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

    .setup-panel {
      margin-top: 12px; box-shadow: none !important;
      border: 1px solid #eee; border-radius: 6px !important;
      background: #fafafa !important;
    }
    .setup-steps {
      margin: 4px 0 12px; padding-left: 18px;
      li { margin-bottom: 8px; font-size: 13px; line-height: 1.5; color: #444; }
      code { background: #eee; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
    }
    .data-note {
      display: flex; align-items: flex-start; gap: 8px;
      font-size: 12px; color: #777; padding-top: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
    }
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

  get canManage() {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get bamboohrConnections() {
    return this.connections.filter((c) => c.provider === 'bamboohr');
  }

  get hibobConnections() {
    return this.connections.filter((c) => c.provider === 'hibob');
  }

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

  openAddDialog(provider: HrisProvider) {
    this.dialog.open(HrisConnectionDialogComponent, {
      data: { provider, connection: null },
      width: '500px',
    }).afterClosed().subscribe((result: HrisConnection | undefined) => {
      if (result) {
        this.connections = [...this.connections, result];
        this.snackBar.open('Connection added', 'Dismiss', { duration: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  openEditDialog(conn: HrisConnection) {
    this.dialog.open(HrisConnectionDialogComponent, {
      data: { provider: conn.provider, connection: conn },
      width: '500px',
    }).afterClosed().subscribe((result: HrisConnection | undefined) => {
      if (result) {
        this.connections = this.connections.map((c) => (c.id === result.id ? result : c));
        this.snackBar.open('Connection updated', 'Dismiss', { duration: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  testConnection(conn: HrisConnection) {
    this.hrisService.testConnection(conn.id).subscribe({
      next: (r) => { this.snackBar.open(r.message, 'Dismiss', { duration: 6000 }); },
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
