/**
 * API Connection Validation Script
 * Tests all required API connections for Phase 0
 */

import dotenv from 'dotenv';
import { Anthropic } from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';

// Load environment variables
dotenv.config({ path: '.env.phase0' });

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test Anthropic API connection
 */
async function testAnthropicAPI(): Promise<TestResult> {
  console.log('\n🧪 Testing Anthropic API...');

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.includes('xxxxx')) {
    return {
      name: 'Anthropic API',
      success: false,
      message: 'API key not configured in .env.phase0',
    };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say "API connection successful" in exactly 3 words.' }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    return {
      name: 'Anthropic API',
      success: true,
      message: 'Connection successful',
      details: {
        model: response.model,
        response: text.substring(0, 50),
      },
    };
  } catch (error) {
    return {
      name: 'Anthropic API',
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Test GitHub API connection
 */
async function testGitHubAPI(): Promise<TestResult> {
  console.log('\n🧪 Testing GitHub API...');

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || token.includes('xxxxx')) {
    return {
      name: 'GitHub API',
      success: false,
      message: 'GitHub token not configured in .env.phase0',
    };
  }

  if (!owner || !repo) {
    return {
      name: 'GitHub API',
      success: false,
      message: 'GITHUB_OWNER or GITHUB_REPO not configured',
    };
  }

  try {
    const octokit = new Octokit({ auth: token });

    // Test 1: Get repository info
    const repoInfo = await octokit.repos.get({
      owner,
      repo,
    });

    // Test 2: Check if we can list branches
    const branches = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 5,
    });

    // Test 3: Check permissions
    const permissions = repoInfo.data.permissions;

    return {
      name: 'GitHub API',
      success: true,
      message: 'Connection successful',
      details: {
        repository: `${owner}/${repo}`,
        defaultBranch: repoInfo.data.default_branch,
        branches: branches.data.map((b) => b.name),
        permissions: {
          push: permissions?.push || false,
          pull: permissions?.pull || false,
        },
        private: repoInfo.data.private,
      },
    };
  } catch (error) {
    const err = error as any;
    return {
      name: 'GitHub API',
      success: false,
      message: err.message || 'Unknown error',
      details: {
        status: err.status,
        repository: `${owner}/${repo}`,
      },
    };
  }
}

/**
 * Test Notion MCP connection
 */
async function testNotionMCP(): Promise<TestResult> {
  console.log('\n🧪 Testing Notion MCP...');

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || token.includes('xxxxx')) {
    return {
      name: 'Notion MCP',
      success: false,
      message: 'Notion token not configured in .env.phase0',
    };
  }

  if (!databaseId || databaseId.includes('xxxxx')) {
    return {
      name: 'Notion MCP',
      success: false,
      message: 'NOTION_DATABASE_ID not configured in .env.phase0',
    };
  }

  try {
    // Import Notion MCP client
    const { NotionMCPClient } = await import('../dist/services/notion-mcp.js');

    const client = new NotionMCPClient(databaseId);

    // Test connection
    await client.connect();
    console.log('  ✓ Connected to Notion MCP');

    // Test database query
    const items = await client.queryDatabase();
    console.log(`  ✓ Found ${items.length} items in database`);

    await client.disconnect();

    return {
      name: 'Notion MCP',
      success: true,
      message: 'Connection successful',
      details: {
        databaseId: databaseId.substring(0, 8) + '...',
        itemCount: items.length,
      },
    };
  } catch (error) {
    return {
      name: 'Notion MCP',
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Run all connection tests
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          QA Automation - API Connection Tests             ║');
  console.log('║                    Phase 0 Validation                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check if .env.phase0 exists
  const fs = await import('fs');
  if (!fs.existsSync('.env.phase0')) {
    console.error('\n❌ Error: .env.phase0 file not found!');
    console.log('\nPlease copy .env.phase0 template and fill in your API keys:');
    console.log('  1. Copy: cp .env.phase0 .env');
    console.log('  2. Edit .env with your API keys');
    console.log('  3. Run this script again\n');
    process.exit(1);
  }

  // Run tests
  results.push(await testAnthropicAPI());
  results.push(await testGitHubAPI());
  results.push(await testNotionMCP());

  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let allPassed = true;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name.padEnd(20)} ${result.message}`);

    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');

    if (!result.success) {
      allPassed = false;
    }
  });

  console.log('─'.repeat(60));
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${results.filter((r) => r.success).length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);

  if (allPassed) {
    console.log('\n🎉 All tests passed! Ready for Phase 0 testing.\n');
    console.log('Next steps:');
    console.log('  1. Create a test QA item in Notion');
    console.log('  2. Run: npm start');
    console.log('  3. Watch the logs: tail -f logs/qa-automation.log\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.\n');
    console.log('Troubleshooting:');
    console.log('  - Verify API keys are correct');
    console.log('  - Check network connectivity');
    console.log('  - Ensure permissions are set correctly\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
