import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { PayDecisionFormComponent } from './pay-decision-form.component';

@Component({
  selector: 'app-pay-decision-edit-dialog',
  standalone: true,
  imports: [MatDialogModule, PayDecisionFormComponent],
  template: `
    <app-pay-decision-form
      [employee]="data.employee"
      [decision]="data.decision"
      (saved)="dialogRef.close($event)"
      (cancelled)="dialogRef.close()">
    </app-pay-decision-form>
  `,
  styles: [`
    :host {
      display: block;
      width: 600px;
    }
  `],
})
export class PayDecisionEditDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PayDecisionEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { employee: any; decision?: any },
  ) {}
}
