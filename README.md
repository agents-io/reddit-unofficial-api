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

## What can you do with this?

### Community Management
- **Monitor your posts**: "check my PokeClaw post for new comments that need replies" → scrapes all comments, categorizes them (bug report, question, feature request, positive feedback), drafts replies, you approve, it posts
- **Batch reply**: reply to 10+ comments in one go with personalized responses, auto-verified to make sure each reply goes to the right person
- **Update your posts**: edit the body of an existing post to add changelogs, new links, or corrections

### Research & Competitive Intelligence
- **Search Reddit**: find all posts mentioning your product, a competitor, or a topic across any subreddit
- **User research**: look up anyone's post history, comment history, karma breakdown
- **Subreddit discovery**: find relevant subreddits for your niche, check their rules before posting

### Content & Marketing
- **Cross-post to multiple subreddits**: draft a post, you approve, submit to r/LocalLLaMA, r/androiddev, r/machinelearning, etc.
- **Track engagement**: check which of your posts/comments are getting upvoted or replied to
- **Save interesting threads**: bookmark posts and comments for later reference

### Inbox & Messaging
- **Read DMs**: check if anyone messaged you about your project
- **Send DMs**: reach out to users who want to contribute or reported bugs
- **Mark as read**: clean up your inbox

### Engagement
- **Upvote helpful feedback**: upvote users who gave useful bug reports or feature suggestions
- **Subscribe to subreddits**: join relevant communities from your AI assistant

### Deep Research
- **Topic deep-dive**: "research what Reddit thinks about on-device LLM apps" → searches multiple subreddits, reads top posts and comment threads, summarizes sentiment, common complaints, feature requests, and what users actually want
- **Competitor analysis**: "what are people saying about DroidRun vs OpenClaw" → finds all relevant threads, extracts comparisons, user experiences, pros/cons mentioned
- **Market validation**: "is there demand for WhatsApp auto-reply bots" → searches across subreddits, analyzes upvotes and engagement, identifies the audience and their pain points
- **Trend tracking**: "what local LLM topics are trending this week on r/LocalLLaMA" → fetches top/rising posts, identifies emerging themes

Everything runs through your existing browser session. Zero cost, no API keys, no rate limit surprises.

## Why not just use the official Reddit API?

Reddit killed free API access in 2023. The official API now requires app registration, OAuth flows, and has strict rate limits. If you're building something for personal use with your own account, jumping through those hoops makes no sense.

This approach uses the exact same endpoints Reddit's own website uses. Your browser is already authenticated. We just let your AI assistant use that same session.

## Safety Guidelines — Don't Get Your Account Banned

This tool uses your real Reddit account. Reddit can't tell the difference between you typing and this tool typing, because it's the same browser session. That's the whole point. But it also means you need to behave like a human.

**Why the risk is low:**
- Requests come from your normal browser with your normal cookies. To Reddit's servers, it looks identical to you clicking buttons manually.
- The server adds delays between write operations (1.5s minimum). You're not hammering their API.
- Content is genuine (you write and approve the replies), not auto-generated spam.

**Rules to follow:**
- **Don't batch reply too aggressively.** 10-15 replies in one session is fine. 50 replies in 10 minutes is not. Spread it out across a few hours if you have a lot to respond to.
- **Vary your reply content.** If every reply has the exact same structure, links, and call-to-action, Reddit's spam filter will notice. Make each reply address the specific person's point.
- **Mix in normal behavior.** Browse, upvote a few things, read some posts. Don't make your entire session activity look like a bot replying to everything.
- **Don't use this for spam, vote manipulation, or astroturfing.** Obviously. This is for managing your own community and doing research, not gaming Reddit.
- **Respect subreddit rules.** Some subs don't allow self-promotion. Check before cross-posting.

**What happens if Reddit flags you:**
- Most likely: temporary rate limit (can't post for a few hours)
- Less likely: shadowban (your replies only visible to you, check at r/ShadowBan)
- Very unlikely: account suspension (only for obvious spam or manipulation)

**Recovery:**
- If rate limited, just wait. It resets.
- If shadowbanned, appeal at reddit.com/appeal. Usually reversed if your content is genuine.
- Best prevention: keep it natural. If a human wouldn't post 30 comments in 5 minutes, don't do it with this tool either.

## Limitations

- Needs Chrome running with DevTools Protocol (port 9222)
- Needs you to be logged into Reddit in that Chrome instance
- One Reddit account at a time (whichever is logged in)
- Rate limits are undocumented but generous for normal use
- Not suitable for high-volume scraping or bot armies (and you shouldn't do that anyway)
