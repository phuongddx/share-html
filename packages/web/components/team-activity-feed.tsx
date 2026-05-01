import type { TeamEvent } from "@dropitx/shared/types/team-event";
import {
  getEventIcon,
  getEventColor,
  formatEventDescription,
  formatRelativeTime,
  groupEventsByDate,
} from "@/lib/team-event-utils";

interface TeamActivityFeedProps {
  events: TeamEvent[];
}

export function TeamActivityFeed({ events }: TeamActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No recent activity
      </p>
    );
  }

  const groups = groupEventsByDate(events);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.events.map((event) => {
              const Icon = getEventIcon(event.event_type);
              const color = getEventColor(event.event_type);
              return (
                <div key={event.id} className="flex items-center gap-3 py-1.5">
                  <Icon className={`size-4 shrink-0 ${color}`} />
                  <p className="flex-1 text-sm">
                    {formatEventDescription(event.event_type, event.metadata)}
                  </p>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
