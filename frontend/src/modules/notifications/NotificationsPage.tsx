import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "../../services/api/notifications";

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function resolveLink(item: NotificationItem, role?: string | null) {
  if (item.notification.linkUrl) return item.notification.linkUrl;
  const meta = item.notification.metadata;
  if (meta && typeof meta === "object") {
    const routes = (meta as { routes?: Record<string, string> }).routes;
    if (routes && role && routes[role]) return routes[role];
  }
  return null;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await listNotifications({ page: 1, limit: 50 });
    return res?.items ?? [];
  }, []);

  const unreadCount = useMemo(() => (data ?? []).filter((item) => !item.readAt).length, [data]);

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    refresh();
    queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead(id);
    refresh();
    queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "Inbox and alerts"}
        actions={<Button variant="secondary" onClick={handleMarkAll}>Mark all read</Button>}
      />
      <Card>
        {loading ? (
          <LoadingState label="Loading notifications" />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : data?.length ? (
          <div className="flex flex-col gap-3">
            {data.map((item: NotificationItem) => {
              const link = resolveLink(item, role);
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border px-4 py-3 shadow-soft transition ${item.readAt ? "border-slate-100 bg-white" : "border-sky-200 bg-sky-50/50"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-800">{item.notification.title}</span>
                      {item.notification.category && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {item.notification.category}
                        </span>
                      )}
                      {!item.readAt && (
                        <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                          New
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-ink-400">
                      {formatTime(item.notification.sentAt ?? item.notification.createdAt ?? item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-600">{item.notification.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {link && (
                      <Button variant="secondary" onClick={() => {
                        if (!item.readAt) void handleMarkOne(item.id);
                        navigate(link);
                      }}>
                        View
                      </Button>
                    )}
                    {!item.readAt && (
                      <Button variant="ghost" onClick={() => handleMarkOne(item.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No notifications" description="You're all caught up." />
        )}
      </Card>
    </div>
  );
}
