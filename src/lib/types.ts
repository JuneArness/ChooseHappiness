export type Role = "member" | "moderator" | "admin";
export type SupportStatus = "online" | "offline" | "unavailable";

export interface Site {
  site_name: string; tagline: string; founders: string; timezone: string; contact_email: string;
  logo_url: string; hero_image_url: string;
  support_status: SupportStatus; support_hours: string; support_response_time: string;
  peer_chat_enabled: boolean; community_open: boolean; review_first_posts: boolean;
  community_monitoring_note: string; message_retention_days: number; high_risk_terms: string[];
  external_links: { label: string; url: string }[]; updated_at: string;
}

export interface Source { title: string; publisher?: string; year?: string; url: string; }

export interface Topic { slug: string; pillar: "wellness" | "perspective"; title: string; summary: string; icon: string; sort: number; article_count?: number; }

export interface ArticleCard {
  id: string; slug: string; title: string; summary: string; pillar: "wellness" | "perspective";
  kind: "article" | "exercise" | "research" | "worksheet"; topic_slug: string | null; reading_minutes: number;
  sensitive: boolean; featured: boolean; published: boolean; image_url: string; tags: string[]; updated_at: string;
  reviewed_by_professional: boolean;
}

export interface ExerciseStep {
  id: string; prompt: string; help?: string; type: "text" | "choice" | "scale";
  options?: string[]; min?: number; max?: number; label_min?: string; label_max?: string;
}

export interface Article extends ArticleCard {
  body: string; intro: string; example: string; closing: string; steps: ExerciseStep[];
  takeaways: string[]; prompts: string[]; exercise: string; sources: Source[]; related: string[];
  content_note: string; professional_note: string; evidence_note: string; author: string;
  published_at: string | null; topic: Topic | null; related_cards: ArticleCard[];
}

export interface Page { slug: string; title: string; summary: string; body: string; needs_professional_review: boolean; published: boolean; updated_at: string; }
export interface Prompt { id: string; text: string; scheduled_for?: string | null; active?: boolean; }

export interface JourneyStep { title: string; body: string; action: "read" | "reflect" | "pause" | "reach-out" | "plan"; link_slug?: string; reflect_prompt?: string; }
export interface Journey { slug: string; title: string; summary: string; minutes: number; steps: JourneyStep[]; published: boolean; }

export interface Author { id: string | null; name: string; role: Role; }
export interface Category { slug: string; name: string; description: string; sort: number; active: boolean; thread_count?: number; following?: boolean; }

export type PostStatus = "published" | "pending" | "removed";
export interface Reactions { counts: Partial<Record<ReactionKind, number>>; mine: ReactionKind[]; }
export type ReactionKind = "support" | "relate" | "thanks";

export interface ThreadCard {
  id: string; category_slug: string; title: string; excerpt: string; content_warning: string; status: PostStatus;
  hold_reason: string; reply_count: number; created_at: string; last_activity_at: string; author: Author; mine: boolean;
}
export interface Reply { id: string; body: string; content_warning: string; status: PostStatus; hold_reason: string; created_at: string; edited_at: string | null; author: Author; mine: boolean; reactions: Reactions; }
export interface Thread extends ThreadCard { body: string; edited_at: string | null; reactions: Reactions; category: Category | null; bookmarked: boolean; replies: Reply[]; }

export interface PostResult { id: string; status: PostStatus; hold_reason: string; }

export interface Me {
  id: string; display_name: string; bio: string; role: Role; status: "active" | "suspended" | "banned"; suspended_until: string | null;
  notify_replies: boolean; notify_messages: boolean; email_notifications: boolean; allow_peer_messages: boolean;
  created_at: string; unread: number; is_staff: boolean;
}

export interface Notification { id: string; kind: string; text: string; link: string; created_at: string; read_at: string | null; }

export interface Message { id: string; body: string; removed: boolean; from_staff: boolean; created_at: string; mine: boolean; sender: Author; }
export interface Conversation {
  id: string; kind: "support" | "peer"; subject: string; status: "open" | "closed"; created_at: string; last_message_at: string;
  created_by: Author; members: Author[]; unread: number; messages?: Message[];
}

export interface JournalEntry { id: string; entry_date: string; title: string; body: string; prompt: string; source: "journal" | "reflection" | "exercise" | "journey"; source_ref: string; created_at: string; updated_at: string; }
export interface SavedItem { item_type: "article" | "exercise" | "journey" | "thread"; item_ref: string; status: "saved" | "completed"; created_at: string; }

export interface Report {
  id: string; target_type: "thread" | "reply" | "message" | "user"; target_id: string; reason: string; details: string;
  priority: "high" | "normal"; status: string; created_at: string; reporter: Author;
}
export interface Appeal { id: string; about: string; message: string; status: "open" | "upheld" | "reversed"; response: string; created_at: string; member?: Author; }
export interface PendingReply { id: string; thread_id: string; body: string; hold_reason: string; created_at: string; author: Author; thread_title: string; }
export interface ModQueue { pending_threads: (ThreadCard & { body: string })[]; pending_replies: PendingReply[]; reports: Report[]; appeals: Appeal[]; }
export interface Member { id: string; display_name: string; role: Role; status: string; suspended_until: string | null; created_at: string; post_count: number; open_reports: number; }
export interface LogEntry { id: number; action: string; target_type: string; target_id: string; reason: string; created_at: string; actor: Author; }
export interface Stats {
  published_articles: number; draft_articles: number; members: number; new_members_30d: number; threads_30d: number; replies_30d: number;
  active_discussions_7d: number; pending_posts: number; open_reports: number; urgent_reports: number; open_appeals: number; open_support: number;
}
export interface EvidenceItem { topic: string; finding: string; strength: string; limitation: string; source_title: string; source_url: string; }
