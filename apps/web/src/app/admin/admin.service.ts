import { Injectable } from '@angular/core';
import { ApiService } from '../core/api.service';

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  orgCount: number;
  userCount: number;
  employeeCount: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private api: ApiService) {}

  getOrganizations() {
    return this.api.get<AdminOrg[]>('/admin/organizations');
  }

  getOrganization(id: string) {
    return this.api.get<AdminOrg>(`/admin/organizations/${id}`);
  }

  createOrganization(data: { name: string; slug: string }) {
    return this.api.post<AdminOrg>('/admin/organizations', data);
  }

  updateOrganization(id: string, data: { name?: string; slug?: string }) {
    return this.api.patch<AdminOrg>(`/admin/organizations/${id}`, data);
  }

  deleteOrganization(id: string) {
    return this.api.delete(`/admin/organizations/${id}`);
  }

  getOrganizationUsers(orgId: string) {
    return this.api.get<AdminUser[]>(`/admin/organizations/${orgId}/users`);
  }

  createUser(orgId: string, data: { email: string; password: string; role: string }) {
    return this.api.post<AdminUser>(`/admin/organizations/${orgId}/users`, data);
  }

  updateUser(userId: string, data: { email?: string; role?: string }) {
    return this.api.patch<AdminUser>(`/admin/users/${userId}`, data);
  }

  deleteUser(userId: string) {
    return this.api.delete(`/admin/users/${userId}`);
  }

  resetPassword(userId: string, password: string) {
    return this.api.post(`/admin/users/${userId}/reset-password`, { password });
  }

  getStats() {
    return this.api.get<AdminStats>('/admin/stats');
  }
}
