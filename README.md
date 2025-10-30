# 🤖 QA Automation Agent

**Agent-based Quality Assurance Automation Framework** powered by Notion MCP + Claude Agent SDK

Automatically detects, analyzes, and fixes QA issues from Notion databases - from bug detection to PR submission - completely automated!

---

## ✨ Features

- 🔍 **Automatic QA Detection** - Real-time monitoring of Notion QA databases
- 🧠 **AI-Powered Analysis** - Claude analyzes text + images (OCR + Vision API)
- 🤔 **Smart Classification** - Determines actionability and work complexity
- 💻 **Automated Code Fixes** - Generates bug fixes and features automatically
- ✅ **Test Generation** - Creates comprehensive test suites
- 🔀 **PR Management** - Creates GitHub Pull Requests with detailed descriptions
- 💬 **Slack Integration** - Real-time notifications for team visibility
- 📊 **Multi-Project Support** - Handles multiple repositories (roadmap)

---

## 🏗️ Architecture

```
Notion QA (Not Started)
    ↓
QA Analyzer Agent
    ├─ Text Analysis (Claude)
    ├─ Image OCR (Tesseract.js)
    └─ Vision Analysis (Claude Vision)
    ↓
Action Classifier Agent
    ├─ Actionability Check
    ├─ Work Type Classification
    └─ Complexity Estimation
    ↓
Code Agent
    ├─ Codebase Analysis
    ├─ Bug Fix Implementation
    └─ Test Generation
    ↓
PR Manager Agent
    ├─ Branch Creation
    ├─ Code Commit
    └─ Pull Request
    ↓
✅ Done + Slack Notification
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Notion workspace with Integration
- GitHub repository access
- Anthropic API key
- Slack workspace (optional)

### Installation

```bash
# Clone the repository
git clone <your-repo>
cd quality-assurance-agent

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Build the project
npm run build

# Run the agent
npm start
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file with the following:

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Notion
NOTION_TOKEN=secret_xxxxx
NOTION_DATABASE_ID=your-database-id

# GitHub
GITHUB_TOKEN=ghp_xxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_DEFAULT_BRANCH=main

# Slack (Optional)
SLACK_BOT_TOKEN=xoxb-xxxxx
SLACK_CHANNEL_QA=#qa-automation

# Agent Configuration
MAX_CONCURRENT_AGENTS=3
SESSION_TIMEOUT=3600
LOG_LEVEL=info
```

See `.env.example` for complete configuration options.

---

## 📖 Usage

### 1. Setup Notion Database

Create a Notion database with the following properties:

- **Title** (title): QA issue title
- **Status** (select): Not Started, In Progress, Done, Not Actionable
- **Description** (rich text): Issue description
- **Reporter** (person): Who reported the issue
- **Priority** (select, optional): critical, high, medium, low
- **PR URL** (url, optional): Auto-filled by the agent

### 2. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create new integration
3. Copy the Integration Token → `NOTION_TOKEN`
4. Share your database with the integration

### 3. Setup GitHub Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate new token (fine-grained)
3. Grant permissions:
   - Contents: Read & Write
   - Pull Requests: Read & Write
4. Copy token → `GITHUB_TOKEN`

### 4. Get Anthropic API Key

1. Go to https://console.anthropic.com
2. Create API key
3. Copy → `ANTHROPIC_API_KEY`

### 5. Run the Agent

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm start
```

### 6. Create a QA Item in Notion

1. Add new item to your Notion database
2. Set Status to "Not Started"
3. Watch the magic happen! 🎩✨

---

## 🎬 Example Workflow

```
1. QA Reported in Notion
   Title: "Login button not working on mobile"
   Description: "When I tap login on iOS, nothing happens"
   Status: Not Started

2. Agent Detects QA
   📥 New QA detected: "Login button not working..."

3. Analysis Phase
   🔍 Analyzing text and images...
   Issue Type: bug
   Severity: high
   Affected Components: [auth, mobile-ui]

4. Classification Phase
   🤔 Determining actionability...
   Decision: Actionable
   Work Type: bug_fix
   Complexity: moderate

5. Implementation Phase
   💻 Generating code fix...
   Files Changed:
     - src/components/LoginButton.tsx
     - tests/LoginButton.test.tsx

6. PR Creation
   🔀 Creating pull request...
   PR #123 created: "fix: Login button not working on mobile"

7. Completion
   ✅ QA completed!
   Notion updated: Status → Done, PR URL added
   Slack notification sent: "QA #123 completed! Review PR"
```

---

## 🛠️ Development

### Project Structure

```
quality-assurance-agent/
├── src/
│   ├── agents/              # Agent implementations
│   │   ├── base.ts          # Base agent class
│   │   ├── qa-analyzer.ts   # QA analysis
│   │   ├── action-classifier.ts
│   │   ├── code-agent.ts    # Code implementation
│   │   └── pr-manager.ts    # PR management
│   │
│   ├── orchestrator/        # Main orchestration
│   │   ├── main.ts          # Main orchestrator
│   │   └── session-manager.ts
│   │
│   ├── services/            # External integrations
│   │   ├── notion-mcp.ts    # Notion MCP client
│   │   ├── github-client.ts # GitHub API
│   │   ├── slack-notifier.ts
│   │   └── ocr-service.ts
│   │
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities
│   └── index.ts             # Entry point
│
├── config/                  # Configuration files
├── tests/                   # Test suites
├── docs/                    # Documentation
└── logs/                    # Application logs
```

### Available Scripts

```bash
# Development
npm run dev          # Run with hot reload
npm run build        # Build TypeScript
npm start            # Run production build

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Coverage report

# Type Checking
npm run typecheck    # TypeScript type check
```

### Adding a New Agent

1. Create new agent class extending `BaseAgent`:

```typescript
import { BaseAgent } from './base.js';
import type { AgentConfig, AgentContext } from '../types/index.js';

export class MyCustomAgent extends BaseAgent<InputType, OutputType> {
  constructor(config: AgentConfig, context: AgentContext) {
    super(
      {
        ...config,
        agentType: 'my-custom-agent',
        timeout: 120000,
      },
      context
    );
  }

  protected async run(input?: InputType): Promise<OutputType> {
    // Your implementation
  }
}
```

2. Add to orchestrator workflow
3. Update type definitions
4. Write tests

---

## 📚 Documentation

- [Agent Architecture](docs/AGENT_ARCHITECTURE.md) - Detailed architecture explanation
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md) - Development phases
- [Setup Guide](docs/SETUP.md) - Complete setup instructions
- [Multi-Project Guide](docs/MULTI_PROJECT.md) - Multi-project configuration

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: MCP Connection Failed**
```
Error: Not connected to Notion MCP
```
Solution: Check NOTION_TOKEN and ensure integration has access to the database

**Issue: GitHub Authentication Failed**
```
Error: Bad credentials
```
Solution: Verify GITHUB_TOKEN is valid and has correct permissions

**Issue: Anthropic API Error**
```
Error: Invalid API key
```
Solution: Check ANTHROPIC_API_KEY format (should start with `sk-ant-`)

**Issue: Agent Timeout**
```
Error: Agent timeout after 300000ms
```
Solution: Increase timeout in agent configuration or check API connectivity

---

## 🔐 Security

- ✅ All API keys stored in `.env` (not committed)
- ✅ Fine-grained GitHub tokens (minimal permissions)
- ✅ Notion Integration scoped to specific databases
- ✅ Code Agent restricted file access
- ✅ Comprehensive audit logging

**Never commit `.env` or expose API keys!**

---

## 📊 Monitoring

Logs are written to:
- `logs/qa-automation.log` - All logs
- `logs/error.log` - Errors only
- `logs/exceptions.log` - Uncaught exceptions

Monitor agent activity:
```bash
# Tail logs
tail -f logs/qa-automation.log

# Filter by session
tail -f logs/qa-automation.log | grep "Session:session-123"

# Filter by agent type
tail -f logs/qa-automation.log | grep "\[qa-analyzer\]"
```

---

## 🚦 Roadmap

### Phase 1: Single Project (✅ Current)
- [x] Complete agent architecture
- [x] Notion MCP integration
- [x] GitHub PR automation
- [x] Slack notifications
- [x] Full documentation

### Phase 2: Multi-Project
- [ ] Project configuration system
- [ ] Resource management
- [ ] Cross-project analytics
- [ ] Admin dashboard

### Phase 3: Intelligence & Learning
- [ ] Track PR approval rates
- [ ] Learn from feedback
- [ ] Pattern recognition
- [ ] Custom agent plugins

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) - Claude API
- [Notion](https://notion.so) - MCP Server
- [@modelcontextprotocol/sdk](https://github.com/anthropics/model-context-protocol) - MCP SDK
- [@octokit/rest](https://github.com/octokit/rest.js) - GitHub API
- [Tesseract.js](https://github.com/naptha/tesseract.js) - OCR

---

## 📞 Support

- **GitHub Issues**: https://github.com/ssh00n/quality-assurance-agent/issues
- **Documentation**: See `/docs` directory
- **Examples**: See `/samples` directory

---

**Built with ❤️ using TypeScript, Claude, and Notion MCP**

🤖 **Happy Automating!**
