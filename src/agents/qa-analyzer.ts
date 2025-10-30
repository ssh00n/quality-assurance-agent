/**
 * QA Analyzer Agent
 * Analyzes QA items (text + images) and generates structured analysis
 */

import { BaseAgent } from './base.js';
import { OCRService } from '../services/ocr-service.js';
import { logger } from '../utils/logger.js';
import {
  AgentConfig,
  AgentContext,
  QAAnalysis,
  IssueType,
  Severity,
  VisualEvidence,
  WorkflowPhase,
} from '../types/index.js';

/**
 * QA Analyzer Agent input
 */
export interface QAAnalyzerInput {
  // Input is derived from context.qaItem
}

/**
 * QA Analyzer Agent
 */
export class QAAnalyzerAgent extends BaseAgent<QAAnalyzerInput, QAAnalysis> {
  private ocrService: OCRService;

  constructor(config: AgentConfig, context: AgentContext) {
    super(
      {
        ...config,
        agentType: 'qa-analyzer',
        timeout: config.timeout || 300000, // 5 minutes
      },
      context
    );

    this.ocrService = new OCRService();
  }

  /**
   * Run QA analysis
   */
  protected async run(_input?: QAAnalyzerInput): Promise<QAAnalysis> {
    const { qaItem } = this.context;

    logger.agent('qa-analyzer', 'Starting QA analysis', {
      qaId: qaItem.id,
      qaTitle: qaItem.title,
      hasImages: !!qaItem.images && qaItem.images.length > 0,
    });

    this.updateProgress('Analyzing QA text...', WorkflowPhase.ANALYSIS, 10);

    // Step 1: Analyze text
    const textAnalysis = await this.analyzeText(qaItem.title, qaItem.description);

    this.updateProgress('Processing images (if any)...', WorkflowPhase.ANALYSIS, 40);

    // Step 2: Analyze images (if any)
    const visualEvidence = qaItem.images && qaItem.images.length > 0
      ? await this.analyzeImages(qaItem.images)
      : [];

    this.updateProgress('Synthesizing analysis...', WorkflowPhase.ANALYSIS, 80);

    // Step 3: Synthesize final analysis
    const analysis = await this.synthesizeAnalysis(textAnalysis, visualEvidence);

    this.updateProgress('QA analysis completed', WorkflowPhase.ANALYSIS, 100);

    logger.agent('qa-analyzer', 'QA analysis completed', {
      issueType: analysis.issueType,
      severity: analysis.severity,
      confidence: analysis.confidence,
    });

    return analysis;
  }

  /**
   * Analyze text content
   */
  private async analyzeText(title: string, description: string): Promise<Partial<QAAnalysis>> {
    const prompt = this.buildTextAnalysisPrompt(title, description);

    const systemPrompt = `You are a QA analysis expert. Analyze bug reports and feature requests.
Extract structured information from the QA report provided.
Respond ONLY with valid JSON matching the specified schema.`;

    const response = await this.callClaude(prompt, systemPrompt, {
      temperature: 0.3, // Lower temperature for more consistent structured output
    });

    return this.parseJSON<Partial<QAAnalysis>>(response);
  }

  /**
   * Build text analysis prompt
   */
  private buildTextAnalysisPrompt(title: string, description: string): string {
    return `
Analyze the following QA report and extract structured information.

# QA Report

**Title:** ${title}

**Description:**
${description}

# Your Task

Extract and provide the following information in JSON format:

{
  "summary": "Brief summary of the issue (1-2 sentences)",
  "issueType": "bug | feature | improvement | question | documentation",
  "severity": "critical | high | medium | low",
  "stepsToReproduce": ["step 1", "step 2", "..."],
  "expectedBehavior": "What should happen",
  "actualBehavior": "What actually happens",
  "affectedComponents": ["component1", "component2", "..."],
  "suspectedRootCause": "Potential root cause if identifiable",
  "relatedIssues": ["issue references if mentioned"]
}

# Guidelines

- **issueType**: Classify as bug, feature request, improvement, question, or documentation
- **severity**:
  - critical: System down, data loss, security issue
  - high: Major functionality broken
  - medium: Feature partially working
  - low: Minor issue, cosmetic
- **stepsToReproduce**: Extract clear reproduction steps (empty array if not provided)
- **expectedBehavior**: What the user expected to happen
- **actualBehavior**: What actually happened
- **affectedComponents**: Which parts of the system are affected
- **suspectedRootCause**: Your analysis of potential root cause (null if unclear)

Respond with ONLY the JSON object, no additional text.
`;
  }

  /**
   * Analyze images using Vision API and OCR
   */
  private async analyzeImages(images: string[]): Promise<VisualEvidence[]> {
    logger.debug('Analyzing images', { count: images.length });

    const evidencePromises = images.map(async (imageBase64, index) => {
      try {
        // Step 1: OCR text extraction
        const ocrText = await this.ocrService.extractText(imageBase64);

        // Step 2: Vision API analysis
        const visionAnalysis = await this.analyzeImageWithVision(imageBase64, ocrText);

        return {
          description: visionAnalysis.description,
          extractedText: ocrText || undefined,
          relevantDetails: visionAnalysis.relevantDetails,
        };
      } catch (error) {
        logger.warn(`Failed to analyze image ${index}`, {
          error: (error as Error).message,
        });

        return {
          description: 'Failed to analyze image',
          relevantDetails: [],
        };
      }
    });

    return Promise.all(evidencePromises);
  }

  /**
   * Analyze image with Vision API
   */
  private async analyzeImageWithVision(
    imageBase64: string,
    ocrText: string
  ): Promise<{ description: string; relevantDetails: string[] }> {
    const prompt = `
Analyze this screenshot from a bug report or feature request.

${ocrText ? `OCR extracted text:\n${ocrText}\n\n` : ''}

Provide:
1. A brief description of what you see (UI elements, error messages, etc.)
2. List of relevant technical details (error codes, stack traces, UI state, etc.)

Respond in JSON format:
{
  "description": "What you see in the image",
  "relevantDetails": ["detail 1", "detail 2", "..."]
}
`;

    const response = await this.callClaudeVision(prompt, imageBase64);

    return this.parseJSON<{ description: string; relevantDetails: string[] }>(response);
  }

  /**
   * Synthesize final analysis from text and image analysis
   */
  private async synthesizeAnalysis(
    textAnalysis: Partial<QAAnalysis>,
    visualEvidence: VisualEvidence[]
  ): Promise<QAAnalysis> {
    // Combine text analysis with visual evidence
    const combinedPrompt = `
Synthesize a final QA analysis combining text analysis and visual evidence.

# Text Analysis
${JSON.stringify(textAnalysis, null, 2)}

# Visual Evidence
${JSON.stringify(visualEvidence, null, 2)}

# Task
Provide a final, comprehensive analysis with confidence score (0-1).
Consider:
- Are there any contradictions?
- Does visual evidence confirm the text analysis?
- Is there enough information for action?

Respond in JSON format with ALL fields from the text analysis plus:
{
  ...textAnalysis,
  "visualEvidence": visualEvidence,
  "analyzedAt": "${new Date().toISOString()}",
  "confidence": 0.0-1.0  // How confident are you in this analysis?
}
`;

    const systemPrompt = `You are synthesizing a final QA analysis. Be thorough and honest about confidence.`;

    const response = await this.callClaude(combinedPrompt, systemPrompt, {
      temperature: 0.2,
    });

    const synthesized = this.parseJSON<any>(response);

    // Ensure all required fields are present
    return {
      summary: synthesized.summary || 'No summary available',
      issueType: (synthesized.issueType as IssueType) || IssueType.QUESTION,
      severity: (synthesized.severity as Severity) || Severity.MEDIUM,
      stepsToReproduce: synthesized.stepsToReproduce || [],
      expectedBehavior: synthesized.expectedBehavior || 'Not specified',
      actualBehavior: synthesized.actualBehavior || 'Not specified',
      visualEvidence: visualEvidence,
      affectedComponents: synthesized.affectedComponents || [],
      suspectedRootCause: synthesized.suspectedRootCause,
      relatedIssues: synthesized.relatedIssues,
      analyzedAt: new Date(synthesized.analyzedAt),
      confidence: synthesized.confidence || 0.5,
    };
  }
}
