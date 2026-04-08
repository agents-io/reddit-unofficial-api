#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Reddit API helper — executes fetch() in Chrome DevTools context
// Requires: chrome-devtools-mcp running + Reddit tab logged in

const server = new McpServer({
  name: "reddit-unofficial-api",
  version: "0.1.0",
});

// ==================== Configuration ====================

const CHROME_CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";
const RATE_LIMIT_MS = 1500; // delay between write operations
let lastWriteTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastWriteTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastWriteTime = Date.now();
}

// ==================== CDP Communication ====================

interface CDPResult {
  result: { type: string; value?: any; description?: string };
  exceptionDetails?: any;
}

async function cdpCall(method: string, params: Record<string, any> = {}): Promise<any> {
  // Get available targets
  const targetsResp = await fetch(`${CHROME_CDP_URL}/json`);
  const targets = await targetsResp.json();

  // Find Reddit tab
  const redditTab = targets.find((t: any) =>
    t.type === "page" && t.url?.includes("reddit.com")
  );

  if (!redditTab) {
    throw new Error("No Reddit tab found in Chrome. Open reddit.com and log in first.");
  }

  // Connect via WebSocket
  const ws = new WebSocket(redditTab.webSocketDebuggerUrl);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("CDP call timed out after 30s"));
    }, 30000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString());
      if (data.id === 1) {
        clearTimeout(timeout);
        ws.close();
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve(data.result);
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(new Error(`CDP WebSocket error: ${err}`));
    };
  });
}

async function evalInReddit(script: string): Promise<any> {
  const result = await cdpCall("Runtime.evaluate", {
    expression: script,
    awaitPromise: true,
    returnByValue: true,
  }) as CDPResult;

  if (result.exceptionDetails) {
    throw new Error(`Reddit eval error: ${result.exceptionDetails.text || result.result?.description}`);
  }
  return result.result?.value;
}

// ==================== Reddit API Helpers ====================

async function getModhash(): Promise<string> {
  const result = await evalInReddit(`
    (async () => {
      const resp = await fetch('https://www.reddit.com/api/me.json', { credentials: 'include' });
      const data = await resp.json();
      return data.data?.modhash || '';
    })()
  `);
  if (!result) throw new Error("Could not get modhash. Are you logged in to Reddit?");
  return result;
}

async function redditGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = `https://www.reddit.com${path}${qs ? '?' + qs : ''}`;

  return evalInReddit(`
    (async () => {
      const resp = await fetch('${url}', { credentials: 'include' });
      if (!resp.ok) return { error: resp.status, statusText: resp.statusText };
      return await resp.json();
    })()
  `);
}

async function redditPost(path: string, params: Record<string, string>): Promise<any> {
  await rateLimit();
  const modhash = await getModhash();
  params.uh = modhash;
  params.api_type = "json";

  const body = new URLSearchParams(params).toString();

  return evalInReddit(`
    (async () => {
      const resp = await fetch('https://www.reddit.com${path}', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '${body.replace(/'/g, "\\'")}'
      });
      const text = await resp.text();
      try { return JSON.parse(text); } catch(e) { return { error: 'parse_error', raw: text.substring(0, 500) }; }
    })()
  `);
}

// ==================== MCP Tools ====================

// --- Read Operations ---

server.tool(
  "reddit_me",
  "Get current logged-in Reddit user info",
  {},
  async () => {
    const data = await redditGet("/api/me.json");
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

server.tool(
  "reddit_get_post",
  "Get a Reddit post and its comments",
  {
    url: z.string().describe("Reddit post URL or post ID (e.g. '1sdv3lo')"),
    sort: z.enum(["top", "new", "best", "controversial", "old", "qa"]).default("top").describe("Comment sort order"),
    limit: z.number().default(100).describe("Max comments to return"),
  },
  async ({ url, sort, limit }) => {
    // Extract post ID from URL
    const match = url.match(/comments\/([a-z0-9]+)/);
    const postId = match ? match[1] : url;

    const data = await redditGet(`/comments/${postId}.json`, { sort, limit: String(limit) });

    if (Array.isArray(data) && data.length >= 2) {
      const post = data[0]?.data?.children?.[0]?.data;
      const comments = data[1]?.data?.children?.map((c: any) => c.data) || [];
      return { content: [{ type: "text", text: JSON.stringify({ post, comments }, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "reddit_get_comments",
  "Get all comments for a post as a flat list with author, body, score, and parent info",
  {
    url: z.string().describe("Reddit post URL or post ID"),
    sort: z.enum(["top", "new", "best", "controversial", "old", "qa"]).default("top"),
  },
  async ({ url, sort }) => {
    const match = url.match(/comments\/([a-z0-9]+)/);
    const postId = match ? match[1] : url;

    const data = await redditGet(`/comments/${postId}.json`, { sort, limit: "500" });

    if (!Array.isArray(data) || data.length < 2) {
      return { content: [{ type: "text", text: "Could not fetch comments" }] };
    }

    // Flatten comment tree
    const flat: any[] = [];
    function extract(children: any[], depth: number = 0) {
      for (const child of children) {
        if (child.kind !== "t1") continue;
        const c = child.data;
        flat.push({
          id: c.name,
          author: c.author,
          body: c.body,
          score: c.score,
          parent_id: c.parent_id,
          depth,
          created_utc: c.created_utc,
        });
        if (c.replies?.data?.children) {
          extract(c.replies.data.children, depth + 1);
        }
      }
    }
    extract(data[1].data.children);

    return { content: [{ type: "text", text: JSON.stringify(flat, null, 2) }] };
  }
);

server.tool(
  "reddit_get_user",
  "Get a Reddit user's profile, posts, or comments",
  {
    username: z.string().describe("Reddit username"),
    type: z.enum(["about", "overview", "submitted", "comments"]).default("about"),
    limit: z.number().default(25),
  },
  async ({ username, type, limit }) => {
    const path = type === "about"
      ? `/user/${username}/about.json`
      : `/user/${username}/${type}.json`;
    const data = await redditGet(path, { limit: String(limit) });
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

server.tool(
  "reddit_get_subreddit",
  "Get subreddit info, rules, or posts",
  {
    subreddit: z.string().describe("Subreddit name (without r/)"),
    type: z.enum(["about", "rules", "hot", "new", "top", "rising"]).default("hot"),
    limit: z.number().default(25),
    time: z.enum(["hour", "day", "week", "month", "year", "all"]).default("day").describe("Time filter for top/controversial"),
  },
  async ({ subreddit, type, limit, time }) => {
    const path = ["about", "rules"].includes(type)
      ? `/r/${subreddit}/about/${type === "about" ? "" : "rules"}.json`
      : `/r/${subreddit}/${type}.json`;
    const data = await redditGet(path, { limit: String(limit), t: time });
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

server.tool(
  "reddit_search",
  "Search Reddit posts",
  {
    query: z.string().describe("Search query"),
    subreddit: z.string().optional().describe("Limit to subreddit (optional)"),
    sort: z.enum(["relevance", "hot", "top", "new", "comments"]).default("relevance"),
    time: z.enum(["hour", "day", "week", "month", "year", "all"]).default("all"),
    limit: z.number().default(25),
  },
  async ({ query, subreddit, sort, time, limit }) => {
    const path = subreddit
      ? `/r/${subreddit}/search.json`
      : `/search.json`;
    const params: Record<string, string> = { q: query, sort, t: time, limit: String(limit) };
    if (subreddit) params.restrict_sr = "on";
    const data = await redditGet(path, params);
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

server.tool(
  "reddit_get_inbox",
  "Get Reddit messages (inbox, unread, or sent)",
  {
    type: z.enum(["inbox", "unread", "sent"]).default("unread"),
    limit: z.number().default(25),
  },
  async ({ type, limit }) => {
    const data = await redditGet(`/message/${type}.json`, { limit: String(limit) });
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

// --- Write Operations ---

server.tool(
  "reddit_comment",
  "Reply to a Reddit post or comment",
  {
    thing_id: z.string().describe("Fullname of parent (t1_ for comment, t3_ for post)"),
    text: z.string().describe("Comment text (markdown supported)"),
  },
  async ({ thing_id, text }) => {
    const result = await redditPost("/api/comment", { thing_id, text });
    const success = !result.json?.errors?.length;
    const commentId = result.json?.data?.things?.[0]?.data?.id;
    return {
      content: [{ type: "text", text: JSON.stringify({ success, commentId, errors: result.json?.errors }) }]
    };
  }
);

server.tool(
  "reddit_submit",
  "Create a new Reddit post",
  {
    subreddit: z.string().describe("Subreddit name (without r/)"),
    title: z.string().describe("Post title"),
    kind: z.enum(["self", "link"]).describe("Post type: self (text) or link"),
    text: z.string().optional().describe("Post body text (for self posts)"),
    url: z.string().optional().describe("URL (for link posts)"),
    flair_id: z.string().optional().describe("Flair template ID"),
    flair_text: z.string().optional().describe("Flair text"),
    nsfw: z.boolean().default(false),
    spoiler: z.boolean().default(false),
  },
  async ({ subreddit, title, kind, text, url, flair_id, flair_text, nsfw, spoiler }) => {
    const params: Record<string, string> = { sr: subreddit, title, kind };
    if (text) params.text = text;
    if (url) params.url = url;
    if (flair_id) params.flair_id = flair_id;
    if (flair_text) params.flair_text = flair_text;
    if (nsfw) params.nsfw = "true";
    if (spoiler) params.spoiler = "true";
    params.sendreplies = "true";
    params.resubmit = "true";

    const result = await redditPost("/api/submit", params);
    return { content: [{ type: "text", text: JSON.stringify(result.json || result, null, 2) }] };
  }
);

server.tool(
  "reddit_vote",
  "Upvote, downvote, or unvote on a post or comment",
  {
    thing_id: z.string().describe("Fullname (t1_ or t3_)"),
    direction: z.enum(["up", "down", "unvote"]).describe("Vote direction"),
  },
  async ({ thing_id, direction }) => {
    const dir = direction === "up" ? "1" : direction === "down" ? "-1" : "0";
    const result = await redditPost("/api/vote", { id: thing_id, dir });
    return { content: [{ type: "text", text: JSON.stringify({ success: true, direction }) }] };
  }
);

server.tool(
  "reddit_save",
  "Save or unsave a Reddit post or comment",
  {
    thing_id: z.string().describe("Fullname (t1_ or t3_)"),
    unsave: z.boolean().default(false).describe("Set true to unsave"),
  },
  async ({ thing_id, unsave }) => {
    const path = unsave ? "/api/unsave" : "/api/save";
    await redditPost(path, { id: thing_id });
    return { content: [{ type: "text", text: JSON.stringify({ success: true, action: unsave ? "unsaved" : "saved" }) }] };
  }
);

server.tool(
  "reddit_send_message",
  "Send a Reddit private message",
  {
    to: z.string().describe("Username to send to"),
    subject: z.string().describe("Message subject"),
    text: z.string().describe("Message body"),
  },
  async ({ to, subject, text }) => {
    const result = await redditPost("/api/compose", { to, subject, text });
    return { content: [{ type: "text", text: JSON.stringify(result.json || result, null, 2) }] };
  }
);

server.tool(
  "reddit_edit",
  "Edit your own post or comment",
  {
    thing_id: z.string().describe("Fullname of your post/comment to edit"),
    text: z.string().describe("New text content"),
  },
  async ({ thing_id, text }) => {
    const result = await redditPost("/api/editusertext", { thing_id, text });
    return { content: [{ type: "text", text: JSON.stringify(result.json || result, null, 2) }] };
  }
);

server.tool(
  "reddit_delete",
  "Delete your own post or comment",
  {
    thing_id: z.string().describe("Fullname of your post/comment to delete"),
  },
  async ({ thing_id }) => {
    await redditPost("/api/del", { id: thing_id });
    return { content: [{ type: "text", text: JSON.stringify({ success: true, deleted: thing_id }) }] };
  }
);

server.tool(
  "reddit_subscribe",
  "Subscribe or unsubscribe to a subreddit",
  {
    subreddit: z.string().describe("Subreddit name"),
    unsubscribe: z.boolean().default(false),
  },
  async ({ subreddit, unsubscribe }) => {
    const action = unsubscribe ? "unsub" : "sub";
    await redditPost("/api/subscribe", { action, sr_name: subreddit });
    return { content: [{ type: "text", text: JSON.stringify({ success: true, action, subreddit }) }] };
  }
);

// --- Utility ---

server.tool(
  "reddit_ensure_session",
  "Check if Reddit tab is open and user is logged in",
  {},
  async () => {
    try {
      const data = await redditGet("/api/me.json");
      const username = data.data?.name;
      if (username) {
        return { content: [{ type: "text", text: `Logged in as u/${username}` }] };
      }
      return { content: [{ type: "text", text: "Reddit tab found but not logged in. Please log in to Reddit in Chrome." }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}. Make sure Chrome is open with Reddit loaded.` }] };
    }
  }
);

// ==================== Start Server ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("reddit-unofficial-api MCP server running");
}

main().catch(console.error);
