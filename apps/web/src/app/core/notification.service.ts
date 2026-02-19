import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: string;
  recipientUserId: string;
  type: string;
  entityType: string;
  entityId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount = this.unreadCount$.asObservable();

  constructor(private api: ApiService, private auth: AuthService) {
    // Poll every 30s when authenticated
    timer(0, 30000).pipe(
      switchMap(() => {
        if (!this.auth.isAuthenticated()) {
          return new Observable<{ count: number }>((sub) => { sub.next({ count: 0 }); sub.complete(); });
        }
        return this.api.get<{ count: number }>('/notifications/unread-count');
      }),
      tap((r) => this.unreadCount$.next(r.count)),
    ).subscribe({ error: () => {} });
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.api.get<AppNotification[]>('/notifications');
  }

  markAsRead(id: string): Observable<AppNotification> {
    return this.api.patch<AppNotification>(`/notifications/${id}/read`, {}).pipe(
      tap(() => this.refreshCount()),
    );
  }

  markAllRead(): Observable<any> {
    return this.api.post('/notifications/mark-all-read', {}).pipe(
      tap(() => this.unreadCount$.next(0)),
    );
  }

  refreshCount() {
    this.api.get<{ count: number }>('/notifications/unread-count').subscribe({
      next: (r) => this.unreadCount$.next(r.count),
      error: () => {},
    });
  }
}
