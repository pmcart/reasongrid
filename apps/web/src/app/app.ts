import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/auth.service';
import { NotificationBellComponent } from './shared/notification-bell.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatListModule, MatTooltipModule,
    NotificationBellComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  expandedGroups: Record<string, boolean> = {
    people: true,
    compensation: false,
    compliance: false,
    analytics: false,
  };

  constructor(public auth: AuthService, private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.expandGroupForRoute(e.urlAfterRedirects));
  }

  toggleGroup(group: string) {
    this.expandedGroups[group] = !this.expandedGroups[group];
  }

  logout() {
    this.auth.logout();
  }

  private expandGroupForRoute(url: string) {
    const groupRoutes: Record<string, string[]> = {
      people: ['/employees', '/imports'],
      compensation: ['/rationale-library', '/settings/salary-ranges', '/settings/policy-rules'],
      compliance: ['/compliance', '/classification'],
      analytics: ['/risk', '/audit'],
    };
    for (const [group, prefixes] of Object.entries(groupRoutes)) {
      if (prefixes.some((p) => url.startsWith(p))) {
        this.expandedGroups[group] = true;
      }
    }
  }
}
