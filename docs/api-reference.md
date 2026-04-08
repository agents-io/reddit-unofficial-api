---
product: pokeclaw
stage: think
type: research
date: 2026-04-08
---

# Reddit 內部 API 研究 — Browser Session (Cookie-Based) Endpoints

All endpoints below can be accessed from a logged-in browser session using cookies. No OAuth app registration needed unless noted.

---

## Table of Contents

1. [Authentication & CSRF (Modhash)](#1-authentication--csrf-modhash)
2. [The .json Suffix Trick](#2-the-json-suffix-trick)
3. [Old Reddit REST API (/api/*)](#3-old-reddit-rest-api-api)
4. [OAuth Endpoints That Work With Cookies](#4-oauth-endpoints-that-work-with-cookies)
5. [New Reddit Shreddit Endpoints (/svc/shreddit/*)](#5-new-reddit-shreddit-endpoints-svcshreddit)
6. [Reddit GraphQL API (gql.reddit.com)](#6-reddit-graphql-api-gqlredditcom)
7. [Rate Limits](#7-rate-limits)
8. [Required Headers](#8-required-headers)
9. [Thing Type Prefixes](#9-thing-type-prefixes)
10. [Known Limitations](#10-known-limitations)

---

## 1. Authentication & CSRF (Modhash)

### What is a modhash?

A modhash is Reddit's anti-CSRF token. Every POST request to old Reddit's `/api/*` endpoints requires it. It's different each session.

### How to get the modhash

**Method 1: From /api/me.json**
```
GET https://www.reddit.com/api/me.json
Cookie: reddit_session=<your_session_cookie>
```
Response contains `data.modhash` field.

**Method 2: From any Listing response**
Any `.json` endpoint that returns a Listing object includes `data.modhash`.

**Method 3: From page HTML**
In old.reddit.com pages, the modhash is embedded in the HTML as a JS variable. Search for:
```javascript
reddit.modhash = 'abc123def456';
```
or in a hidden form field named `uh`.

### How to send the modhash

Two ways:
1. POST body parameter: `uh=<modhash>`
2. HTTP header: `X-Modhash: <modhash>`

When using OAuth bearer tokens, modhash is **optional** (not required).

### Key cookies

| Cookie | Purpose |
|--------|---------|
| `reddit_session` | Main session cookie, required for all authenticated requests |
| `token_v2` | New Reddit JWT token (used by new.reddit.com) |
| `csrf_token` | CSRF token for new Reddit (used in X-CSRFToken header) |
| `loid` | Logged-out ID tracking |
| `edgebucket` | Load balancer / A-B testing |

---

## 2. The .json Suffix Trick

Append `.json` to virtually any Reddit URL to get the raw JSON data. Works for both logged-in and anonymous users.

### URL Patterns

| Pattern | Example | Returns |
|---------|---------|---------|
| Subreddit listing | `https://www.reddit.com/r/python.json` | Listing of posts |
| Subreddit sorted | `https://www.reddit.com/r/python/hot.json` | Hot posts |
| Subreddit sorted | `https://www.reddit.com/r/python/new.json` | New posts |
| Subreddit sorted | `https://www.reddit.com/r/python/top.json?t=week` | Top posts (time filter) |
| Subreddit sorted | `https://www.reddit.com/r/python/rising.json` | Rising posts |
| Subreddit sorted | `https://www.reddit.com/r/python/controversial.json?t=month` | Controversial |
| Post + comments | `https://www.reddit.com/r/python/comments/{id}.json` | Post data + comment tree |
| Single comment thread | `https://www.reddit.com/r/python/comments/{id}/title/{comment_id}.json` | Single comment thread |
| User profile | `https://www.reddit.com/user/{username}.json` | User overview |
| User posts | `https://www.reddit.com/user/{username}/submitted.json` | User's submissions |
| User comments | `https://www.reddit.com/user/{username}/comments.json` | User's comments |
| User about | `https://www.reddit.com/user/{username}/about.json` | User profile data |
| Subreddit about | `https://www.reddit.com/r/{sub}/about.json` | Subreddit metadata |
| Subreddit rules | `https://www.reddit.com/r/{sub}/about/rules.json` | Subreddit rules |
| Subreddit moderators | `https://www.reddit.com/r/{sub}/about/moderators.json` | Mod list |
| Subreddit wiki | `https://www.reddit.com/r/{sub}/wiki/{page}.json` | Wiki page |
| Search | `https://www.reddit.com/search.json?q=term` | Search results |
| Subreddit search | `https://www.reddit.com/r/{sub}/search.json?q=term&restrict_sr=on` | Search within sub |
| Domain links | `https://www.reddit.com/domain/{domain}.json` | Links from domain |
| By fullname | `https://www.reddit.com/by_id/{fullname}.json` | Thing by fullname |
| Comments by ID | `https://www.reddit.com/comments/{id36}.json` | Post + comments |
| Front page | `https://www.reddit.com/.json` | Front page |
| /r/all | `https://www.reddit.com/r/all.json` | All subreddits |
| /r/popular | `https://www.reddit.com/r/popular.json` | Popular posts |
| /best | `https://www.reddit.com/best.json` | Personalized best (auth) |
| Messages inbox | `https://www.reddit.com/message/inbox.json` | Inbox (auth) |
| Messages unread | `https://www.reddit.com/message/unread.json` | Unread messages (auth) |
| Messages sent | `https://www.reddit.com/message/sent.json` | Sent messages (auth) |
| Subreddit list | `https://www.reddit.com/subreddits.json` | Popular subreddits |
| New subreddits | `https://www.reddit.com/subreddits/new.json` | New subreddits |
| My subreddits | `https://www.reddit.com/subreddits/mine/subscriber.json` | Subscribed (auth) |

### Common Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `limit` | 1-100 | Number of items (default 25) |
| `after` | fullname | Pagination cursor (next page) |
| `before` | fullname | Pagination cursor (previous page) |
| `count` | integer | Number of items already seen |
| `t` | `hour`, `day`, `week`, `month`, `year`, `all` | Time filter for top/controversial |
| `sort` | `relevance`, `hot`, `top`, `new`, `comments` | Sort order for search |
| `q` | string | Search query |
| `restrict_sr` | `on` | Restrict search to subreddit |
| `show` | `all` | Show hidden/filtered items |
| `raw_json` | `1` | Return raw JSON (no HTML encoding) |
| `sr_detail` | `true` | Include subreddit details in each post |
| `depth` | integer | Comment tree depth |

### Requirements

- **User-Agent**: MUST set a custom User-Agent or you get 429 errors. Reddit blocks default/empty user agents.
- **Rate**: Unauthenticated .json requests = ~10/min. With session cookie = higher but undocumented.

### Also works with .rss and .xml

```
https://www.reddit.com/r/python.rss
https://www.reddit.com/r/python.xml
```

---

## 3. Old Reddit REST API (/api/*)

These are the original Reddit API endpoints. They work with cookie authentication (reddit_session + modhash). All POST endpoints require the `uh` (modhash) parameter unless using OAuth bearer token.

Base URL: `https://www.reddit.com` or `https://old.reddit.com`

### Content Creation & Editing

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/submit` | POST | `uh`, `kind` (self/link), `sr` (subreddit), `title`, `url` (for links), `text` (for self), `sendreplies`, `nsfw`, `spoiler`, `flair_id`, `flair_text`, `resubmit`, `api_type=json` | Create a new post |
| `/api/comment` | POST | `uh`, `thing_id` (parent fullname t1_ or t3_), `text`, `api_type=json` | Post a comment or reply |
| `/api/editusertext` | POST | `uh`, `thing_id`, `text`, `api_type=json` | Edit a self post or comment |
| `/api/del` | POST | `uh`, `id` (fullname) | Delete your own post or comment |
| `/api/sendreplies` | POST | `uh`, `id` (fullname), `state` (true/false) | Toggle inbox replies |

### Voting

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/vote` | POST | `uh`, `id` (fullname), `dir` (1=up, 0=unvote, -1=down) | Vote on a post or comment |

### Saving & Hiding

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/save` | POST | `uh`, `id` (fullname), `category` (optional) | Save a post or comment |
| `/api/unsave` | POST | `uh`, `id` (fullname) | Unsave a post or comment |
| `/api/hide` | POST | `uh`, `id` (fullname) | Hide a post |
| `/api/unhide` | POST | `uh`, `id` (fullname) | Unhide a post |

### Reporting

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/report` | POST | `uh`, `thing_id` (fullname), `reason`, `other_reason`, `site_reason`, `rule_reason` | Report content |

### Messaging

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/compose` | POST | `uh`, `to` (username), `subject`, `text`, `api_type=json` | Send a private message |
| `/api/del_msg` | POST | `uh`, `id` (fullname t4_) | Delete a message |
| `/api/read_message` | POST | `uh`, `id` (fullname, comma-separated) | Mark message(s) as read |
| `/api/unread_message` | POST | `uh`, `id` (fullname, comma-separated) | Mark message(s) as unread |
| `/api/read_all_messages` | POST | `uh` | Mark ALL messages as read |
| `/api/block` | POST | `uh`, `id` (fullname t4_) | Block user (from message) |
| `/api/unblock_subreddit` | POST | `uh`, `id` | Unblock a subreddit from messages |

### Subscribing

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/subscribe` | POST | `uh`, `action` (sub/unsub), `sr` (fullname t5_) OR `sr_name` (name), `skip_initial_defaults` | Subscribe/unsubscribe to subreddit |

### Friends & Users

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/friend` | POST | `uh`, `name` (username), `type` (friend/moderator/contributor/banned/muted/wikibanned/wikicontributor), `container` | Add relationship |
| `/api/unfriend` | POST | `uh`, `name`, `type`, `container` | Remove relationship |
| `/api/block_user` | POST | `uh`, `name` (username) | Block a user |
| `/api/friendnote` | POST | `uh`, `name`, `note` | Add note to friend (gold) |

### Flair

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/r/{sub}/api/selectflair` | POST | `uh`, `flair_template_id`, `link` (fullname), `name` (username) | Apply flair |
| `/r/{sub}/api/flairselector` | POST | `uh`, `link` (fullname), `name` (username) | Get flair options |
| `/r/{sub}/api/link_flair_v2` | GET | - | Get link flair templates |
| `/r/{sub}/api/user_flair_v2` | GET | - | Get user flair templates |
| `/r/{sub}/api/setflairenabled` | POST | `uh`, `flair_enabled` (true/false) | Toggle your flair visibility |

### Information Retrieval

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/info` | GET | `id` (comma-separated fullnames) OR `url` | Get things by fullname or URL |
| `/api/me.json` | GET | - | Get logged-in user data + modhash |
| `/api/v1/me` | GET | - | Get authenticated user info (OAuth-style) |
| `/api/v1/me/prefs` | GET | - | Get user preferences |
| `/api/v1/me/karma` | GET | - | Karma breakdown by subreddit |
| `/api/v1/me/trophies` | GET | - | User trophies |
| `/api/v1/me/friends/{username}` | GET | - | Get friend info |
| `/api/morechildren` | POST | `link_id` (t3_ fullname), `children` (comma-separated id36), `sort` (top/new/old/controversial/qa), `api_type=json` | Load more comments |
| `/api/needs_captcha` | GET | - | Check if captcha is needed |
| `/api/username_available` | GET | `user` (username) | Check username availability |
| `/r/{sub}/api/submit_text` | GET | - | Get submission guidelines text |
| `/api/recommend/sr/{srnames}` | GET | `omit` (comma-separated) | Get recommended subreddits (DEPRECATED) |
| `/api/search_reddit_names` | POST | `query`, `exact` (bool), `include_over_18`, `include_unadvertisable` | Search subreddit names |
| `/api/search_subreddits` | POST | `query`, `exact`, `include_over_18` | Search subreddits (partial objects) |
| `/api/similar_subreddits` | GET | `sr_fullnames` (comma-separated t5_), `max_recs` | Find similar subreddits |
| `/r/{sub}/about/rules` | GET | - | Get subreddit rules |
| `/api/v1/{sub}/post_requirements` | GET | - | Get post requirements |
| `/r/{sub}/about/edit` | GET | - | Get subreddit settings (mod) |
| `/r/{sub}/about/traffic` | GET | - | Get traffic stats (mod) |
| `/r/{sub}/about/log` | GET | `type`, `mod`, `after`, `limit` | Moderator action log |
| `/r/{sub}/about/modqueue` | GET | `after`, `limit` | Moderation queue |
| `/r/{sub}/about/reports` | GET | `after`, `limit` | Reported content |
| `/r/{sub}/about/moderators` | GET | - | List moderators |

### Post Moderation (Mod-only)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/approve` | POST | `uh`, `id` (fullname) | Approve content |
| `/api/remove` | POST | `uh`, `id` (fullname), `spam` (bool) | Remove content |
| `/api/distinguish` | POST | `uh`, `id` (fullname), `how` (yes/no/admin/special) | Distinguish as mod/admin |
| `/api/lock` | POST | `uh`, `id` (fullname) | Lock thread |
| `/api/unlock` | POST | `uh`, `id` (fullname) | Unlock thread |
| `/api/marknsfw` | POST | `uh`, `id` (fullname) | Mark as NSFW |
| `/api/unmarknsfw` | POST | `uh`, `id` (fullname) | Remove NSFW mark |
| `/api/spoiler` | POST | `uh`, `id` (fullname) | Mark as spoiler |
| `/api/unspoiler` | POST | `uh`, `id` (fullname) | Remove spoiler |
| `/api/set_subreddit_sticky` | POST | `uh`, `id` (fullname), `state` (true/false), `num` (1 or 2) | Sticky/unsticky post |
| `/api/set_contest_mode` | POST | `uh`, `id` (fullname), `state` (true/false) | Toggle contest mode |
| `/api/set_suggested_sort` | POST | `uh`, `id` (fullname), `sort` | Set default comment sort |
| `/api/ignore_reports` | POST | `uh`, `id` (fullname) | Ignore reports on item |
| `/api/unignore_reports` | POST | `uh`, `id` (fullname) | Stop ignoring reports |

### Mod Actions on Users

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/mute_message_author` | POST | `uh`, `id` (fullname t4_) | Mute user in modmail |
| `/api/unmute_message_author` | POST | `uh`, `id` (fullname t4_) | Unmute user in modmail |
| `/r/{sub}/api/accept_moderator_invite` | POST | `uh` | Accept mod invite |
| `/api/leavemoderator` | POST | `uh`, `id` (subreddit fullname t5_) | Resign as mod |
| `/api/leavecontributor` | POST | `uh`, `id` (subreddit fullname t5_) | Resign as contributor |

### Multireddits

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/multi/mine` | GET | - | List your multireddits |
| `/api/multi/user/{username}` | GET | - | List user's public multis |
| `/api/multi/{multipath}` | GET | - | Get multi details |
| `/api/multi/{multipath}` | PUT | JSON body with model | Create/update multi |
| `/api/multi/{multipath}` | DELETE | - | Delete multi |
| `/api/multi/{multipath}/copy` | POST | `from`, `to`, `display_name` | Copy multi |
| `/api/multi/{multipath}/rename` | POST | `from`, `to`, `display_name` | Rename multi |
| `/api/multi/{multipath}/r/{srname}` | PUT | `model` (JSON) | Add sub to multi |
| `/api/multi/{multipath}/r/{srname}` | DELETE | - | Remove sub from multi |

### Wiki

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/r/{sub}/wiki/{page}` | GET | - | Get wiki page (HTML) |
| `/r/{sub}/wiki/{page}.json` | GET | - | Get wiki page (JSON) |
| `/r/{sub}/api/wiki/edit` | POST | `uh`, `page`, `content`, `reason` | Edit wiki page |
| `/r/{sub}/api/wiki/alloweditor/{act}` | POST | `uh`, `page`, `username`, act=add/del | Manage wiki editors |
| `/r/{sub}/api/wiki/hide` | POST | `uh`, `page`, `revision` | Hide wiki revision |
| `/r/{sub}/api/wiki/revert` | POST | `uh`, `page`, `revision` | Revert wiki to revision |
| `/r/{sub}/wiki/settings/{page}` | GET | - | Get wiki page settings |
| `/r/{sub}/wiki/settings/{page}` | POST | `uh`, `permlevel`, `listed` | Update wiki settings |
| `/r/{sub}/wiki/revisions` | GET | - | Wiki revision history |
| `/r/{sub}/wiki/revisions/{page}` | GET | - | Page revision history |
| `/r/{sub}/wiki/pages` | GET | - | List all wiki pages |

### Subreddit Configuration (Mod)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/site_admin` | POST | Many params: `name`/`sr`, `title`, `description`, `public_description`, `type`, `link_type`, `wikimode`, etc. | Create or configure subreddit |
| `/api/v1/subreddit/update_settings` | PATCH | `sr` (fullname), JSON body | Update specific settings |
| `/r/{sub}/api/subreddit_stylesheet` | POST | `uh`, `op` (save/preview), `stylesheet_contents` | Update CSS |
| `/r/{sub}/api/upload_sr_img` | POST | `uh`, `file`, `img_type`, `name` | Upload image |
| `/r/{sub}/api/delete_sr_banner` | POST | `uh` | Delete banner |
| `/r/{sub}/api/delete_sr_header` | POST | `uh` | Delete header image |
| `/r/{sub}/api/delete_sr_icon` | POST | `uh` | Delete icon |
| `/r/{sub}/api/delete_sr_img` | POST | `uh`, `img_name` | Delete named image |

### New Modmail

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/mod/conversations` | GET | `entity`, `state`, `sort`, `after`, `limit` | List modmail conversations |
| `/api/mod/conversations` | POST | `body`, `isAuthorHidden`, `srName`, `subject`, `to` | Create conversation |
| `/api/mod/conversations/{id}` | GET | - | Get conversation |
| `/api/mod/conversations/{id}` | POST | `body`, `isAuthorHidden`, `isInternal` | Reply to conversation |
| `/api/mod/conversations/{id}/archive` | POST | - | Archive conversation |
| `/api/mod/conversations/{id}/unarchive` | POST | - | Unarchive |
| `/api/mod/conversations/{id}/highlight` | POST | - | Highlight |
| `/api/mod/conversations/{id}/highlight` | DELETE | - | Remove highlight |
| `/api/mod/conversations/{id}/mute` | POST | - | Mute |
| `/api/mod/conversations/{id}/unmute` | POST | - | Unmute |
| `/api/mod/conversations/read` | POST | `conversationIds` (comma-separated) | Mark read |
| `/api/mod/conversations/unread` | POST | `conversationIds` (comma-separated) | Mark unread |
| `/api/mod/conversations/unread/count` | GET | - | Unread count |
| `/api/mod/conversations/subreddits` | GET | - | List modmail subreddits |
| `/api/mod/conversations/{id}/user` | GET | - | Get user context |
| `/api/mod/bulk_read` | POST | `conversationIds`, `entity` | Bulk mark as read |

### Live Threads

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/live/create` | POST | `uh`, `title`, `description`, `nsfw`, `resources` | Create live thread |
| `/api/live/{thread}/update` | POST | `uh`, `body` | Post update |
| `/api/live/{thread}/delete_update` | POST | `uh`, `id` | Delete update |
| `/api/live/{thread}/strike_update` | POST | `uh`, `id` | Strike through update |
| `/api/live/{thread}/edit` | POST | `uh`, `title`, `description`, `nsfw`, `resources` | Edit thread settings |
| `/api/live/{thread}/close_thread` | POST | `uh` | Close thread |
| `/api/live/{thread}/invite_contributor` | POST | `uh`, `name`, `permissions`, `type` | Invite contributor |
| `/api/live/{thread}/rm_contributor` | POST | `uh`, `id` | Remove contributor |
| `/api/live/{thread}/rm_contributor_invite` | POST | `uh`, `id` | Cancel invite |
| `/api/live/{thread}/set_contributor_permissions` | POST | `uh`, `name`, `permissions`, `type` | Set permissions |
| `/api/live/{thread}/accept_contributor_invite` | POST | `uh` | Accept invite |
| `/api/live/{thread}/leave_contributor` | POST | `uh` | Leave thread |
| `/api/live/{thread}/hide_discussion` | POST | `uh` | Hide discussion |
| `/api/live/{thread}/unhide_discussion` | POST | `uh` | Unhide discussion |

### Account Management

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/login/{username}` | POST | `user`, `passwd`, `api_type=json` | Login (returns modhash + cookie) |
| `/api/register` | POST | `user`, `passwd`, `passwd2`, `email`, `api_type=json` | Register account |
| `/api/update_email` | POST | `uh`, `email`, `password`, `verify` | Change email |
| `/api/update_password` | POST | `uh`, `curpass`, `newpass`, `verpass` | Change password |
| `/api/clear_sessions` | POST | `uh`, `curpass` | Log out all sessions |
| `/api/deactivate_user` | POST | `uh`, `passwd`, `delete_message`, `confirm` | Delete account |
| `/api/v1/me/prefs` | PATCH | JSON body | Update user preferences |

### Gilding / Awards

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/v1/gold/gild/{fullname}` | POST | - | Award gold to content |
| `/api/v1/gold/give/{username}` | POST | `months` | Gift gold to user |

### Miscellaneous

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/share` | POST | `uh`, `parent` (fullname), `share_to` (email), `replyto`, `message` | Share via email |
| `/api/fetch_title` | GET | `url` | Extract webpage title |
| `/api/v1/scopes` | GET | - | List all OAuth scopes |
| `/api/trending_subreddits.json` | GET | - | Trending subs (DEPRECATED, broken) |
| `/api/new_captcha` | POST | - | Generate captcha |
| `/api/rescrape` | POST | `uh`, `thing_id` | Re-scrape link preview/thumbnail |

---

## 4. OAuth Endpoints That Work With Cookies

The browser's new Reddit (new.reddit.com, sh.reddit.com) uses OAuth tokens internally. When you're logged in, the browser holds a `token_v2` JWT cookie that acts as a bearer token.

### How it works in browser context

1. New Reddit's JS fetches an access token by calling an internal token endpoint
2. This token is stored in `token_v2` cookie / localStorage
3. All API calls go to `https://oauth.reddit.com/` with `Authorization: Bearer <token>`
4. The bearer token is refreshed automatically by Reddit's frontend JS

### Key difference from registered OAuth apps

- Browser sessions use Reddit's own first-party client_id
- Rate limits are different (see section 7)
- No app registration needed - you're using Reddit's own web client credentials

### All /api/* endpoints listed in Section 3 also work via oauth.reddit.com

Just change the base URL:
```
https://www.reddit.com/api/vote  -->  https://oauth.reddit.com/api/vote
```
When using oauth.reddit.com, send the bearer token in the Authorization header instead of modhash.

---

## 5. New Reddit Shreddit Endpoints (/svc/shreddit/*)

New Reddit (the redesign, codenamed "shreddit") uses its own internal endpoints for dynamic content loading. These return **HTML fragments** containing web components, not JSON.

### Known Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/svc/shreddit/community-more-posts/{sort}/` | GET | Load more posts in subreddit feed |
| `/svc/shreddit/comment-more-children` | GET | Load more comments in a thread |

### Community More Posts

```
GET https://www.reddit.com/svc/shreddit/community-more-posts/new/?after={cursor}&t=DAY&name={subreddit}&feedLength=3
```

**Parameters:**
- `after` - Base64-encoded pagination cursor (from `//shreddit-post/@more-posts-cursor` XPath)
- `t` - Time filter: `HOUR`, `DAY`, `WEEK`, `MONTH`, `YEAR`, `ALL`
- `name` - Subreddit name (without r/)
- `feedLength` - Number of posts already loaded
- `sort` - Part of URL path: `hot`, `new`, `top`, `rising`, `controversial`

**Returns:** HTML containing `<shreddit-post>` custom elements. Parse post data from element attributes.

### Key Shreddit Web Components

These are custom HTML elements in shreddit responses:
- `<shreddit-post>` - A post, with attributes for all post data
- `<shreddit-comment>` - A comment
- `<shreddit-subreddit-header>` - Subreddit header
- `<shreddit-feed>` - Feed container

### Authentication

These endpoints use the same session cookies as the rest of new Reddit. No special auth beyond being logged in.

### Limitations

- Returns HTML, not JSON - requires HTML parsing
- Reddit's anti-bot protection silently blocks automated requests (returns empty/different content)
- No official documentation - discovered by observing network traffic

---

## 6. Reddit GraphQL API (gql.reddit.com)

Reddit's new frontend uses a private GraphQL API. This is the most powerful but most locked-down endpoint.

### Endpoint

```
POST https://gql.reddit.com/
```

### Authentication

Requires a GQL bearer token. In browser context, this is obtained from the logged-in session. The browser JS automatically handles token acquisition.

### How it works

1. Reddit's frontend JS makes POST requests to `gql.reddit.com`
2. Each request contains an `operationName` and either a full `query` or a persisted query `sha256Hash`
3. Variables are passed in the `variables` field
4. Reddit uses **Apollo GraphQL** with **persisted queries** (hashed operations)

### Request Format

```json
{
  "operationName": "OperationName",
  "variables": {
    "key": "value"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "abc123..."
    }
  }
}
```

### Security Measures (why this is hard to use directly)

Reddit implements multiple verification layers:
1. **Header order checking** - The order of HTTP headers is verified
2. **JSON formatting** - Specific JSON formatting requirements
3. **TLS fingerprinting** - They check TLS handshake signatures (JA3/JA4)
4. **Rate limiting** - Aggressive rate limiting on suspicious patterns
5. **Persisted queries** - Only pre-registered query hashes are accepted
6. **Bearer token validation** - Token must come from legitimate Reddit session

### Discovering Operations

To find the operation names and query hashes:
1. Open Chrome DevTools > Network tab
2. Filter by `gql.reddit.com`
3. Browse Reddit normally
4. Each request shows the `operationName` and variables in the request body
5. The `sha256Hash` identifies the persisted query

### Known Operation Categories (from network observation)

These are the general categories of operations (exact names change with Reddit deployments):
- Feed/listing operations (home feed, subreddit feed, search)
- Post detail operations (post + comments)
- Comment operations (create, edit, delete, vote)
- Vote operations (upvote, downvote, unvote)
- User operations (profile, settings)
- Subreddit operations (about, rules, sidebar)
- Moderation operations
- Award/premium operations

### Practical Usage

For browser automation (Playwright/Puppeteer), you don't need to call gql.reddit.com directly. Let the browser do it naturally. The GraphQL API is useful if you need to:
- Intercept and modify requests
- Make calls programmatically using captured tokens/hashes
- Understand what data Reddit's frontend fetches

---

## 7. Rate Limits

### Official API Rate Limits (oauth.reddit.com)

| Auth Type | Rate Limit | Tracking |
|-----------|-----------|----------|
| OAuth (registered app) | 60 req/min (some sources say 100) | Per OAuth client_id |
| Unauthenticated | 10 req/min | Per IP address |
| .json suffix (no user-agent) | Blocked (429) | - |
| .json suffix (with user-agent) | ~10 req/min | Per IP |

### Rate Limit Response Headers

```
X-Ratelimit-Used: 5          # Requests used in current period
X-Ratelimit-Remaining: 55    # Requests remaining
X-Ratelimit-Reset: 234       # Seconds until period resets
```

### Browser Session Rate Limits

Cookie-based browser requests (as a logged-in user browsing normally) are NOT subject to the same 60 req/min API rate limit. Browser requests use Reddit's first-party client credentials and have different, more generous limits. However:
- Reddit monitors for bot-like behavior patterns
- Rapid automated requests will trigger CAPTCHAs or blocks
- The exact browser rate limits are undocumented

### Content Submission Rate Limits

Beyond request rate limits, Reddit limits how often you can post/comment:
- New accounts: ~1 post per 15 minutes
- Established accounts: more frequent (karma-dependent)
- Low karma in a subreddit: stricter limits in that sub
- Email-verified accounts get better limits
- Reddit never returns a RATELIMIT delay > 15 minutes
- Can return multiple RATELIMIT errors in a row

### Rate Limit Error

HTTP 429 with body: `{"message": "Too Many Requests", "error": 429}`

---

## 8. Required Headers

### For .json Suffix Requests

```
User-Agent: myapp/1.0 (by /u/myusername)
```
Without a custom User-Agent, you get 429. Reddit bans spoofed browser user-agents.

### For Old Reddit /api/* Endpoints (Cookie Auth)

```
Cookie: reddit_session=<session_value>
Content-Type: application/x-www-form-urlencoded
```
POST body includes `uh=<modhash>`.

### For OAuth Endpoints

```
Authorization: Bearer <access_token>
User-Agent: platform:appid:version (by /u/username)
```

### For New Reddit (Browser Context)

The browser automatically sends:
```
Cookie: token_v2=<jwt>; reddit_session=<session>; csrf_token=<token>; ...
X-CSRFToken: <csrf_token_value>
Content-Type: application/json
```

### For gql.reddit.com

```
Authorization: Bearer <gql_token>
Content-Type: application/json
X-Reddit-Loid: <logged_out_id>
X-Reddit-Session: <session_tracker>
```
Plus TLS fingerprint, header order, and other anti-bot signals.

### Common Anti-Block Headers

```
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
```

### Helpful Cookie

```
Cookie: intl_splash=false
```
Prevents the "pick your region" splash page on reddit.com.

---

## 9. Thing Type Prefixes

Reddit uses "fullnames" to identify objects. Format: `{type}_{id36}`

| Prefix | Type | Example |
|--------|------|---------|
| `t1_` | Comment | `t1_c5s96e0` |
| `t2_` | Account/User | `t2_5sryd` |
| `t3_` | Link/Post | `t3_6nw57` |
| `t4_` | Message | `t4_8xwlg` |
| `t5_` | Subreddit | `t5_2cneq` |
| `t6_` | Award | `t6_...` |
| `Listing` | Container | (not prefixed) |
| `more` | Truncated list | (not prefixed) |

The `id36` is a base-36 encoded ID. Use these fullnames in API calls wherever `id`, `thing_id`, `parent`, or `fullname` parameters are expected.

---

## 10. Known Limitations

### Cookie-Based Access

1. **No official support** - Reddit does not officially support cookie-based API access. All official docs point to OAuth.
2. **CSRF required** - Old Reddit POST endpoints need modhash. New Reddit needs csrf_token.
3. **Session expiry** - Cookie sessions expire and need to be refreshed by logging in again.
4. **IP-based blocking** - Excessive requests from one IP get blocked regardless of auth.
5. **Bot detection** - Reddit uses TLS fingerprinting, header analysis, and behavior patterns to detect automation.

### API Changes (2024-2025)

1. **Self-service API keys removed** - As of late 2024, you can't just register an app and get API access. You must submit a request and wait for approval.
2. **Rate limits enforced more strictly** - Post-2023 API pricing changes led to stricter enforcement.
3. **GraphQL is primary** - New Reddit increasingly uses GraphQL, which is harder to reverse-engineer than REST.
4. **Old Reddit maintenance mode** - old.reddit.com still works but gets fewer updates.

### What you CAN'T do from browser cookies alone

1. Register a new OAuth application
2. Access admin-level endpoints
3. Exceed the per-IP rate limits
4. Make requests that require a registered app (like getting refresh tokens)
5. Access data that requires special API agreements (like bulk data access)

### What you CAN do

Everything a normal logged-in user can do:
- Read all public content (posts, comments, wikis, user profiles)
- Vote, comment, submit posts
- Save, hide, report content
- Send/read private messages
- Subscribe/unsubscribe to subreddits
- Manage multireddits
- Moderate subreddits (if you're a mod)
- Edit your profile and preferences
- Access your inbox, saved items, upvoted/downvoted lists

---

## Sources

- [Reddit Official API Docs](https://www.reddit.com/dev/api/) (not fetchable via WebFetch but comprehensive)
- [Pyprohly/reddit-api-doc-notes](https://github.com/Pyprohly/reddit-api-doc-notes) - Community-maintained detailed API notes
- [JRAW Endpoints List](https://github.com/mattbdean/JRAW/blob/master/ENDPOINTS.md) - 182 endpoints tracked
- [Reddit Archive - API Wiki](https://github.com/reddit-archive/reddit/wiki/API) - Official rules
- [Reddit Archive - OAuth2 Wiki](https://github.com/reddit-archive/reddit/wiki/oauth2) - OAuth scopes
- [Reddit Archive - JSON Wiki](https://github.com/reddit-archive/reddit/wiki/JSON) - Thing types
- [Reddit Archive - api.py Source](https://github.com/reddit-archive/reddit/blob/master/r2/r2/controllers/api.py) - Original source
- [Simon Willison - Reddit JSON Scraping](https://til.simonwillison.net/reddit/scraping-reddit-json) - .json trick
- [Scrapfly - Reddit Scraping Guide](https://scrapfly.io/blog/posts/how-to-scrape-reddit-social-data) - Shreddit endpoints
- [HackerNews Discussion on Reddit GraphQL](https://news.ycombinator.com/item?id=36312820) - GQL security
- [reddit-is-fun Wiki](https://github.com/talklittle/reddit-is-fun/wiki/Api---all-functions) - Old API functions
- [PainOnSocial Reddit Endpoints Guide](https://painonsocial.com/blog/reddit-api-endpoints-list) - Endpoint summary
- [Data365 Reddit API Limits](https://data365.co/blog/reddit-api-limits) - Rate limit details
- [Later for Reddit - Ratelimits](https://laterforreddit.com/docs/guides/all-about-ratelimits/) - Content submission limits
