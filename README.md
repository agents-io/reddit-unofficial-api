# Reddit Unofficial API — MCP Server

Free Reddit API. No API keys, no OAuth registration, no monthly fees.

All you need is Chrome with Reddit logged in, and Chrome DevTools Protocol enabled.

## How it works

This MCP server talks to Reddit through your browser session. When you're logged into Reddit in Chrome, your browser already has all the authentication it needs. This server simply executes `fetch()` calls in your Reddit tab's context, using the same cookies your browser uses.

```
AI Assistant → this MCP server → Chrome DevTools Protocol → your Reddit tab → Reddit's internal API
```

Reddit's internal API (the same endpoints their website uses) gives you everything: read posts, write comments, vote, search, send messages, manage subscriptions. All free, all through your existing session.

## Setup

### 1. Start Chrome with DevTools Protocol enabled

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### 2. Log into Reddit in Chrome

Just open reddit.com and log in normally.

### 3. Add to your MCP config

```json
{
  "mcpServers": {
    "reddit": {
      "command": "node",
      "args": ["/path/to/reddit-unofficial-api/build/index.js"],
      "env": {
        "CHROME_CDP_URL": "http://localhost:9222"
      }
    }
  }
}
```

### 4. Build

```bash
cd reddit-unofficial-api
npm install
npm run build
```

## Available Tools

### Read (no rate limit concerns)

| Tool | What it does |
|------|-------------|
| `reddit_me` | Who am I? Get your user info |
| `reddit_get_post` | Get a post and its comments |
| `reddit_get_comments` | Get all comments as a flat list (great for analysis) |
| `reddit_get_user` | Look up any user's profile, posts, or comments |
| `reddit_get_subreddit` | Get subreddit info, rules, or browse posts |
| `reddit_search` | Search across Reddit or within a subreddit |
| `reddit_get_inbox` | Read your messages |

### Write (1.5s rate limit between calls)

| Tool | What it does |
|------|-------------|
| `reddit_comment` | Reply to any post or comment |
| `reddit_submit` | Create a new post (text or link) |
| `reddit_vote` | Upvote, downvote, or unvote |
| `reddit_save` | Save/unsave posts or comments |
| `reddit_send_message` | Send a private message |
| `reddit_edit` | Edit your own content |
| `reddit_delete` | Delete your own content |
| `reddit_subscribe` | Join or leave a subreddit |

### Utility

| Tool | What it does |
|------|-------------|
| `reddit_ensure_session` | Verify everything is connected and you're logged in |

## Why not just use the official Reddit API?

Reddit killed free API access in 2023. The official API now requires app registration, OAuth flows, and has strict rate limits. If you're building something for personal use with your own account, jumping through those hoops makes no sense.

This approach uses the exact same endpoints Reddit's own website uses. Your browser is already authenticated. We just let your AI assistant use that same session.

## Limitations

- Needs Chrome running with DevTools Protocol (port 9222)
- Needs you to be logged into Reddit in that Chrome instance
- One Reddit account at a time (whichever is logged in)
- Rate limits are undocumented but generous for normal use
- Not suitable for high-volume scraping or bot armies (and you shouldn't do that anyway)
