#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import PDFProcessor from './pdfProcessor.js';

// Use symlink from home directory for portability
const MAIN_REPO_PATH = path.join(os.homedir(), 'PersonalAgents');
dotenv.config({ path: path.join(MAIN_REPO_PATH, 'config', '.env') });

const program = new Command();

// Single file processing command
program
    .name('pdf-ai')
    .description('Convert PDF files to text using Gemini AI')
    .version('1.0.0')
    .argument('<input>', 'Input PDF file path')
    .argument('<output>', 'Output text file path')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--cache-db <path>', 'Custom cache database path', './tmp/pdf_cache.db')
    .action(async (inputPath, outputPath, options) => {
        await processSinglePDF(inputPath, outputPath, options);
    });

// Batch processing command
program
    .command('batch')
    .description('Process multiple PDF files at once')
    .argument('<input-dir>', 'Directory containing PDF files')
    .argument('<output-dir>', 'Directory for output text files')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--cache-db <path>', 'Custom cache database path', './tmp/pdf_cache.db')
    .option('--pattern <pattern>', 'File pattern to match (default: *.pdf)', '*.pdf')
    .action(async (inputDir, outputDir, options) => {
        await processBatchPDFs(inputDir, outputDir, options);
    });

async function processSinglePDF(inputPath, outputPath, options) {
    const spinner = ora('Initializing PDF AI processor...').start();
    
    try {
        // Validate input file
        if (!fs.existsSync(inputPath)) {
            spinner.fail(chalk.red(`Input file not found: ${inputPath}`));
            process.exit(1);
        }

        if (!inputPath.toLowerCase().endsWith('.pdf')) {
            spinner.fail(chalk.red('Input file must be a PDF'));
            process.exit(1);
        }

        // Check for Gemini API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            spinner.fail(chalk.red('GEMINI_API_KEY not found'));
            console.log(chalk.yellow(`Please ensure GEMINI_API_KEY is set in ${path.join(MAIN_REPO_PATH, 'config', '.env')}`));
            console.log(chalk.yellow('Ensure ~/PersonalAgents symlink points to your PersonalAgents repository'));
            process.exit(1);
        }

        // Ensure output directory exists
        const outputDirPath = path.dirname(outputPath);
        if (!fs.existsSync(outputDirPath)) {
            fs.mkdirSync(outputDirPath, { recursive: true });
        }

        // Initialize processor
        spinner.text = 'Setting up Gemini AI...';
        const processor = new PDFProcessor(apiKey, options.cacheDb);
        await processor.initialize();

        // Process PDF
        spinner.text = 'Extracting text from PDF...';
        const extractedText = await processor.extractTextFromPDF(inputPath);

        // Write output
        spinner.text = 'Writing text file...';
        fs.writeFileSync(outputPath, extractedText, 'utf8');

        spinner.succeed(chalk.green(`Successfully converted PDF to text:`));
        console.log(chalk.blue(`  Input:  ${inputPath}`));
        console.log(chalk.blue(`  Output: ${outputPath}`));
        console.log(chalk.gray(`  Text length: ${extractedText.length} characters`));

        if (options.verbose) {
            console.log(chalk.gray('\nFirst 200 characters of extracted text:'));
            console.log(chalk.gray(extractedText.substring(0, 200) + '...'));
        }

    } catch (error) {
        spinner.fail(chalk.red(`Error: ${error.message}`));
        
        if (options.verbose) {
            console.error(chalk.red('\nDetailed error:'));
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

async function processBatchPDFs(inputDir, outputDir, options) {
    const spinner = ora('Initializing batch PDF processing...').start();
    
    try {
        // Validate input directory
        if (!fs.existsSync(inputDir)) {
            spinner.fail(chalk.red(`Input directory not found: ${inputDir}`));
            process.exit(1);
        }

        if (!fs.statSync(inputDir).isDirectory()) {
            spinner.fail(chalk.red(`Input path is not a directory: ${inputDir}`));
            process.exit(1);
        }

        // Find all PDF files
        const pdfFiles = fs.readdirSync(inputDir)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .map(file => path.join(inputDir, file));

        if (pdfFiles.length === 0) {
            spinner.fail(chalk.red(`No PDF files found in directory: ${inputDir}`));
            process.exit(1);
        }

        // Check for Gemini API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            spinner.fail(chalk.red('GEMINI_API_KEY not found'));
            console.log(chalk.yellow(`Please ensure GEMINI_API_KEY is set in ${path.join(MAIN_REPO_PATH, 'config', '.env')}`));
            console.log(chalk.yellow('Ensure ~/PersonalAgents symlink points to your PersonalAgents repository'));
            process.exit(1);
        }

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Initialize processor
        spinner.text = 'Setting up Gemini AI...';
        const processor = new PDFProcessor(apiKey, options.cacheDb);
        await processor.initialize();

        spinner.succeed(chalk.green(`Found ${pdfFiles.length} PDF files to process`));

        let processed = 0;
        let errors = 0;

        // Process each PDF
        for (const pdfPath of pdfFiles) {
            const pdfName = path.basename(pdfPath, '.pdf');
            const outputPath = path.join(outputDir, `${pdfName}.txt`);
            const fileSpinner = ora(`Processing ${path.basename(pdfPath)}...`).start();

            try {
                const extractedText = await processor.extractTextFromPDF(pdfPath);
                fs.writeFileSync(outputPath, extractedText, 'utf8');
                
                fileSpinner.succeed(chalk.green(`✓ ${path.basename(pdfPath)} → ${path.basename(outputPath)} (${extractedText.length} chars)`));
                processed++;

                if (options.verbose) {
                    console.log(chalk.gray(`  First 100 chars: ${extractedText.substring(0, 100)}...`));
                }

            } catch (error) {
                fileSpinner.fail(chalk.red(`✗ ${path.basename(pdfPath)}: ${error.message}`));
                errors++;
                
                if (options.verbose) {
                    console.error(chalk.red(`  Detailed error: ${error.stack}`));
                }
            }
        }

        // Summary
        console.log(chalk.cyan('\n📊 Batch Processing Summary:'));
        console.log(chalk.green(`  ✓ Successfully processed: ${processed} files`));
        if (errors > 0) {
            console.log(chalk.red(`  ✗ Failed: ${errors} files`));
        }
        console.log(chalk.blue(`  📁 Output directory: ${outputDir}`));

    } catch (error) {
        spinner.fail(chalk.red(`Batch processing error: ${error.message}`));
        
        if (options.verbose) {
            console.error(chalk.red('\nDetailed error:'));
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Add help examples
program.addHelpText('after', `
Examples:
  Single file:
    $ pdf-ai document.pdf output.txt
    $ pdf-ai report.pdf extracted-text.txt --verbose

  Batch processing:
    $ pdf-ai batch ./pdf-folder/ ./text-output/
    $ pdf-ai batch ./documents/ ./extracted/ --verbose
    $ pdf-ai batch ./pdfs/ ./output/ --cache-db ./custom-cache.db

Environment Variables:
  GEMINI_API_KEY is automatically loaded from ../../config/.env
`);

program.parse(); 