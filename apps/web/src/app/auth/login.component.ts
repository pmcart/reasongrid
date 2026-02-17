import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatInputModule,
    MatButtonModule, MatFormFieldModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-page">
      <div class="login-left">
        <div class="login-card-wrapper">
          <div class="brand">
            <div class="brand-logo">
              <span class="brand-reason">Reason</span><span class="brand-grid">Grid</span>
            </div>
            <span class="brand-tagline">Pay Intelligence</span>
          </div>

          <div class="login-form-section">
            <h1 class="login-title">Welcome back</h1>
            <p class="login-subtitle">Sign in to continue to your workspace</p>

            <form (ngSubmit)="onLogin()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email address</mat-label>
                <input matInput type="email" [(ngModel)]="email" name="email" required
                       [disabled]="loading" autocomplete="email" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password</mat-label>
                <input matInput [type]="hidePassword ? 'password' : 'text'"
                       [(ngModel)]="password" name="password" required
                       [disabled]="loading" autocomplete="current-password" />
                <button mat-icon-button matSuffix type="button"
                        (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              @if (error) {
                <div class="error-message">
                  <mat-icon class="error-icon">error_outline</mat-icon>
                  <span>{{ error }}</span>
                </div>
              }

              <button mat-raised-button color="primary" type="submit"
                      class="full-width login-btn" [disabled]="loading || !email || !password">
                @if (loading) {
                  <mat-spinner diameter="20" class="spinner"></mat-spinner>
                } @else {
                  Sign in
                }
              </button>
            </form>
          </div>
        </div>
      </div>

      <div class="login-right">
        <div class="hero-content">
          <div class="hero-icon-grid">
            <div class="hero-icon-card"><mat-icon>verified_user</mat-icon><span>Defensible</span></div>
            <div class="hero-icon-card"><mat-icon>equalizer</mat-icon><span>Transparent</span></div>
            <div class="hero-icon-card"><mat-icon>gavel</mat-icon><span>Audit-Ready</span></div>
            <div class="hero-icon-card"><mat-icon>trending_up</mat-icon><span>Intelligent</span></div>
          </div>
          <h2 class="hero-title">Structured, defensible pay decisions</h2>
          <p class="hero-text">
            Document compensation rationale with confidence.
            Monitor pay gap risk aligned to EU Pay Transparency requirements.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      height: 100vh;
    }

    .login-left {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 48px;
    }

    .login-card-wrapper {
      width: 100%;
      max-width: 400px;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 48px;
    }

    .brand-logo {
      display: flex;
      align-items: baseline;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .brand-reason {
      color: #2563eb;
    }

    .brand-grid {
      color: #7c3aed;
    }

    .brand-tagline {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
    }

    .login-title {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }

    .login-subtitle {
      font-size: 15px;
      color: #64748b;
      margin: 0 0 32px 0;
    }

    .full-width { width: 100%; }

    .login-btn {
      height: 48px;
      font-size: 15px;
      font-weight: 600;
      margin-top: 8px;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
    }

    .error-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .spinner {
      display: inline-block;
    }

    .login-right {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%);
      padding: 48px;
    }

    .hero-content {
      max-width: 440px;
      color: #ffffff;
    }

    .hero-icon-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 36px;
    }

    .hero-icon-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13px;
      font-weight: 500;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: rgba(255, 255, 255, 0.9);
      }
    }

    .hero-title {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 16px 0;
    }

    .hero-text {
      font-size: 15px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;
  hidePassword = true;

  constructor(private auth: AuthService, private router: Router) {}

  onLogin() {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        if (this.auth.isSuperAdmin()) {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 401) {
          this.error = 'Invalid email or password.';
        } else if (err.status === 0) {
          this.error = 'Unable to reach the server. Please try again.';
        } else {
          this.error = 'An unexpected error occurred. Please try again.';
        }
      },
    });
  }
}
