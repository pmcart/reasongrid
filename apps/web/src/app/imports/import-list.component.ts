import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { ImportService } from './import.service';

@Component({
  selector: 'app-import-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatTableModule, MatIconModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>CSV Imports</h1>
          <p class="page-description">Upload and manage employee data imports</p>
        </div>
        <button mat-raised-button color="primary" (click)="startImport()">
          <mat-icon>cloud_upload</mat-icon>
          Import CSV
        </button>
      </div>

      @if (imports.length > 0) {
        <table mat-table [dataSource]="imports">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>Import ID</th>
            <td mat-cell *matCellDef="let imp">
              <span class="import-id">{{ imp.id | slice:0:8 }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let imp">
              <span class="status-badge" [class]="'status-badge status-' + imp.status.toLowerCase()">
                {{ imp.status }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="createdCount">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let imp">
              <span class="count created">{{ imp.createdCount ?? '—' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="updatedCount">
            <th mat-header-cell *matHeaderCellDef>Updated</th>
            <td mat-cell *matCellDef="let imp">
              <span class="count updated">{{ imp.updatedCount ?? '—' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="errorCount">
            <th mat-header-cell *matHeaderCellDef>Errors</th>
            <td mat-cell *matCellDef="let imp">
              <span class="count" [class.errors]="imp.errorCount > 0">{{ imp.errorCount ?? '—' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let imp">{{ imp.createdAt | date:'medium' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">cloud_upload</mat-icon>
          <p class="empty-state-title">No imports yet</p>
          <p class="empty-state-text">Upload a CSV file to import employee data into the system</p>
          <button mat-raised-button color="primary" (click)="startImport()" style="margin-top: 16px;">
            <mat-icon>add</mat-icon>
            Start Your First Import
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
    }

    .import-id {
      font-family: 'Inter', monospace;
      font-size: 13px;
      color: #64748b;
    }

    .count {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .count.created {
      color: #047857;
    }

    .count.updated {
      color: #1d4ed8;
    }

    .count.errors {
      color: #b91c1c;
    }
  `],
})
export class ImportListComponent implements OnInit {
  imports: any[] = [];
  displayedColumns = ['id', 'status', 'createdCount', 'updatedCount', 'errorCount', 'createdAt'];

  constructor(
    private importService: ImportService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadImports();
  }

  loadImports() {
    this.importService.getImports().subscribe((data) => (this.imports = data));
  }

  startImport() {
    this.router.navigate(['/imports/new']);
  }
}
