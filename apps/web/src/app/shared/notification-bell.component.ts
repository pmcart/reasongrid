import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { NotificationService, AppNotification } from '../core/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatBadgeModule, MatMenuModule, MatDividerModule,
  ],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="notifMenu"
            [matBadge]="unreadCount > 0 ? unreadCount : null"
            matBadgeColor="warn" matBadgeSize="small"
            (click)="loadNotifications()">
      <mat-icon>notifications</mat-icon>
    </button>

    <mat-menu #notifMenu="matMenu" class="notif-menu" xPosition="before">
      <div class="notif-header" (click)="$event.stopPropagation()">
        <span class="notif-title">Notifications</span>
        @if (unreadCount > 0) {
          <button class="mark-all-btn" (click)="markAllRead()">Mark all read</button>
        }
      </div>
      <mat-divider></mat-divider>

      @if (notifications.length === 0) {
        <div class="notif-empty" (click)="$event.stopPropagation()">
          <mat-icon>notifications_none</mat-icon>
          <span>No notifications</span>
        </div>
      }

      @for (n of notifications; track n.id) {
        <button mat-menu-item class="notif-item" [class.unread]="!n.read"
                (click)="onNotificationClick(n)">
          <div class="notif-item-content">
            <mat-icon class="notif-type-icon" [class]="getTypeClass(n.type)">
              {{ getTypeIcon(n.type) }}
            </mat-icon>
            <div class="notif-text">
              <span class="notif-message">{{ n.message }}</span>
              <span class="notif-time">{{ getRelativeTime(n.createdAt) }}</span>
            </div>
            @if (!n.read) {
              <div class="unread-dot"></div>
            }
          </div>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 8px;
    }

    .notif-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    .mark-all-btn {
      border: none;
      background: none;
      color: #4f46e5;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;

      &:hover { background: #eef2ff; }
    }

    .notif-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      color: #94a3b8;
      font-size: 13px;

      mat-icon { font-size: 32px; width: 32px; height: 32px; }
    }

    .notif-item {
      height: auto !important;
      padding: 10px 16px !important;
      line-height: 1.4 !important;
    }

    .notif-item.unread {
      background: #f0f9ff;
    }

    .notif-item-content {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: 320px;
    }

    .notif-type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-top: 2px;
    }

    .notif-type-icon.submitted { color: #3b82f6; }
    .notif-type-icon.approved { color: #16a34a; }
    .notif-type-icon.returned { color: #d97706; }

    .notif-text {
      flex: 1;
      min-width: 0;
    }

    .notif-message {
      display: block;
      font-size: 13px;
      color: #1e293b;
      white-space: normal;
      word-wrap: break-word;
    }

    .notif-time {
      display: block;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      min-width: 8px;
      border-radius: 50%;
      background: #3b82f6;
      margin-top: 6px;
    }
  `],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  notifications: AppNotification[] = [];
  unreadCount = 0;
  private sub?: Subscription;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.sub = this.notificationService.unreadCount.subscribe(
      (count) => (this.unreadCount = count),
    );
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (notifs) => (this.notifications = notifs),
      error: () => {},
    });
  }

  onNotificationClick(n: AppNotification) {
    if (!n.read) {
      this.notificationService.markAsRead(n.id).subscribe();
      n.read = true;
    }
    if (n.entityType === 'PayDecision') {
      this.router.navigate(['/pay-decisions', n.entityId]);
    }
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.notifications.forEach((n) => (n.read = true));
      },
    });
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'DECISION_SUBMITTED_FOR_REVIEW': return 'send';
      case 'DECISION_APPROVED': return 'check_circle';
      case 'DECISION_RETURNED': return 'undo';
      default: return 'notifications';
    }
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'DECISION_SUBMITTED_FOR_REVIEW': return 'submitted';
      case 'DECISION_APPROVED': return 'approved';
      case 'DECISION_RETURNED': return 'returned';
      default: return '';
    }
  }

  getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }
}
