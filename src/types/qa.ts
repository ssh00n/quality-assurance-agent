/**
 * QA-related type definitions
 */

/**
 * Notion QA Item from database
 */
export interface NotionQAItem {
  id: string;
  url: string;
  title: string;
  description: string;
  status: QAStatus;
  priority?: QAPriority;
  images?: string[]; // Base64 or URLs
  metadata: {
    reporter: string;
    createdAt: Date;
    updatedAt: Date;
    databaseId: string;
  };
}

/**
 * QA Status values
 */
export enum QAStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  NOT_ACTIONABLE = 'Not Actionable',
  IN_REVIEW = 'In Review',
  CANCELLED = 'Cancelled',
}

/**
 * QA Priority levels
 */
export enum QAPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * QA Analysis result from QA Analyzer Agent
 */
export interface QAAnalysis {
  summary: string;
  issueType: IssueType;
  severity: Severity;

  // Extracted from text + OCR
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;

  // From images
  visualEvidence: VisualEvidence[];

  // Technical details
  affectedComponents: string[];
  suspectedRootCause?: string;
  relatedIssues?: string[];

  // Metadata
  analyzedAt: Date;
  confidence: number; // 0-1
}

/**
 * Issue Type classification
 */
export enum IssueType {
  BUG = 'bug',
  FEATURE = 'feature',
  IMPROVEMENT = 'improvement',
  QUESTION = 'question',
  DOCUMENTATION = 'documentation',
}

/**
 * Severity levels
 */
export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Visual evidence from image analysis
 */
export interface VisualEvidence {
  description: string;
  extractedText?: string;
  relevantDetails: string[];
}

/**
 * Classification decision from Action Classifier Agent
 */
export interface ClassificationDecision {
  shouldAct: boolean;
  confidence: number; // 0-1

  reason: string;
  workType?: WorkType;
  estimatedComplexity?: Complexity;
  requiredSkills?: string[];

  blockers?: string[];
  prerequisites?: string[];

  // Metadata
  classifiedAt: Date;
}

/**
 * Work Type for actionable items
 */
export enum WorkType {
  BUG_FIX = 'bug_fix',
  FEATURE_ADD = 'feature_add',
  REFACTOR = 'refactor',
  DOCUMENTATION = 'documentation',
  TEST_ADDITION = 'test_addition',
}

/**
 * Complexity estimation
 */
export enum Complexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
}

/**
 * Code changes result from Code Agent
 */
export interface CodeChanges {
  files: FileChange[];
  tests: TestResults;
  summary: string;

  // Metadata
  generatedAt: Date;
  branch?: string;
}

/**
 * Individual file change
 */
export interface FileChange {
  path: string;
  content: string;
  changeType: ChangeType;
  description: string;
}

/**
 * Change type for files
 */
export enum ChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
}

/**
 * Test execution results
 */
export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration?: number; // milliseconds
  coverage?: number; // percentage
  failures?: TestFailure[];
}

/**
 * Individual test failure
 */
export interface TestFailure {
  testName: string;
  error: string;
  stackTrace?: string;
}

/**
 * Pull Request information from PR Manager Agent
 */
export interface PullRequest {
  url: string;
  number: number;
  branch: string;
  title: string;
  body: string;
  labels: string[];

  // Metadata
  createdAt: Date;
  repository: {
    owner: string;
    repo: string;
  };
}
