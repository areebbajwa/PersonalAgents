#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

async function migrateAll() {
  console.log(chalk.cyan('🔄 Migrating all legacy workflow states...\n'));

  const legacyDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow-cli', 'state');
  
  try {
    const files = await fs.readdir(legacyDir);
    const stateFiles = files.filter(f => f.startsWith('workflow_state_') && f.endsWith('.json'));
    
    if (stateFiles.length === 0) {
      console.log(chalk.yellow('No legacy state files found'));
      return;
    }

    console.log(chalk.gray(`Found ${stateFiles.length} legacy state files\n`));

    for (const file of stateFiles) {
      const project = file.replace('workflow_state_', '').replace('.json', '');
      console.log(`Migrating: ${chalk.bold(project)}`);
      
      // Simply load the state using StateManager - it will auto-migrate
      const { execSync } = await import('child_process');
      try {
        execSync(`cd ~/PersonalAgents/cli_tools/workflow && node -e "
          import StateManager from './src/state-manager.js';
          const sm = new StateManager();
          sm.loadState('${project}').then(state => {
            if (state) console.log('✓ Migrated successfully');
          });
        "`, { stdio: 'inherit' });
      } catch (error) {
        console.error(chalk.red(`Failed to migrate ${project}:`, error.message));
      }
    }

    console.log(chalk.green('\n✓ Migration complete!'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(chalk.yellow('No legacy workflow-cli directory found'));
    } else {
      console.error(chalk.red('Migration error:'), error.message);
    }
  }
}

migrateAll().catch(console.error);