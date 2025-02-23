import {
    App,
    Editor,
    MarkdownView,
    Plugin,
    PluginSettingTab,
    Setting,
    Notice,
    TFile,
    WorkspaceLeaf,
    ButtonComponent
} from 'obsidian';

interface APIProvider {
    name: string;
    endpoint: string;
    models: string[];
    headers: (apiKey: string) => Record<string, string>;
    bodyTemplate: (messages: any, model: string) => Record<string, any>;
}

interface APIProviders {
    [key: string]: APIProvider;
}

const API_PROVIDERS: APIProviders = {
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-3.5-turbo', 'gpt-4'],
        headers: (apiKey: string) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        bodyTemplate: (messages: any, model: string) => ({
            model: model,
            messages: messages,
            temperature: 0.7
        })
    },
    dmx: {
        name: 'DMX API',
        endpoint: 'https://www.dmxapi.com/v1/chat/completions',
        models: [
            'gpt-4o-mini',
            'gpt-4o',
            'gpt-4o-2024-08-06',
            'claude-3-5-sonnet-20240620',
            'gemini-pro',
            'SparkDesk',
            'SparkDesk-v3.5',
            'abab6-chat',
            'abab5.5-chat',
            'Baichuan2-Turbo',
            'doubao-pro-32k',
            'ERNIE-4.0-8K',
            'glm-4',
            'hunyuan-all',
            'moonshot-v1-32k',
            'qwen2-72b-instruct',
            'qwen-turbo',
            'yi-34b-chat-0205',
            'step-2-16k-nightly',
            'deepseek-v3',
            '360GPT_S2_V9'
        ],
        headers: (apiKey: string) => ({
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'User-Agent': 'DMXAPI/1.0.0 (https://www.dmxapi.com)',
            'Content-Type': 'application/json'
        }),
        bodyTemplate: (messages: any, model: string) => ({
            model: model,
            messages: messages,
            temperature: 0.7,
            stream: false
        })
    },
    siliconflow: {
        name: '硅基流动',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        models: ['deepseek-ai/DeepSeek-V3'],
        headers: (apiKey: string) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        bodyTemplate: (messages: any, model: string) => ({
            model: model,
            messages: messages,
            stream: false,
            max_tokens: 512,
            stop: ["null"],
            temperature: 0.7,
            top_p: 0.7,
            top_k: 50,
            frequency_penalty: 0.5,
            n: 1,
            response_format: {
                type: "text"
            }
        })
    },
    custom: {
        name: '自定义',
        endpoint: '',
        models: ['custom'],
        headers: (apiKey: string) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        bodyTemplate: (messages: any, model: string) => ({
            model: model,
            messages: messages,
            temperature: 0.7
        })
    }
};

interface AIStudyPartnerSettings {
    apiKey: string;
    apiEndpoint: string;
    outputFolder: string;
    language: string;
    provider: keyof typeof API_PROVIDERS;
    model: string;
}

const DEFAULT_SETTINGS: AIStudyPartnerSettings = {
    apiKey: '',
    apiEndpoint: 'https://www.dmxapi.com/v1/chat/completions',
    outputFolder: 'AI_Outputs',
    language: 'zh',
    provider: 'dmx',
    model: 'gpt-4o-mini'
}

export default class AIStudyPartner extends Plugin {
    settings: AIStudyPartnerSettings = DEFAULT_SETTINGS;
    
    async onload() {
        await this.loadSettings();
        
        // 添加命令
        this.addCommand({
            id: 'ai-explain',
            name: 'AI解释',
            editorCallback: (editor: Editor) => this.handleAIRequest(editor, 'explain'),
            hotkeys: [],
            icon: 'bot'
        });

        this.addCommand({
            id: 'ai-metaphor',
            name: 'AI抽象和比喻',
            editorCallback: (editor: Editor) => this.handleAIRequest(editor, 'metaphor'),
            hotkeys: [],
            icon: 'brain'
        });

        // 注册右键菜单
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor: Editor) => {
                // 确保有选中的文本
                const selectedText = editor.getSelection();
                if (selectedText) {
                    menu.addSeparator(); // 添加分隔线
                    
                    menu.addItem((item) => {
                        item
                            .setTitle('AI解释')
                            .setIcon('bot')
                            .onClick(() => this.handleAIRequest(editor, 'explain'));
                    });

                    menu.addItem((item) => {
                        item
                            .setTitle('AI抽象和比喻')
                            .setIcon('brain')
                            .onClick(() => this.handleAIRequest(editor, 'metaphor'));
                    });
                }
            })
        );

        // 添加设置选项卡
        this.addSettingTab(new AIStudyPartnerSettingsTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async handleAIRequest(editor: Editor, type: 'explain' | 'metaphor') {
        const selectedText = editor.getSelection();
        if (!selectedText) {
            new Notice('请先选择要处理的文本');
            return;
        }

        try {
            new Notice('正在处理中...');
            const result = await this.callAIAPI(selectedText, type);
            await this.showResult(result, type, selectedText);
        } catch (error: any) {
            new Notice(`处理失败: ${error?.message || '未知错误'}`);
        }
    }

    async callAIAPI(text: string, type: 'explain' | 'metaphor' | 'keywords'): Promise<string> {
        if (!this.settings.apiKey) {
            throw new Error('请先在设置中配置API密钥');
        }

        let prompt = '';
        switch (type) {
            case 'explain':
                prompt = `请用中文详细解释以下内容：${text}`;
                break;
            case 'metaphor':
                prompt = `请用中文，用更形象的方式（如比喻）阐述以下内容的逻辑：${text}`;
                break;
            case 'keywords':
                prompt = `请从以下文本中提取2-3个关键词，用逗号分隔：${text}`;
                break;
        }

        const provider = API_PROVIDERS[this.settings.provider];
        const messages = [{
            role: "user",
            content: prompt
        }];

        try {
            const response = await fetch(this.settings.apiEndpoint, {
                method: 'POST',
                headers: provider.headers(this.settings.apiKey),
                body: JSON.stringify(provider.bodyTemplate(messages, this.settings.model))
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || response.statusText);
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('API返回数据格式错误');
            }

            return content;
        } catch (error: any) {
            console.error('API调用失败:', error);
            throw new Error(error.message || '未知错误');
        }
    }

    async showResult(result: string, type: string, originalText: string) {
        const currentFile = this.app.workspace.getActiveFile();
        if (!currentFile) {
            throw new Error('无法获取当前文件');
        }

        // 获取当前文件所在目录路径
        const currentFilePath = currentFile.path;
        const currentFileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
        
        // 在当前文件目录下创建 AI_Outputs 文件夹
        const outputFolderPath = `${currentFileDir}/${this.settings.outputFolder}`;
        
        try {
            // 检查并创建输出目录
            if (!await this.app.vault.adapter.exists(outputFolderPath)) {
                await this.app.vault.createFolder(outputFolderPath);
            }

            // 使用选中的文本作为文件名（处理特殊字符）
            const safeFileName = originalText
                .slice(0, 50) // 限制长度
                .replace(/[\\/:*?"<>|]/g, '_') // 替换非法字符
                .trim();
            
            const fileName = `${safeFileName}.md`;
            const filePath = `${outputFolderPath}/${fileName}`;

            const keywords = await this.extractKeywords(originalText);
            
            // 在文件内容中添加元信息
            const fileContent = [
                `# ${safeFileName}`,
                '',
                '## 元信息',
                `- 原文: [[${currentFile.basename}]]`,
                `- 类型: AI ${type === 'explain' ? '解释' : '比喻'}`,
                `- 创建时间: ${new Date().toLocaleString('zh-CN')}`,
                `- 标签: ${keywords.map(k => `#${k}`).join(' ')}`,
                '',
                '## AI生成内容',
                result
            ].join('\n');

            // 检查文件是否已存在，如果存在则追加内容
            let newFile: TFile;
            if (await this.app.vault.adapter.exists(filePath)) {
                const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                if (existingFile instanceof TFile) {
                    const existingContent = await this.app.vault.read(existingFile);
                    const updatedContent = existingContent + '\n\n---\n\n' + fileContent;
                    await this.app.vault.modify(existingFile, updatedContent);
                    newFile = existingFile;
                } else {
                    throw new Error('现有文件类型错误');
                }
            } else {
                newFile = await this.app.vault.create(filePath, fileContent);
            }

            // 在原文中添加简单的链接
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                const editor = view.editor;
                const cursor = editor.getCursor();
                const selection = editor.getSelection();

                // 使用相对路径创建链接
                const relativeFilePath = filePath.substring(currentFileDir.length + 1);
                
                // 直接将选中文本转换为链接，保持原文结构
                editor.replaceSelection(`[[${relativeFilePath}|${selection}]]`);
            }

            // 打开新文件
            const leaf = this.app.workspace.splitActiveLeaf('vertical');
            await leaf.openFile(newFile);
        } catch (error: any) {
            console.error('创建文件失败:', error);
            throw new Error(`创建文件失败: ${error?.message || '未知错误'}`);
        }
    }

    async extractKeywords(text: string): Promise<string[]> {
        try {
            const response = await this.callAIAPI(text, 'keywords');
            const keywords = response.split(',').map(k => k.trim()).slice(0, 3);
            return keywords;
        } catch (error) {
            console.error('提取关键词失败:', error);
            return ['未分类'];
        }
    }
}

class AIStudyPartnerSettingsTab extends PluginSettingTab {
    plugin: AIStudyPartner;
    testResult: { success: boolean; message: string } | null = null;

    constructor(app: App, plugin: AIStudyPartner) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // API提供商选择
        new Setting(containerEl)
            .setName('API提供商')
            .setDesc('选择AI服务提供商')
            .addDropdown(dropdown => {
                Object.keys(API_PROVIDERS).forEach(key => {
                    dropdown.addOption(key, API_PROVIDERS[key as keyof typeof API_PROVIDERS].name);
                });
                dropdown.setValue(this.plugin.settings.provider.toString())
                    .onChange(async (value: keyof typeof API_PROVIDERS) => {
                        this.plugin.settings.provider = value;
                        this.plugin.settings.apiEndpoint = API_PROVIDERS[value].endpoint;
                        this.plugin.settings.model = API_PROVIDERS[value].models[0];
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        // 模型选择
        new Setting(containerEl)
            .setName('模型')
            .setDesc('选择要使用的模型')
            .addDropdown(dropdown => {
                const provider = this.plugin.settings.provider;
                API_PROVIDERS[provider].models.forEach(model => {
                    dropdown.addOption(model, model);
                });
                dropdown.setValue(this.plugin.settings.model.toString())
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    });
            });

        // API密钥设置
        new Setting(containerEl)
            .setName('API密钥')
            .setDesc('输入你的API密钥')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        // API地址设置
        new Setting(containerEl)
            .setName('API地址')
            .setDesc('输入API服务地址')
            .addText(text => text
                .setPlaceholder('https://api.openai.com/v1/chat/completions')
                .setValue(this.plugin.settings.apiEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.apiEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        // API连接测试和保存区域
        const testContainer = containerEl.createDiv('test-container');
        testContainer.addClass('setting-item');
        
        const testInfo = testContainer.createDiv('setting-item-info');
        testInfo.createDiv('setting-item-name').setText('API连接测试');
        testInfo.createDiv('setting-item-description').setText('测试API配置是否正确');

        const testControl = testContainer.createDiv({
            cls: ['setting-item-control', 'flex', 'space-x-2']
        });

        // 测试按钮
        const testButton = new ButtonComponent(testControl)
            .setButtonText('测试连接')
            .onClick(async () => {
                testButton.setDisabled(true);
                testButton.setButtonText('测试中...');
                try {
                    await this.testAPIConnection();
                    this.testResult = { success: true, message: 'API连接测试成功！' };
                    saveButton.setDisabled(false);
                    new Notice('API连接测试成功！');
                } catch (error: any) {
                    this.testResult = { success: false, message: `API连接测试失败: ${error.message}` };
                    saveButton.setDisabled(true);
                    new Notice(`API连接测试失败: ${error.message}`);
                } finally {
                    testButton.setButtonText('测试连接');
                    testButton.setDisabled(false);
                    this.updateTestResult();
                }
            });

        // 保存按钮
        const saveButton = new ButtonComponent(testControl)
            .setButtonText('保存配置')
            .setDisabled(!this.testResult?.success)
            .onClick(async () => {
                await this.plugin.saveSettings();
                new Notice('配置已保存！');
            });
        
        // 添加测试结果显示区域
        const resultContainer = containerEl.createDiv('test-result');
        if (this.testResult) {
            resultContainer.addClass(this.testResult.success ? 'success' : 'error');
            resultContainer.setText(this.testResult.message);
        }

        // 输出目录设置
        new Setting(containerEl)
            .setName('输出目录')
            .setDesc('AI生成内容的保存目录')
            .addText(text => text
                .setPlaceholder('AI_Outputs')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }));
    }

    private updateTestResult() {
        const resultContainer = this.containerEl.querySelector('.test-result');
        if (resultContainer && this.testResult) {
            resultContainer.className = 'test-result ' + (this.testResult.success ? 'success' : 'error');
            resultContainer.setText(this.testResult.message);
        }
    }

    async testAPIConnection(): Promise<boolean> {
        if (!this.plugin.settings.apiKey || !this.plugin.settings.apiEndpoint) {
            throw new Error('请先填写API密钥和地址');
        }

        const provider = API_PROVIDERS[this.plugin.settings.provider];
        const messages = [{
            role: "user",
            content: "测试连接，请回复：连接成功"
        }];

        try {
            const response = await fetch(this.plugin.settings.apiEndpoint, {
                method: 'POST',
                headers: provider.headers(this.plugin.settings.apiKey),
                body: JSON.stringify(provider.bodyTemplate(messages, this.plugin.settings.model))
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || response.statusText);
            }

            const content = data.choices?.[0]?.message?.content;
            
            if (!content) {
                throw new Error('API返回数据格式错误');
            }

            return true;
        } catch (error: any) {
            console.error('API测试失败:', error);
            throw new Error(error.message || '未知错误');
        }
    }
} 