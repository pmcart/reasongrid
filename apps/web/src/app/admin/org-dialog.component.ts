import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface OrgDialogData {
  mode: 'create' | 'edit';
  name?: string;
  slug?: string;
}

export interface OrgDialogResult {
  name: string;
  slug: string;
}

@Component({
  selector: 'app-org-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Create Organization' : 'Edit Organization' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Organization Name</mat-label>
        <input matInput [(ngModel)]="name" (ngModelChange)="onNameChange()" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Slug</mat-label>
        <input matInput [(ngModel)]="slug" required />
        <mat-hint>Lowercase letters, numbers, and hyphens only</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!name || !slug" (click)="save()">
        {{ data.mode === 'create' ? 'Create' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    mat-dialog-content { display: flex; flex-direction: column; gap: 8px; min-width: 400px; }
  `],
})
export class OrgDialogComponent {
  name: string;
  slug: string;
  private autoSlug = true;

  constructor(
    private dialogRef: MatDialogRef<OrgDialogComponent, OrgDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: OrgDialogData,
  ) {
    this.name = data.name || '';
    this.slug = data.slug || '';
    if (data.mode === 'edit') {
      this.autoSlug = false;
    }
  }

  onNameChange() {
    if (this.autoSlug && this.data.mode === 'create') {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  }

  save() {
    this.dialogRef.close({ name: this.name, slug: this.slug });
  }
}
