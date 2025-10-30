/**
 * GitHub API Client Wrapper
 */

import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';
import { PullRequest } from '../types/index.js';

/**
 * GitHub Client class
 */
export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(owner?: string, repo?: string) {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.owner = owner || process.env.GITHUB_OWNER!;
    this.repo = repo || process.env.GITHUB_REPO!;
  }

  /**
   * Get SHA of the main branch
   */
  public async getMainSha(branch: string = 'main'): Promise<string> {
    const { data } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`,
    });

    return data.object.sha;
  }

  /**
   * Create a new branch
   */
  public async createBranch(branchName: string, baseSha: string): Promise<void> {
    try {
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      logger.info('Branch created', { branchName });
    } catch (error: any) {
      if (error.status === 422) {
        // Branch already exists
        logger.warn('Branch already exists', { branchName });
        // Continue - we can still update it
      } else {
        throw error;
      }
    }
  }

  /**
   * Create or update file contents
   */
  public async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<void> {
    try {
      // Try to get existing file
      const { data: existingFile } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      // File exists, update it
      if ('sha' in existingFile) {
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          sha: existingFile.sha,
        });

        logger.debug('File updated', { path, branch });
      }
    } catch (error: any) {
      if (error.status === 404) {
        // File doesn't exist, create it
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
        });

        logger.debug('File created', { path, branch });
      } else {
        throw error;
      }
    }
  }

  /**
   * Delete a file
   */
  public async deleteFile(path: string, message: string, branch: string): Promise<void> {
    const { data: file } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: branch,
    });

    if ('sha' in file) {
      await this.octokit.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        branch,
        sha: file.sha,
      });

      logger.debug('File deleted', { path, branch });
    }
  }

  /**
   * Create a pull request
   */
  public async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<PullRequest> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head,
      base,
    });

    logger.info('Pull request created', {
      number: data.number,
      url: data.html_url,
    });

    return {
      url: data.html_url,
      number: data.number,
      branch: head,
      title: data.title,
      body: data.body || '',
      labels: [],
      createdAt: new Date(data.created_at),
      repository: {
        owner: this.owner,
        repo: this.repo,
      },
    };
  }

  /**
   * Add labels to PR
   */
  public async addLabels(prNumber: number, labels: string[]): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      labels,
    });

    logger.debug('Labels added to PR', { prNumber, labels });
  }

  /**
   * Request reviewers
   */
  public async requestReviewers(prNumber: number, reviewers: string[]): Promise<void> {
    await this.octokit.pulls.requestReviewers({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      reviewers,
    });

    logger.debug('Reviewers requested', { prNumber, reviewers });
  }

  /**
   * Check if branch exists
   */
  public async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchName}`,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
