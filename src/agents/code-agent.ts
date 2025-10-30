/**
 * Code Agent
 * Implements code changes based on QA analysis
 *
 * Phase 1: Simulated Implementation (MVP)
 * - Generates code changes using Claude
 * - Does not actually modify files
 * - Returns structured code changes for PR Manager
 *
 * Phase 1.5: Real Implementation (Production)
 * - Clone repository
 * - Apply actual file changes
 * - Run tests
 * - Validate changes
 */

import { BaseAgent } from './base.js';
import { logger } from '../utils/logger.js';
import {
  AgentConfig,
  AgentContext,
  QAAnalysis,
  ClassificationDecision,
  CodeChanges,
  FileChange,
  TestResults,
  WorkflowPhase,
} from '../types/index.js';

/**
 * Code Agent input
 */
export interface CodeAgentInput {
  analysis: QAAnalysis;
  decision: ClassificationDecision;
}

/**
 * Code Agent
 */
export class CodeAgent extends BaseAgent<CodeAgentInput, CodeChanges> {
  constructor(config: AgentConfig, context: AgentContext) {
    super(
      {
        ...config,
        agentType: 'code-agent',
        timeout: config.timeout || 1800000, // 30 minutes
      },
      context
    );
  }

  /**
   * Run code implementation
   */
  protected async run(input?: CodeAgentInput): Promise<CodeChanges> {
    const analysis = input?.analysis || this.context.analysis;
    const decision = input?.decision || this.context.decision;

    if (!analysis || !decision) {
      throw new Error('Missing analysis or decision for code implementation');
    }

    if (!decision.shouldAct) {
      throw new Error('Code agent called for non-actionable QA item');
    }

    logger.agent('code-agent', 'Starting code implementation', {
      qaId: this.context.qaItem.id,
      workType: decision.workType,
      complexity: decision.estimatedComplexity,
    });

    this.updateProgress('Analyzing codebase context...', WorkflowPhase.IMPLEMENTATION, 10);

    // Step 1: Analyze codebase (simulated for MVP)
    const codebaseContext = await this.analyzeCodebase(analysis, decision);

    this.updateProgress('Generating code changes...', WorkflowPhase.IMPLEMENTATION, 40);

    // Step 2: Generate code changes
    const fileChanges = await this.generateCodeChanges(analysis, decision, codebaseContext);

    this.updateProgress('Generating tests...', WorkflowPhase.IMPLEMENTATION, 70);

    // Step 3: Generate/update tests
    const testChanges = await this.generateTests(analysis, decision, fileChanges);

    this.updateProgress('Validating changes...', WorkflowPhase.IMPLEMENTATION, 90);

    // Step 4: Mock test execution (for MVP)
    const testResults = await this.runTests(fileChanges.concat(testChanges));

    this.updateProgress('Code implementation completed', WorkflowPhase.IMPLEMENTATION, 100);

    const codeChanges: CodeChanges = {
      files: fileChanges.concat(testChanges),
      tests: testResults,
      summary: this.generateSummary(fileChanges, testChanges, decision),
      generatedAt: new Date(),
    };

    logger.agent('code-agent', 'Code implementation completed', {
      filesChanged: codeChanges.files.length,
      testsStatus: `${testResults.passed}/${testResults.total} passed`,
    });

    return codeChanges;
  }

  /**
   * Analyze codebase to understand context (simulated)
   */
  private async analyzeCodebase(
    analysis: QAAnalysis,
    decision: ClassificationDecision
  ): Promise<string> {
    const prompt = `
You are analyzing a codebase to understand the context for implementing a fix.

# QA Analysis
${JSON.stringify(analysis, null, 2)}

# Work Classification
${JSON.stringify(decision, null, 2)}

# Affected Components
${analysis.affectedComponents.join(', ')}

# Your Task
Based on the affected components and issue description, provide:
1. Likely file locations that need changes
2. Key functions/classes involved
3. Dependencies to consider
4. Potential side effects

Respond with a concise analysis (3-5 paragraphs).
`;

    const systemPrompt = `You are an expert software architect analyzing codebases.`;

    return await this.callClaude(prompt, systemPrompt, {
      temperature: 0.4,
    });
  }

  /**
   * Generate code changes
   */
  private async generateCodeChanges(
    analysis: QAAnalysis,
    decision: ClassificationDecision,
    codebaseContext: string
  ): Promise<FileChange[]> {
    const prompt = this.buildImplementationPrompt(analysis, decision, codebaseContext);

    const systemPrompt = `You are an expert software engineer implementing fixes and features.
Generate clean, maintainable code that follows best practices.
Respond with valid JSON containing file changes.`;

    const response = await this.callClaude(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 8192,
    });

    const parsed = this.parseJSON<{ files: FileChange[] }>(response);

    return parsed.files || [];
  }

  /**
   * Build implementation prompt
   */
  private buildImplementationPrompt(
    analysis: QAAnalysis,
    decision: ClassificationDecision,
    codebaseContext: string
  ): string {
    return `
# Task: Implement ${decision.workType}

## Issue Analysis
${analysis.summary}

**Type:** ${analysis.issueType}
**Severity:** ${analysis.severity}
**Complexity:** ${decision.estimatedComplexity}

## Steps to Reproduce
${analysis.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Expected vs Actual Behavior
- **Expected:** ${analysis.expectedBehavior}
- **Actual:** ${analysis.actualBehavior}

## Suspected Root Cause
${analysis.suspectedRootCause || 'Not identified'}

## Affected Components
${analysis.affectedComponents.join(', ')}

## Codebase Context
${codebaseContext}

## Your Task

${
  decision.workType === 'bug_fix'
    ? `1. Locate the bug in the affected components
2. Implement the fix
3. Ensure the fix addresses the root cause`
    : `1. Implement the ${decision.workType}
2. Follow existing code patterns
3. Ensure backward compatibility`
}

## Requirements
- Write clean, maintainable code
- Follow existing code style
- Add inline comments for complex logic
- Consider edge cases
- Ensure type safety (if TypeScript)

## Response Format

Provide file changes in JSON format:

{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "content": "complete file content after changes",
      "changeType": "modified | created | deleted",
      "description": "Brief description of changes made"
    }
  ]
}

Important:
- Provide COMPLETE file content, not diffs
- Include proper imports and exports
- Ensure syntax is valid
- Only include files that actually need changes

Generate the implementation now.
`;
  }

  /**
   * Generate test changes
   */
  private async generateTests(
    analysis: QAAnalysis,
    _decision: ClassificationDecision,
    implementationFiles: FileChange[]
  ): Promise<FileChange[]> {
    const prompt = `
# Task: Generate Tests

## Implementation Files
${implementationFiles.map((f) => `- ${f.path}: ${f.description}`).join('\n')}

## QA Details
- Issue: ${analysis.summary}
- Expected Behavior: ${analysis.expectedBehavior}

## Your Task
Generate test files to verify the fix/feature:

1. Test the specific bug/feature
2. Test edge cases
3. Ensure regression tests
4. Follow existing test patterns

Use appropriate testing framework (Jest, Vitest, etc.).

Respond in same JSON format:
{
  "files": [
    {
      "path": "path/to/test.test.ts",
      "content": "complete test file content",
      "changeType": "modified | created",
      "description": "Test description"
    }
  ]
}
`;

    const systemPrompt = `You are an expert at writing comprehensive tests.`;

    const response = await this.callClaude(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 8192,
    });

    const parsed = this.parseJSON<{ files: FileChange[] }>(response);

    return parsed.files || [];
  }

  /**
   * Run tests (simulated for MVP)
   */
  private async runTests(files: FileChange[]): Promise<TestResults> {
    // For MVP: Simulate test execution
    // In production: Actually run tests via exec()

    logger.debug('Running tests (simulated)', {
      fileCount: files.length,
    });

    // Simulate test execution
    const testFiles = files.filter((f) => f.path.includes('.test.') || f.path.includes('.spec.'));

    // Mock results: assume tests pass for MVP
    return {
      total: Math.max(testFiles.length * 3, 5), // Simulate 3 tests per test file
      passed: Math.max(testFiles.length * 3, 5),
      failed: 0,
      skipped: 0,
      duration: 1500, // 1.5 seconds
      coverage: 85, // 85% coverage
      failures: [],
    };
  }

  /**
   * Generate summary of changes
   */
  private generateSummary(
    implementationFiles: FileChange[],
    testFiles: FileChange[],
    decision: ClassificationDecision
  ): string {
    const summary = [
      `Implemented ${decision.workType} (${decision.estimatedComplexity} complexity)`,
      '',
      '**Changes:**',
      ...implementationFiles.map((f) => `- ${f.path}: ${f.description}`),
      '',
      '**Tests:**',
      ...testFiles.map((f) => `- ${f.path}: ${f.description}`),
    ];

    return summary.join('\n');
  }
}
