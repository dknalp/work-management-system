export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Task assigned",
    body: "You have been assigned to \"Redesign onboarding flow\" by Sarah Chen.",
    read: false,
    createdAt: "2026-05-07T08:15:00.000Z",
  },
  {
    id: "n2",
    title: "Deadline approaching",
    body: "\"Q2 Marketing Report\" is due in 24 hours.",
    read: false,
    createdAt: "2026-05-07T07:00:00.000Z",
  },
  {
    id: "n3",
    title: "Comment added",
    body: "Alex Rivera commented on \"API integration spec\": \"Left some notes on section 3.\"",
    read: false,
    createdAt: "2026-05-06T16:42:00.000Z",
  },
  {
    id: "n4",
    title: "Task completed",
    body: "Jordan Kim marked \"Set up CI pipeline\" as complete.",
    read: true,
    createdAt: "2026-05-06T14:10:00.000Z",
  },
  {
    id: "n5",
    title: "New file uploaded",
    body: "Maya Patel uploaded \"brand-guidelines-v3.pdf\" to the project files.",
    read: false,
    createdAt: "2026-05-06T11:30:00.000Z",
  },
  {
    id: "n6",
    title: "Status changed",
    body: "\"Mobile app release\" moved from In Progress to Review.",
    read: true,
    createdAt: "2026-05-05T17:55:00.000Z",
  },
  {
    id: "n7",
    title: "Mentioned in comment",
    body: "Sam Torres mentioned you in \"Sprint planning notes\": \"@you can you take the lead on this?\"",
    read: true,
    createdAt: "2026-05-05T09:20:00.000Z",
  },
  {
    id: "n8",
    title: "Task overdue",
    body: "\"Write unit tests for auth module\" is 2 days overdue.",
    read: false,
    createdAt: "2026-05-04T08:00:00.000Z",
  },
];