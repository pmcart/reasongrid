import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

export interface UserDialogData {
  mode: 'create' | 'edit';
  email?: string;
  role?: string;
}

export interface UserDialogResult {
  email: string;
  password?: string;
  role: string;
}

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'VIEWER', label: 'Viewer' },
];

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Add User' : 'Edit User' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email</mat-label>
        <input matInput type="email" [(ngModel)]="email" required />
      </mat-form-field>
      @if (data.mode === 'create') {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput type="password" [(ngModel)]="password" required />
          <mat-hint>Minimum 8 characters</mat-hint>
        </mat-form-field>
      }
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Role</mat-label>
        <mat-select [(ngModel)]="role" required>
          @for (r of roles; track r.value) {
            <mat-option [value]="r.value">{{ r.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="save()">
        {{ data.mode === 'create' ? 'Create' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    mat-dialog-content { display: flex; flex-direction: column; gap: 8px; min-width: 400px; }
  `],
})
export class UserDialogComponent {
  email: string;
  password = '';
  role: string;
  roles = ROLES;

  constructor(
    private dialogRef: MatDialogRef<UserDialogComponent, UserDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: UserDialogData,
  ) {
    this.email = data.email || '';
    this.role = data.role || 'VIEWER';
  }

  isValid(): boolean {
    if (!this.email || !this.role) return false;
    if (this.data.mode === 'create' && this.password.length < 8) return false;
    return true;
  }

  save() {
    const result: UserDialogResult = { email: this.email, role: this.role };
    if (this.data.mode === 'create') {
      result.password = this.password;
    }
    this.dialogRef.close(result);
  }
}
