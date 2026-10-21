// Sample sign-ins that exist ONLY in preview mode (an in-browser copy of the database).
// They are not real people. The live site has no built-in accounts: the owner signs up and is
// made an administrator with one SQL command (see README, "Make yourself the administrator").
import { DEMO_MODE } from "./backend";

export const PREVIEW_ACCOUNTS = DEMO_MODE
  ? [
      { email: "owner@preview.test", password: "preview-owner", name: "Preview Owner", role: "admin" },
      { email: "moderator@preview.test", password: "preview-mod", name: "Preview Moderator", role: "moderator" },
      { email: "alex@preview.test", password: "preview-alex", name: "Alex (sample)", role: "member" },
      { email: "sam@preview.test", password: "preview-sam", name: "Sam (sample)", role: "member" },
    ]
  : [];
