#!/usr/bin/env node

/**
 * Perplexity CLI - Modern Node.js Implementation
 * Inspired by: https://github.com/PDraganov07/Perplexity-API---Complete-GUI-Suite
 */

import axios from 'axios';
import chalk from 'chalk';
import gradient from 'gradient-string';
import ora from 'ora';
import inquirer from 'inquirer';
import Conf from 'conf';
import boxen from 'boxen';
import { marked } from 'marked';
import markedTerminal from 'marked-terminal';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();

// Custom Terminal Renderer for Markdown
marked.setOptions({
    renderer: new markedTerminal({
        codespan: chalk.cyan,
        blockquote: chalk.gray.italic,
        heading: chalk.green.bold,
        listitem: chalk.yellow,
        firstHeading: chalk.magenta.bold,
        strong: chalk.bold,
        em: chalk.italic
    })
});

const config = new Conf({ projectName: 'perplexity-cli' });
const UI_COLOR = '#20B79F';
const UI_GRADIENT = gradient(['#20B79F', '#1A8870', '#30D158']);

const MODELS = [
    "sonar",
    "sonar-pro",
    "sonar-deep-research",
    "sonar-reasoning-pro"
];

const SEARCH_MODES = ["web", "academic", "sec"];

class PerplexityClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.perplexity.ai";
        this.history = [];
    }

    async chat(prompt, options = {}) {
        const {
            model = "sonar-pro",
            temperature = 0.7,
            searchMode = "web",
            useHistory = true
        } = options;

        const messages = [];
        if (useHistory) {
            messages.push(...this.history);
        }
        messages.push({ role: "user", content: prompt });

        try {
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model,
                    messages,
                    temperature,
                    search_mode: searchMode !== 'web' ? searchMode : undefined
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const aiMessage = response.data.choices[0].message;
            if (useHistory) {
                this.history.push({ role: "user", content: prompt });
                this.history.push(aiMessage);
            }

            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }

    clearHistory() {
        this.history = [];
    }
}

const showBanner = () => {
    const banner = `
  ⚡ PERPLEXITY CLI ⚡
  Modern Node.js Edition
  `;
    console.log(UI_GRADIENT(banner));
    console.log(chalk.gray('─'.repeat(50)));
};

const getApiKey = async () => {
    let apiKey = config.get('api_key') || process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
        const questions = [
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your Perplexity API Key:',
                mask: '*',
                validate: value => value.length > 0 || 'Please enter a valid API key'
            }
        ];

        const answers = await inquirer.prompt(questions);
        apiKey = answers.apiKey;
        config.set('api_key', apiKey);
        console.log(chalk.green('✔ API key saved securely!'));
    }

    return apiKey;
};

const main = async () => {
    showBanner();

    const apiKey = await getApiKey();
    const client = new PerplexityClient(apiKey);

    let currentModel = "sonar-pro";
    let currentSearchMode = "web";

    const chatLoop = async () => {
        const { prompt } = await inquirer.prompt([
            {
                type: 'input',
                name: 'prompt',
                message: chalk.hex(UI_COLOR)('You:'),
                prefix: ''
            }
        ]);

        if (!prompt.trim()) return chatLoop();

        const cmd = prompt.trim().toLowerCase();

        if (cmd === '/exit' || cmd === '/quit') {
            console.log(UI_GRADIENT('\nGoodbye! ⚡'));
            process.exit(0);
        }

        if (cmd === '/clear') {
            client.clearHistory();
            process.stdout.write('\x1Bc');
            showBanner();
            console.log(chalk.yellow('Conversation history cleared.\n'));
            return chatLoop();
        }

        if (cmd === '/gui') {
            console.log(boxen(
                chalk.bold('Perplexity GUI Suite\n\n') +
                chalk.cyan('Link: ') + chalk.underline('https://github.com/PDraganov07/Perplexity-API---Complete-GUI-Suite'),
                { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
            ));
            return chatLoop();
        }

        if (cmd === '/model') {
            const { model } = await inquirer.prompt([{
                type: 'list',
                name: 'model',
                message: 'Select Model:',
                choices: MODELS,
                default: currentModel
            }]);
            currentModel = model;
            console.log(chalk.green(`✔ Model set to: ${currentModel}\n`));
            return chatLoop();
        }

        if (cmd === '/mode') {
            const { mode } = await inquirer.prompt([{
                type: 'list',
                name: 'mode',
                message: 'Select Search Mode:',
                choices: SEARCH_MODES,
                default: currentSearchMode
            }]);
            currentSearchMode = mode;
            console.log(chalk.green(`✔ Search mode set to: ${currentSearchMode}\n`));
            return chatLoop();
        }

        if (cmd === '/help') {
            const helpText = [
                chalk.bold.cyan('Perplexity CLI Commands:'),
                '',
                `${chalk.yellow('/model')}   - Switch between models (pro, deep-research, etc.)`,
                `${chalk.yellow('/mode')}    - Change search scope (web, academic, sec)`,
                `${chalk.yellow('/clear')}   - Wipe chat history and clear terminal screen`,
                `${chalk.yellow('/gui')}     - Get the link to the official Perplexity GUI Suite`,
                `${chalk.yellow('/help')}    - Show this detailed documentation menu`,
                `${chalk.yellow('/exit')}    - Safely close the application`,
                '',
                chalk.gray('Tip: Conversation history is saved automatically during your session.'),
                chalk.gray('Use /clear if you want to start a completely fresh context.')
            ].join('\n');

            console.log('\n' + boxen(helpText, {
                padding: 1,
                borderColor: UI_COLOR,
                borderStyle: 'double',
                title: ' 📖 HELP MENU ',
                titleAlignment: 'center'
            }) + '\n');
            return chatLoop();
        }

        const loader = ora({
            text: chalk.gray('Searching...'),
            color: 'cyan',
            spinner: 'dots'
        }).start();

        try {
            const response = await client.chat(prompt, {
                model: currentModel,
                searchMode: currentSearchMode
            });

            loader.stop();

            const content = response.choices[0].message.content;

            console.log('\n' + boxen(marked(content), {
                title: 'Perplexity',
                titleAlignment: 'left',
                padding: 1,
                borderColor: UI_COLOR,
                borderStyle: 'round'
            }) + '\n');

        } catch (error) {
            loader.fail(chalk.red(`Error: ${error.message}`));
        }

        chatLoop();
    };

    await chatLoop();
};

main().catch(err => {
    console.error(chalk.red('Fatal Error:'), err);
});
