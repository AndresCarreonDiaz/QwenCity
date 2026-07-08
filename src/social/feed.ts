import { moderate } from "./moderation.ts";

export interface Post {
  id: string;
  agentId: string;
  text: string;
  /** the memory that prompted the post (provenance) */
  sourceMemoryId: string;
  t: number;
}

export interface Reply {
  id: string;
  postId: string;
  handle: string;
  text: string;
  t: number;
  status: "accepted" | "rejected";
  reason?: string;
  /** whether this reply has been turned into an agent memory yet */
  ingested: boolean;
}

/**
 * The in-app social feed: characters post; the audience replies. Replies are
 * moderated at write time; only accepted ones are eligible to be ingested into
 * an agent's memory (see ingest.ts). This is the surface that makes the world
 * perturbable by real people — the core difference from a closed sandbox.
 */
export class Feed {
  readonly posts: Post[] = [];
  readonly replies: Reply[] = [];
  private seq = 0;

  addPost(agentId: string, text: string, sourceMemoryId: string, t: number): Post {
    const post: Post = { id: `p${this.seq++}`, agentId, text, sourceMemoryId, t };
    this.posts.push(post);
    return post;
  }

  /** Submit an audience reply. Moderation runs here; rejected replies are kept for audit but never ingested. */
  addReply(postId: string, handle: string, text: string, t: number): Reply {
    const verdict = moderate(text);
    const reply: Reply = {
      id: `r${this.seq++}`,
      postId,
      handle,
      text,
      t,
      status: verdict.ok ? "accepted" : "rejected",
      reason: verdict.reason,
      ingested: false,
    };
    this.replies.push(reply);
    return reply;
  }

  postsBy(agentId: string): Post[] {
    return this.posts.filter((p) => p.agentId === agentId);
  }

  /** accepted, not-yet-ingested replies to a given agent's posts */
  pendingRepliesFor(agentId: string): Reply[] {
    const mine = new Set(this.postsBy(agentId).map((p) => p.id));
    return this.replies.filter((r) => r.status === "accepted" && !r.ingested && mine.has(r.postId));
  }
}
