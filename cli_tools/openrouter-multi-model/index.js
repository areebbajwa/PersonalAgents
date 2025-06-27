#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import os from 'os';
import { OpenRouterClient } from './openrouter-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use symlink from home directory for portability
const MAIN_REPO_PATH = path.join(os.homedir(), 'PersonalAgents');
dotenv.config({ path: path.join(MAIN_REPO_PATH, 'config', '.env') });

const program = new Command();

// Define the models to query
const MODELS = [
  'anthropic/claude-opus-4',
  'google/gemini-2.5-pro-preview',
  'openai/o3'
];

program
  .name('openrouter-multi-model')
  .description('Query multiple AI models through OpenRouter API')
  .version('1.0.0')
  .argument('<prompt>', 'The prompt to send to all models')
  .option('-o, --output <path>', 'Output directory for JSON results', './results')
  .option('-c, --no-cache', 'Disable caching')
  .option('-v, --verbose', 'Verbose output')
  .action(async (prompt, options) => {
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        console.error('Error: OPENROUTER_API_KEY not found in environment variables');
        console.error(`Please add OPENROUTER_API_KEY to ${path.join(MAIN_REPO_PATH, 'config', '.env')}`);
        console.error('Ensure ~/PersonalAgents symlink points to your PersonalAgents repository');
        process.exit(1);
      }

      const client = new OpenRouterClient(process.env.OPENROUTER_API_KEY);
      
      console.log(`\nQuerying ${MODELS.length} models with prompt: "${prompt}"\n`);
      
      // Query single model for now (will extend to multiple later)
      const testModel = MODELS[0];
      console.log(`Testing with model: ${testModel}`);
      
      const result = await client.queryModel(testModel, prompt);
      
      if (result.error) {
        console.error(`Error from ${result.model}:`, result.error);
      } else {
        console.log(`Response from ${result.model}:`);
        console.log('-'.repeat(60));
        console.log(result.response);
        console.log('-'.repeat(60));
        
        if (options.verbose) {
          console.log('\nUsage:', result.usage);
          console.log('Model used:', result.modelUsed);
        }
      }
      
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();