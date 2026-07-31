/**
 * Communications Domain Module - Repository
 */

import { createServiceClient } from '@/lib/supabase/service';
import type {
  Notification,
  CreateNotificationInput,
  GetNotificationsFilters,
} from './types';

function getDb(client?: any) {
  if (client) return client;
  return createServiceClient();
}

/**
 * Create a new notification record in the database.
 */
export async function createNotification(
  input: CreateNotificationInput,
  client?: any
): Promise<Notification> {
  const db = getDb(client);

  const payload: Record<string, any> = {
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    read: input.read ?? false,
    metadata: input.metadata ?? {},
  };

  if (input.category) {
    payload.category = input.category;
  }
  if (input.delivery_status) {
    payload.delivery_status = input.delivery_status;
  }
  if (input.delivery_attempts !== undefined) {
    payload.delivery_attempts = input.delivery_attempts;
  }
  if (input.delivered_at) {
    payload.delivered_at = input.delivered_at;
  }
  if (input.related_entity_type) {
    payload.related_entity_type = input.related_entity_type;
  }
  if (input.related_entity_id) {
    payload.related_entity_id = input.related_entity_id;
  }

  const { data, error } = await db
    .from('notifications')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    // Fallback if extended schema columns do not exist
    if (
      error.message?.includes('column') ||
      error.code === 'PGRST204' ||
      error.code === '42703'
    ) {
      const basicPayload = {
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        message: input.message,
        read: input.read ?? false,
        metadata: {
          ...(input.metadata ?? {}),
          category: input.category,
        },
      };
      const { data: basicData, error: basicError } = await db
        .from('notifications')
        .insert(basicPayload)
        .select('*')
        .single();

      if (basicError) {
        throw new Error(`Failed to create notification: ${basicError.message}`);
      }
      return basicData as Notification;
    }
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as Notification;
}

/**
 * Get notifications for a user with optional filters (read, type, limit, offset).
 */
export async function getNotifications(
  userId: string,
  filters: GetNotificationsFilters = {},
  client?: any
): Promise<{ notifications: Notification[]; total: number }> {
  const db = getDb(client);

  let query = db
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (filters.read !== undefined) {
    query = query.eq('read', filters.read);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit !== undefined || filters.offset !== undefined) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return {
    notifications: (data || []) as Notification[],
    total: count ?? data?.length ?? 0,
  };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  id: string,
  userId?: string,
  client?: any
): Promise<Notification | null> {
  const db = getDb(client);

  let query = db
    .from('notifications')
    .update({
      read: true,
      delivery_status: 'read',
    })
    .eq('id', id);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select('*').maybeSingle();

  if (error) {
    if (error.message?.includes('column') || error.code === '42703') {
      let retryQuery = db
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (userId) {
        retryQuery = retryQuery.eq('user_id', userId);
      }

      const { data: retryData, error: retryError } = await retryQuery
        .select('*')
        .maybeSingle();

      if (retryError) {
        throw new Error(`Failed to mark notification as read: ${retryError.message}`);
      }
      return retryData as Notification | null;
    }
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  return data as Notification | null;
}

/**
 * Mark all unread notifications for a user as read.
 */
export async function markAllAsRead(
  userId: string,
  client?: any
): Promise<{ updatedCount: number }> {
  const db = getDb(client);

  const { data, error } = await db
    .from('notifications')
    .update({
      read: true,
      delivery_status: 'read',
    })
    .eq('user_id', userId)
    .eq('read', false)
    .select('id');

  if (error) {
    if (error.message?.includes('column') || error.code === '42703') {
      const { data: retryData, error: retryError } = await db
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
        .select('id');

      if (retryError) {
        throw new Error(`Failed to mark all notifications as read: ${retryError.message}`);
      }
      return { updatedCount: retryData?.length || 0 };
    }
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }

  return { updatedCount: data?.length || 0 };
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(
  userId: string,
  client?: any
): Promise<number> {
  const db = getDb(client);

  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }

  return count ?? 0;
}
