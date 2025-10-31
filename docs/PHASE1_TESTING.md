# Phase 1 Testing Guide

Complete guide for testing the QA Automation Agent (Phase 1 - Single Project)

---

## 📋 Prerequisites Checklist

Before starting testing, ensure you have:

- [ ] **Node.js 20+** installed (`node --version`)
- [ ] **npm** installed (`npm --version`)
- [ ] **Git** installed and configured
- [ ] **Notion account** with workspace access
- [ ] **GitHub account** with repository access
- [ ] **Anthropic API account** (Claude API)
- [ ] **Slack workspace** (optional, for notifications)

---

## 🔑 API Keys and Credentials Setup

### 1. Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-api03-`)
6. **Save it** - you won't be able to see it again!

**Cost Estimate:** ~$0.50-$2.00 per QA item (depending on complexity)

### 2. Notion Integration

#### Step 1: Create Notion Database

1. Go to your Notion workspace
2. Create a new **Database** (Table view recommended)
3. Add the following properties:

| Property Name | Type         | Options/Description                              |
| ------------- | ------------ | ------------------------------------------------ |
| Title         | Title        | QA issue title                                   |
| Status        | Select       | Options: Not Started, In Progress, Done, Not Actionable |
| Description   | Text (Long)  | Detailed issue description                       |
| Reporter      | Person       | Who reported the issue                           |
| Priority      | Select       | Options: critical, high, medium, low (optional)  |
| PR URL        | URL          | Auto-filled by agent (optional)                  |

#### Step 2: Create Integration

1. Go to https://www.notion.so/my-integrations
2. Click **+ New integration**
3. Fill in details:
   - Name: `QA Automation Agent`
   - Associated workspace: (select your workspace)
   - Capabilities: ✅ Read content, ✅ Update content, ✅ Insert content
4. Click **Submit**
5. Copy the **Integration Token** (starts with `secret_`)

#### Step 3: Share Database with Integration

1. Open your QA database in Notion
2. Click **•••** (three dots) in top right
3. Click **Add connections**
4. Search for `QA Automation Agent`
5. Click **Confirm**

#### Step 4: Get Database ID

Your database ID is in the URL:

```
https://www.notion.so/{workspace}/{database_id}?v=...
                                 ^^^^^^^^^^^^^^^^
                                 This is your Database ID
```

Example: `https://www.notion.so/myworkspace/a1b2c3d4e5f6...` → Database ID is `a1b2c3d4e5f6...`

### 3. GitHub Personal Access Token

#### Option A: Classic Token (Recommended for Organization Private Repos)

1. Go to GitHub Settings → **Developer Settings** → **Personal Access Tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Configure:
   - **Note:** `QA Automation Agent`
   - **Expiration:** 90 days (or your preference)
   - **Select scopes:**
     - ✅ **repo** (full control of private repositories)
       - This includes: repo:status, repo_deployment, public_repo, repo:invite, security_events
     - ✅ **workflow** (optional - for GitHub Actions)
4. Click **Generate token**
5. **Copy the token** (starts with `ghp_`)

**When to use Classic Token:**
- ✅ Working with Organization private repositories
- ✅ Need immediate access without approval
- ✅ Want simpler setup
- ⚠️ Broader permissions (access to all repos you have access to)

#### Option B: Fine-grained Token (For Personal Repos or With Org Admin Approval)

1. Go to GitHub Settings → **Developer Settings** → **Personal Access Tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Configure:
   - **Token name:** `QA Automation Agent`
   - **Expiration:** 90 days (or your preference)
   - **Resource owner:** Select your username or **Organization** (if targeting org repos)
   - **Repository access:** Select specific repositories
   - **Permissions:**
     - Contents: **Read and write**
     - Pull requests: **Read and write**
     - Metadata: **Read-only** (automatically included)
4. Click **Generate token**
5. **Copy the token** (starts with `github_pat_`)
6. ⚠️ **If using Organization repos:** Organization admin must approve the token request

**When to use Fine-grained Token:**
- ✅ Working with personal repositories
- ✅ Need minimal permissions (better security)
- ✅ Organization admin can approve quickly
- ⚠️ Requires Organization admin approval for org repos

### 4. Slack Bot Token (Optional)

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. App Name: `QA Automation Bot`, select workspace
4. Navigate to **OAuth & Permissions**
5. Add **Bot Token Scopes**:
   - `chat:write` - Send messages
   - `chat:write.public` - Send messages to public channels
6. Click **Install to Workspace**
7. Copy **Bot User OAuth Token** (starts with `xoxb-`)

**Create a channel for QA notifications:**

```
Channel name: #qa-automation
```

Invite the bot to the channel: `/invite @QA Automation Bot`

---

## ⚙️ Environment Configuration

### 1. Create `.env` File

```bash
cd quality-assurance-agent
cp .env.example .env
```

### 2. Fill in `.env` with Your Credentials

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Notion
NOTION_TOKEN=secret_xxxxx
NOTION_DATABASE_ID=a1b2c3d4e5f6xxxxx

# GitHub
GITHUB_TOKEN=ghp_xxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_DEFAULT_BRANCH=main

# Slack (Optional - comment out if not using)
SLACK_BOT_TOKEN=xoxb-xxxxx
SLACK_CHANNEL_QA=#qa-automation

# Agent Configuration
MAX_CONCURRENT_AGENTS=3
SESSION_TIMEOUT=3600000
LOG_LEVEL=debug
```

**IMPORTANT:** Replace all `xxxxx` placeholders with your actual credentials!

---

## 🛠️ Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:
- @anthropic-ai/sdk
- @modelcontextprotocol/sdk
- @octokit/rest
- @slack/web-api
- tesseract.js
- winston
- zod
- And all other dependencies

### 2. Build the Project

```bash
npm run build
```

Expected output:
```
> quality-assurance-agent@1.0.0 build
> tsc

✨  Done in 3.2s
```

### 3. Verify Build

```bash
ls -la dist/
```

You should see compiled JavaScript files mirroring the `src/` structure.

---

## ✅ Connection Validation

Before running the full agent, validate all connections:

### 1. Check Environment Variables

```bash
npm run typecheck
```

This will validate that all required environment variables are set.

### 2. Test Notion Connection

Create a simple test script `test-notion.js`:

```javascript
import { NotionMCPClient } from './dist/services/notion-mcp.js';

async function testNotion() {
  const client = new NotionMCPClient();

  try {
    await client.connect();
    console.log('✅ Notion connection successful!');

    const items = await client.queryDatabase();
    console.log(`✅ Found ${items.length} QA items`);

    await client.disconnect();
  } catch (error) {
    console.error('❌ Notion connection failed:', error.message);
  }
}

testNotion();
```

Run:
```bash
node test-notion.js
```

### 3. Test GitHub Connection

```bash
# Test GitHub API access
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO
```

Expected: JSON response with repo details (not 404 or 401)

### 4. Test Anthropic API

```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

Expected: JSON response with Claude's reply

### 5. Test Slack (Optional)

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#qa-automation",
    "text": "🤖 QA Automation Agent test message"
  }'
```

Expected: `"ok": true` in response

---

## 🧪 Phase 1 Test Scenarios

### Test Scenario 1: Simple Bug Fix

**Objective:** Test end-to-end workflow with a simple, actionable bug

#### Setup:

1. Create a new item in Notion QA database:

```
Title: Login button not clickable on mobile Safari
Status: Not Started
Description:
When using Safari on iPhone 13, the login button on /login page
does not respond to tap events. Works fine on desktop Chrome.

Steps to Reproduce:
1. Open https://example.com/login on iPhone Safari
2. Fill in username and password
3. Tap the "Login" button
4. Nothing happens - no navigation, no error

Expected: Should navigate to dashboard after successful login
Actual: Button does not respond to tap

Reporter: (your name)
Priority: high
```

#### Expected Agent Behavior:

1. **Detection (1-30s):** Agent polls Notion and detects new "Not Started" item
2. **Analysis (30-60s):**
   - Extracts issue details
   - Classifies as `bug`
   - Severity: `high`
   - Affected components: `[authentication, mobile-ui]`
3. **Classification (10-20s):**
   - Decision: `Actionable`
   - Work Type: `bug_fix`
   - Complexity: `moderate`
4. **Implementation (2-5min):**
   - Generates code fix (simulated)
   - Creates test cases
5. **PR Creation (30-60s):**
   - Creates branch: `qa-automation/bug_fix-{id}-{timestamp}`
   - Creates PR with detailed description
6. **Completion:**
   - Notion Status updated to `Done`
   - PR URL added to Notion
   - Slack notification sent (if configured)

#### Validation:

- [ ] Notion status changed to "In Progress" then "Done"
- [ ] GitHub PR created with descriptive title
- [ ] PR contains relevant files and test changes
- [ ] PR description includes issue analysis
- [ ] Notion PR URL field populated
- [ ] Slack notification received (if configured)
- [ ] Logs show all phases completed

### Test Scenario 2: Non-Actionable Issue

**Objective:** Test that agent correctly identifies non-actionable items

#### Setup:

Create Notion item:

```
Title: Consider migrating to React 19
Status: Not Started
Description:
React 19 beta was released. We should evaluate whether to upgrade.
This is more of a discussion point than an immediate action item.

Reporter: (your name)
Priority: low
```

#### Expected Agent Behavior:

1. Detection and Analysis complete
2. **Classification:** Decision = `Not Actionable`
3. **Status Update:** Notion status → `Not Actionable`
4. **No PR created**

#### Validation:

- [ ] Notion status changed to "Not Actionable"
- [ ] No GitHub PR created
- [ ] Agent log shows "Not actionable" reason
- [ ] Slack notification indicates non-actionable (if configured)

### Test Scenario 3: Feature Request

**Objective:** Test feature implementation workflow

#### Setup:

```
Title: Add dark mode toggle to user settings
Status: Not Started
Description:
Users have requested a dark mode option. Add a toggle switch in the
user settings page that switches between light and dark themes.

Expected behavior:
- Toggle appears in Settings > Appearance
- State persists across sessions (localStorage)
- All pages respect the dark mode preference

Reporter: (your name)
Priority: medium
```

#### Expected Agent Behavior:

1. Analysis: Issue Type = `feature`
2. Classification: Work Type = `feature`
3. Implementation: Generates component + styles + tests
4. PR Creation with "feat:" prefix

#### Validation:

- [ ] PR created with `feat:` prefix in title
- [ ] PR includes component, styles, and test files
- [ ] Notion status = Done
- [ ] PR description clearly explains feature

### Test Scenario 4: Issue with Screenshot

**Objective:** Test OCR and Vision API analysis

#### Setup:

1. Take a screenshot showing a UI bug (e.g., misaligned buttons)
2. Upload to Notion item:

```
Title: Buttons misaligned on checkout page
Status: Not Started
Description:
The "Proceed" and "Cancel" buttons are overlapping on the checkout page.
See screenshot attached.

(Attach screenshot to Notion page content)

Reporter: (your name)
Priority: high
```

#### Expected Agent Behavior:

1. **OCR Analysis:** Extracts text from screenshot
2. **Vision Analysis:** Describes visual issue
3. **Synthesis:** Combines text + visual evidence
4. **Implementation:** Generates CSS/layout fix

#### Validation:

- [ ] Agent logs show OCR text extraction
- [ ] Agent logs show vision API analysis
- [ ] PR includes layout/style fixes
- [ ] Visual evidence referenced in PR description

---

## 🐛 Troubleshooting

### Issue: MCP Connection Failed

```
Error: Not connected to Notion MCP
```

**Solutions:**
1. Check `NOTION_TOKEN` is correct (starts with `secret_`)
2. Verify integration has access to the database (Connection added?)
3. Ensure `@notionhq/notion-mcp-server` package can be run: `npx -y @notionhq/notion-mcp-server`

### Issue: GitHub Authentication Failed

```
Error: Bad credentials
```

**Solutions:**
1. Verify `GITHUB_TOKEN` is valid
2. Check token has `Contents: Write` and `Pull Requests: Write` permissions
3. Ensure token hasn't expired
4. Test with curl (see validation section)

### Issue: Anthropic API Error

```
Error: Invalid API key
```

**Solutions:**
1. Check `ANTHROPIC_API_KEY` format (should start with `sk-ant-api03-`)
2. Verify API key is active in Anthropic console
3. Check account has sufficient credits

### Issue: Agent Timeout

```
Error: Agent timeout after 300000ms
```

**Solutions:**
1. Increase timeout in agent config
2. Check network connectivity to APIs
3. Reduce complexity of QA item
4. Check Anthropic API rate limits

### Issue: Tests Failing (Future)

```
Error: Test suite failed
```

**Solutions:**
1. Check if test files are valid syntax
2. Verify test framework is installed
3. Inspect test output for specific failures

### Issue: No QA Items Detected

**Solutions:**
1. Verify Notion database has items with `Status = "Not Started"`
2. Check polling interval (default: 30s)
3. Ensure agent is running (`npm start`)
4. Check logs for errors: `tail -f logs/qa-automation.log`

---

## 📊 Monitoring Test Execution

### Real-time Log Monitoring

```bash
# All logs
tail -f logs/qa-automation.log

# Errors only
tail -f logs/error.log

# Filter by session
tail -f logs/qa-automation.log | grep "Session:session-"

# Filter by agent
tail -f logs/qa-automation.log | grep "\[qa-analyzer\]"
```

### Check Agent Progress

Logs will show phase progression:

```
[qa-analyzer] Starting QA analysis
[qa-analyzer] Analyzing text content...
[qa-analyzer] Analyzing images (if any)...
[action-classifier] Determining actionability...
[code-agent] Starting code implementation
[pr-manager] Creating pull request...
[Session:session-xxx] QA processing completed
```

---

## ✅ Success Criteria for Phase 1

Phase 1 testing is considered successful when:

- [ ] **Detection:** Agent detects new QA items within 60 seconds
- [ ] **Analysis:** Correctly extracts issue details, severity, affected components
- [ ] **Classification:** Accurately determines actionability (90%+ accuracy)
- [ ] **Implementation:** Generates valid code fixes (compiles without syntax errors)
- [ ] **PR Creation:** Creates PRs with descriptive titles and bodies
- [ ] **Notion Updates:** Status and PR URL fields updated correctly
- [ ] **Error Handling:** Gracefully handles API failures with retries
- [ ] **Logging:** Comprehensive logs for debugging
- [ ] **Multi-QA:** Can process multiple QA items sequentially without crashes

---

## 📈 Next Steps After Phase 1 Testing

Once Phase 1 testing is complete:

1. **Gather Metrics:**
   - Average processing time per QA
   - API costs per QA
   - Success rate (actionable detection accuracy)
   - PR approval rate (manual review)

2. **Identify Issues:**
   - False positives (non-actionable marked as actionable)
   - False negatives (actionable marked as non-actionable)
   - Code quality issues in generated fixes
   - Missing edge cases in tests

3. **Plan Phase 1.5:**
   - Real code implementation (not simulated)
   - Actual test execution
   - Repository cloning and file modification
   - Test validation before PR creation

4. **Prepare for Phase 2:**
   - Multi-project support
   - Project configuration system
   - Resource management across projects
   - Analytics dashboard

---

## 📞 Support and Feedback

If you encounter issues during testing:

1. Check **Troubleshooting** section above
2. Review logs in `logs/` directory
3. Validate all API connections individually
4. Create GitHub Issue with:
   - Error message
   - Relevant logs
   - Steps to reproduce
   - Environment details (Node version, OS, etc.)

---

**Happy Testing! 🚀**
