# Reddit Unofficial API — MCP Server Spec

## What is this?

A free Reddit API that works through your browser session. No API keys, no OAuth app registration, no monthly fees. Just Chrome DevTools MCP + a logged-in Reddit tab.

## How it works

1. User has Chrome open with Reddit logged in
2. Chrome DevTools MCP connects to the browser
3. This MCP server uses Chrome DevTools to execute `fetch()` calls in the Reddit page context
4. Reddit's session cookies authenticate everything automatically
5. AI assistant gets full Reddit API access through MCP tools

## Architecture

```
Claude/AI ──> reddit-unofficial-api MCP ──> Chrome DevTools MCP ──> Chrome (Reddit tab) ──> Reddit API
```

The MCP server is a thin wrapper that:
- Gets modhash (CSRF token) automatically before write operations
- Formats requests for Reddit's internal API endpoints
- Parses responses into clean JSON
- Handles rate limiting and retries

## MCP Tools

### Read Operations

| Tool | Description |
|------|-------------|
| `reddit_get_post` | Get a post and its comments by URL or ID |
| `reddit_get_comments` | Get all comments for a post (full tree, nested) |
| `reddit_get_user` | Get user profile, posts, or comments |
| `reddit_get_subreddit` | Get subreddit info, rules, posts |
| `reddit_search` | Search posts across Reddit or within a subreddit |
| `reddit_get_inbox` | Get messages (inbox, unread, sent) |
| `reddit_get_subscriptions` | Get user's subscribed subreddits |

### Write Operations

| Tool | Description |
|------|-------------|
| `reddit_comment` | Reply to a post or comment |
| `reddit_submit` | Create a new post (text or link) |
| `reddit_vote` | Upvote, downvote, or unvote |
| `reddit_save` | Save/unsave a post or comment |
| `reddit_send_message` | Send a private message |
| `reddit_edit` | Edit your own post or comment |
| `reddit_delete` | Delete your own post or comment |
| `reddit_subscribe` | Subscribe/unsubscribe to a subreddit |

### Utility

| Tool | Description |
|------|-------------|
| `reddit_me` | Get current logged-in user info |
| `reddit_ensure_session` | Verify Reddit tab is open and logged in |

## Prerequisites

- Chrome browser with Reddit logged in (any tab)
- Chrome DevTools MCP server running
- This MCP server configured in Claude Code / AI client

## Rate Limits

Browser session requests have undocumented but generous rate limits (normal user behavior). The server adds 1s delay between write operations to be safe.

## Not included (out of scope)

- Moderation tools (approve, remove, ban, etc.) — too dangerous for AI
- Account management (password, email, deactivate) — too dangerous
- Subreddit creation/configuration — rare use case
- Award/gilding — costs money
