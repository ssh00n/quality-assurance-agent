# Phase 0 Testing Guide
## Frontend Repository (young-and-rich-frontend)

Complete step-by-step guide for testing QA Automation with the Frontend repository.

---

## 🎯 목표

Frontend 레포지토리(`young-and-rich-frontend`)를 대상으로 QA Automation의 기본 기능을 검증합니다:

1. ✅ Notion에서 QA 이슈 감지
2. ✅ AI 기반 이슈 분석
3. ✅ Actionability 판단
4. ✅ 코드 변경 생성 (시뮬레이션)
5. ✅ GitHub PR 생성
6. ✅ Notion 상태 업데이트

---

## 📋 사전 준비사항

### 1. 필수 계정 및 API 키

- [ ] **Anthropic API Key** - Claude API 사용
- [ ] **Notion Integration** - QA Database 접근
- [ ] **GitHub Token** - Frontend 레포지토리 접근 (classic token 권장)
- [ ] **Slack Bot Token** (선택사항) - 알림용

### 2. Frontend Repository 정보

```
Repository: https://github.com/ssh00n/young-and-rich-frontend
Technology: Next.js 16, React 19, TypeScript
Structure:
  - app/          # Next.js App Router
  - components/   # React components
  - lib/          # Utilities
  - hooks/        # Custom hooks
  - types/        # TypeScript types
```

---

## 🔧 설정 단계

### Step 1: API 키 획득

#### 1.1 Anthropic API Key

```bash
# 1. Visit: https://console.anthropic.com
# 2. Login or Sign up
# 3. Navigate to API Keys
# 4. Create new key
# 5. Copy key (starts with: sk-ant-api03-)
```

#### 1.2 Notion Integration

**Database 생성:**

1. Notion에서 새 Database 생성 (Table view)
2. 다음 속성 추가:

| Property | Type   | Options |
|----------|--------|---------|
| Title    | Title  | QA 이슈 제목 |
| Status   | Select | Not Started, In Progress, Done, Not Actionable |
| Description | Text | 상세 설명 |
| Reporter | Person | 보고자 |
| Priority | Select | critical, high, medium, low (선택) |
| PR URL   | URL    | Agent가 자동 입력 |

**Integration 생성:**

```bash
# 1. Visit: https://www.notion.so/my-integrations
# 2. New integration
# 3. Name: QA Automation Agent
# 4. Capabilities: Read, Update, Insert content
# 5. Submit
# 6. Copy Integration Token (starts with: secret_)
```

**Database 연결:**

```bash
# 1. Open your QA database
# 2. Click ••• (three dots) → Add connections
# 3. Search: QA Automation Agent
# 4. Confirm
```

**Database ID 추출:**

```
URL: https://www.notion.so/workspace/26f869f1fdb9804aa4b5ef5d0a6e795f?v=...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    This is your Database ID
```

#### 1.3 GitHub Token (Classic)

```bash
# 1. GitHub Settings → Developer Settings
# 2. Personal Access Tokens → Tokens (classic)
# 3. Generate new token (classic)
# 4. Scopes:
#    ✅ repo (full control)
# 5. Generate and copy (starts with: ghp_)
```

**왜 Classic Token인가?**
- Organization private repo 접근이 간단함
- Admin 승인 불필요
- Frontend repo에 즉시 사용 가능

---

### Step 2: 환경 변수 설정

#### 2.1 .env 파일 생성

```bash
cd quality-assurance-agent
cp .env.phase0 .env
```

#### 2.2 .env 파일 편집

```bash
# ============================================
# Anthropic API
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here

# ============================================
# Notion
# ============================================
NOTION_TOKEN=secret_your-actual-token-here
NOTION_DATABASE_ID=your-database-id-here
NOTION_STATUS_PROPERTY=Status
NOTION_TITLE_PROPERTY=Title

# ============================================
# GitHub - Frontend Repository
# ============================================
GITHUB_TOKEN=ghp_your-actual-token-here
GITHUB_OWNER=ssh00n
GITHUB_REPO=young-and-rich-frontend
GITHUB_DEFAULT_BRANCH=main

# ============================================
# Slack (선택사항 - 주석 처리 가능)
# ============================================
# SLACK_BOT_TOKEN=xoxb-your-token-here
# SLACK_CHANNEL_QA=#qa-automation

# ============================================
# Logging
# ============================================
LOG_LEVEL=debug
```

**⚠️ 중요**: `xxxxx` 부분을 실제 API 키로 교체하세요!

---

### Step 3: 연결 검증

#### 3.1 프로젝트 빌드

```bash
npm install
npm run build
```

#### 3.2 연결 테스트 실행

```bash
npm run test:phase0
```

**예상 출력:**

```
╔════════════════════════════════════════════════════════════╗
║          QA Automation - API Connection Tests             ║
║                    Phase 0 Validation                      ║
╚════════════════════════════════════════════════════════════╝

🧪 Testing Anthropic API...
  ✓ API connection successful

🧪 Testing GitHub API...
  ✓ Repository access confirmed
  ✓ Permissions verified (push: true, pull: true)

🧪 Testing Notion MCP...
  ✓ Connected to Notion MCP
  ✓ Found 0 items in database

╔════════════════════════════════════════════════════════════╗
║                     Test Summary                           ║
╚════════════════════════════════════════════════════════════╝

✅ Anthropic API       Connection successful
   Details: {
     "model": "claude-3-5-sonnet-20241022",
     "response": "API connection successful"
   }

✅ GitHub API          Connection successful
   Details: {
     "repository": "ssh00n/young-and-rich-frontend",
     "defaultBranch": "main",
     "branches": ["main", "develop"],
     "permissions": { "push": true, "pull": true },
     "private": true
   }

✅ Notion MCP          Connection successful
   Details: {
     "databaseId": "26f869f1...",
     "itemCount": 0
   }

────────────────────────────────────────────────────────────
Total: 3 tests
Passed: 3
Failed: 0

🎉 All tests passed! Ready for Phase 0 testing.
```

**만약 실패한다면:**

```bash
# Anthropic API 실패
❌ Anthropic API: Invalid API key
→ API 키가 올바른지 확인 (sk-ant-api03-로 시작)

# GitHub API 실패
❌ GitHub API: Not Found
→ Repository 이름 확인 (ssh00n/young-and-rich-frontend)
→ Token 권한 확인 (repo scope 필요)

# Notion MCP 실패
❌ Notion MCP: Connection failed
→ Integration이 Database에 연결되었는지 확인
→ Database ID가 올바른지 확인
```

---

## 🧪 Phase 0 테스트 시나리오

### 시나리오 1: 간단한 버그 수정

#### 목표
Frontend UI 버그를 감지하고 PR까지 자동 생성

#### 테스트 절차

**1. Notion에 QA 생성:**

```
Title: 로그인 버튼 클릭 시 반응 없음

Description:
Next.js App에서 로그인 페이지(/login)의 로그인 버튼을 클릭해도
아무 반응이 없습니다.

재현 방법:
1. http://localhost:3000/login 접속
2. Username과 Password 입력
3. "로그인" 버튼 클릭
4. 아무 일도 일어나지 않음

예상 동작: Dashboard로 이동
실제 동작: 버튼 클릭해도 반응 없음

Reporter: (your name)
Priority: high
Status: Not Started
```

**2. Agent 실행:**

```bash
# Terminal 1: Agent 실행
npm start

# Terminal 2: 로그 모니터링
tail -f logs/qa-automation.log
```

**3. 예상되는 Agent 동작:**

```
[Orchestrator] Starting QA processing for item: 로그인 버튼 클릭 시 반응 없음
[qa-analyzer] Starting QA analysis
[qa-analyzer] Issue Type: bug, Severity: high
[qa-analyzer] Affected Components: [auth, login-ui, components]
[action-classifier] Determining actionability...
[action-classifier] Decision: Actionable, Work Type: bug_fix
[code-agent] Starting code implementation
[code-agent] Generating code changes for bug fix...
[code-agent] Generated 2 file changes
[pr-manager] Creating pull request...
[pr-manager] Branch: qa-automation/bug_fix-{id}-{timestamp}
[pr-manager] PR created: #123
[Session:xxx] QA processing completed successfully
```

**4. 검증 체크리스트:**

- [ ] Notion Status: `Not Started` → `In Progress` → `Done`
- [ ] GitHub: 새 branch 생성됨
- [ ] GitHub: PR 생성됨
- [ ] PR Title: `fix: 로그인 버튼 클릭 시 반응 없음` 형식
- [ ] PR Description: 상세한 분석 내용 포함
- [ ] PR Files: 관련 파일 수정 사항 포함
- [ ] Notion `PR URL` 필드: PR URL로 업데이트됨
- [ ] Logs: 모든 단계 성공적으로 기록

---

### 시나리오 2: Non-Actionable Issue

#### 목표
액션 불가능한 이슈를 올바르게 분류

#### 테스트 절차

**1. Notion에 QA 생성:**

```
Title: React 19로 업그레이드 검토

Description:
React 19가 정식 출시되었습니다.
성능 개선과 새 기능들을 검토하고 업그레이드를 고려해야 합니다.

이것은 즉시 실행할 작업이 아니라 논의가 필요한 항목입니다.

Priority: low
Status: Not Started
```

**2. 예상 동작:**

```
[qa-analyzer] Analyzing issue...
[action-classifier] Evaluating actionability...
[action-classifier] Decision: Not Actionable
[action-classifier] Reason: Requires discussion, not immediate code change
[Orchestrator] Marking as Not Actionable
```

**3. 검증:**

- [ ] Notion Status: `Not Actionable`
- [ ] GitHub: PR 생성되지 않음
- [ ] Logs: "Not Actionable" 이유 명시

---

### 시나리오 3: Feature Request

#### 목표
새 기능 요청 처리

**1. Notion에 QA 생성:**

```
Title: Dashboard에 사용자 통계 차트 추가

Description:
Dashboard 페이지에 사용자의 활동 통계를 보여주는 차트를 추가해주세요.

요구사항:
- 지난 7일간의 활동 데이터
- Line chart 형태
- Chart.js 또는 Recharts 사용
- 반응형 디자인

예상 위치: app/dashboard/page.tsx

Priority: medium
Status: Not Started
```

**2. 예상 동작:**

```
[qa-analyzer] Issue Type: feature
[action-classifier] Work Type: feature
[code-agent] Generating feature implementation...
[pr-manager] PR Title: feat: Dashboard에 사용자 통계 차트 추가
```

**3. 검증:**

- [ ] PR Title이 `feat:` prefix로 시작
- [ ] 새 컴포넌트 파일 생성됨
- [ ] Dashboard 페이지 수정됨
- [ ] 관련 타입 정의 추가됨

---

## 📊 모니터링 및 디버깅

### 로그 확인

```bash
# 전체 로그
tail -f logs/qa-automation.log

# 에러만
tail -f logs/error.log

# 특정 Agent 로그만
tail -f logs/qa-automation.log | grep "\[qa-analyzer\]"

# 특정 Session 로그만
tail -f logs/qa-automation.log | grep "Session:session-xxx"
```

### 진행 상황 확인

Agent가 실행되면 다음과 같은 단계를 거칩니다:

```
1. DETECTION     (0%)   → QA 감지
2. ANALYSIS      (20%)  → 이슈 분석
3. CLASSIFICATION(40%)  → Actionability 판단
4. IMPLEMENTATION(60%)  → 코드 변경 생성
5. PR_CREATION   (80%)  → PR 생성
6. COMPLETION    (100%) → 완료 및 알림
```

---

## 🐛 문제 해결

### Issue: Agent가 QA를 감지하지 못함

**원인:**
- Polling 간격이 길어서 대기 중
- Notion Status가 "Not Started"가 아님

**해결:**
```bash
# .env에서 polling 간격 줄이기
FALLBACK_POLLING_INTERVAL=10  # 10초로 단축

# Notion에서 Status 확인
Status = "Not Started" ✅
```

### Issue: PR 생성 실패

**원인:**
- GitHub Token 권한 부족
- Branch 이름 중복

**해결:**
```bash
# Token 권한 확인
# repo scope가 있는지 확인

# 수동으로 branch 삭제
cd /path/to/young-and-rich-frontend
git branch -D qa-automation/bug_fix-xxx
git push origin --delete qa-automation/bug_fix-xxx
```

### Issue: Notion 업데이트 실패

**원인:**
- Integration 연결 끊김
- Database ID 불일치

**해결:**
```bash
# 1. Notion에서 Integration 재연결
# 2. Database ID 재확인
# 3. Agent 재시작
```

---

## ✅ Phase 0 성공 기준

Phase 0 테스트가 성공으로 간주되려면:

- [x] **Detection**: 30초 내 QA 감지
- [x] **Analysis**: 이슈 타입, 심각도, 영향 컴포넌트 정확히 추출
- [x] **Classification**: Actionable/Non-actionable 정확히 판단 (90%+)
- [x] **Implementation**: 코드 변경 생성 (문법 오류 없이)
- [x] **PR Creation**: 유효한 PR 생성 (제목, 설명, 파일 변경 포함)
- [x] **Notion Update**: Status 및 PR URL 업데이트
- [x] **Error Handling**: API 실패 시 재시도 및 graceful degradation
- [x] **Logging**: 모든 단계 로깅 (디버깅 가능)

---

## 🎯 다음 단계

Phase 0가 성공하면:

1. **Phase 1.5**: 실제 코드 수정 기능 구현
   - Repository cloning
   - 실제 파일 수정
   - 테스트 실행 및 검증

2. **Phase 2**: Multi-Repository 지원
   - Frontend + Backend 동시 수정
   - Component mapping
   - Cross-repo PR linking

3. **Phase 3**: Intelligence & Learning
   - PR approval rate 추적
   - 피드백 학습
   - Pattern recognition

---

## 📞 도움이 필요하신가요?

**디버깅 체크리스트:**
1. `npm run test:phase0`로 모든 연결 검증
2. 로그 확인: `tail -f logs/qa-automation.log`
3. API 키 재확인
4. Notion Database 속성 이름 정확히 일치하는지 확인

**GitHub Issues:**
https://github.com/ssh00n/quality-assurance-agent/issues

---

**Happy Testing! 🚀**

Phase 0 성공 후 Multi-Repo 지원으로 확장할 준비가 됩니다!
