/**
 * Action Classifier Agent
 * Determines if a QA item is actionable and classifies the work type
 */

import { BaseAgent } from './base.js';
import { logger } from '../utils/logger.js';
import {
  AgentConfig,
  AgentContext,
  QAAnalysis,
  ClassificationDecision,
  WorkType,
  Complexity,
  WorkflowPhase,
} from '../types/index.js';

/**
 * Action Classifier input
 */
export interface ActionClassifierInput {
  analysis: QAAnalysis;
}

/**
 * Action Classifier Agent
 */
export class ActionClassifierAgent extends BaseAgent<ActionClassifierInput, ClassificationDecision> {
  constructor(config: AgentConfig, context: AgentContext) {
    super(
      {
        ...config,
        agentType: 'action-classifier',
        timeout: config.timeout || 60000, // 1 minute
      },
      context
    );
  }

  /**
   * Run classification
   */
  protected async run(input?: ActionClassifierInput): Promise<ClassificationDecision> {
    const analysis = input?.analysis || this.context.analysis;

    if (!analysis) {
      throw new Error('No QA analysis available for classification');
    }

    logger.agent('action-classifier', 'Starting classification', {
      qaId: this.context.qaItem.id,
      issueType: analysis.issueType,
      severity: analysis.severity,
    });

    this.updateProgress('Evaluating actionability...', WorkflowPhase.CLASSIFICATION, 30);

    // Step 1: Quick heuristic check
    const heuristicCheck = this.evaluateWithHeuristics(analysis);

    if (!heuristicCheck.shouldAct) {
      logger.agent('action-classifier', 'Classified as not actionable (heuristics)', {
        reason: heuristicCheck.reason,
      });

      return {
        shouldAct: false,
        confidence: 0.9,
        reason: heuristicCheck.reason,
        classifiedAt: new Date(),
      };
    }

    this.updateProgress('Classifying work type with AI...', WorkflowPhase.CLASSIFICATION, 60);

    // Step 2: AI-powered classification
    const decision = await this.classifyWithAI(analysis);

    this.updateProgress('Classification completed', WorkflowPhase.CLASSIFICATION, 100);

    logger.agent('action-classifier', 'Classification completed', {
      shouldAct: decision.shouldAct,
      workType: decision.workType,
      complexity: decision.estimatedComplexity,
      confidence: decision.confidence,
    });

    return decision;
  }

  /**
   * Evaluate using heuristics
   */
  private evaluateWithHeuristics(analysis: QAAnalysis): { shouldAct: boolean; reason: string } {
    // Rule 1: Questions are not actionable
    if (analysis.issueType === 'question') {
      return {
        shouldAct: false,
        reason: 'This is a question, not an actionable issue',
      };
    }

    // Rule 2: Need minimum information
    if (
      !analysis.stepsToReproduce ||
      analysis.stepsToReproduce.length === 0 ||
      !analysis.affectedComponents ||
      analysis.affectedComponents.length === 0
    ) {
      return {
        shouldAct: false,
        reason: 'Insufficient information: missing steps to reproduce or affected components',
      };
    }

    // Rule 3: Low confidence analysis might not be actionable
    if (analysis.confidence < 0.4) {
      return {
        shouldAct: false,
        reason: 'Low confidence in analysis - need more information',
      };
    }

    // Rule 4: Documentation requests might need human review
    if (analysis.issueType === 'documentation' && analysis.severity === 'low') {
      return {
        shouldAct: false,
        reason: 'Low priority documentation request - consider manual review',
      };
    }

    // Passed heuristics
    return {
      shouldAct: true,
      reason: 'Passed heuristic checks',
    };
  }

  /**
   * Classify with AI
   */
  private async classifyWithAI(analysis: QAAnalysis): Promise<ClassificationDecision> {
    const prompt = this.buildClassificationPrompt(analysis);

    const systemPrompt = `You are an expert at classifying software issues and determining if they can be automated.
Consider:
1. Is the issue clearly defined?
2. Can it be fixed/implemented automatically?
3. What's the complexity level?
4. Are there any blockers?

Respond ONLY with valid JSON.`;

    const response = await this.callClaude(prompt, systemPrompt, {
      temperature: 0.3,
    });

    const parsed = this.parseJSON<any>(response);

    return {
      shouldAct: parsed.shouldAct ?? true,
      confidence: parsed.confidence ?? 0.7,
      reason: parsed.reason || 'AI classification',
      workType: parsed.workType as WorkType,
      estimatedComplexity: parsed.estimatedComplexity as Complexity,
      requiredSkills: parsed.requiredSkills || [],
      blockers: parsed.blockers || [],
      prerequisites: parsed.prerequisites || [],
      classifiedAt: new Date(),
    };
  }

  /**
   * Build classification prompt
   */
  private buildClassificationPrompt(analysis: QAAnalysis): string {
    return `
Analyze this QA issue and determine if it's actionable for automated code changes.

# QA Analysis

${JSON.stringify(analysis, null, 2)}

# Your Task

Determine:
1. **Should we take action?** (Can this be automated?)
2. **What type of work is needed?**
3. **How complex is it?**
4. **Are there any blockers?**

# Classification Criteria

## Actionability
- ✅ Actionable if:
  - Clear, reproducible issue
  - Sufficient technical details
  - Scope is well-defined
  - No external dependencies blocking work

- ❌ Not actionable if:
  - Vague or unclear requirements
  - Missing critical information
  - Requires product/design decisions
  - Infrastructure or external service issues
  - Security vulnerabilities (need manual review)

## Work Type
- **bug_fix**: Fixing broken functionality
- **feature_add**: Adding new functionality
- **refactor**: Improving code structure
- **documentation**: Documentation updates
- **test_addition**: Adding or improving tests

## Complexity
- **simple**: Single file change, straightforward fix
- **moderate**: Multiple files, some logic changes
- **complex**: Architecture changes, multiple components

# Response Format

Respond with JSON:

{
  "shouldAct": true | false,
  "confidence": 0.0-1.0,
  "reason": "Clear explanation of decision",
  "workType": "bug_fix | feature_add | refactor | documentation | test_addition",
  "estimatedComplexity": "simple | moderate | complex",
  "requiredSkills": ["skill1", "skill2"],
  "blockers": ["blocker1", "blocker2"],
  "prerequisites": ["prerequisite1", "prerequisite2"]
}

# Examples

Example 1 - Actionable Bug:
{
  "shouldAct": true,
  "confidence": 0.9,
  "reason": "Clear bug with reproduction steps and expected behavior",
  "workType": "bug_fix",
  "estimatedComplexity": "simple",
  "requiredSkills": ["JavaScript", "React"],
  "blockers": [],
  "prerequisites": []
}

Example 2 - Not Actionable:
{
  "shouldAct": false,
  "confidence": 0.85,
  "reason": "Requires product decision on UX flow before implementation",
  "blockers": ["Product decision needed"],
  "prerequisites": ["UX mockups", "Product approval"]
}

Analyze the QA issue above and provide your classification.
`;
  }
}
