#!/usr/bin/env node

/**
 * SmartPhoto MCP 交互式测试客户端
 * 不依赖Claude Desktop，直接通过Node.js测试MCP功能
 */

import { spawn } from 'child_process';
import readline from 'readline';

class MCPTestClient {
  constructor() {
    this.requestId = 1;
    this.mcpProcess = null;
    this.initialized = false;
    this.tools = [];
    this.resources = [];
  }

  async start() {
    console.log('🚀 启动 SmartPhoto MCP 测试客户端...\n');

    // 启动MCP服务器进程
    this.mcpProcess = spawn('docker', ['exec', '-i', 'smartphoto-mcp', 'node', '/app/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let buffer = '';

    this.mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // 尝试解析JSON响应
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留最后一行（可能不完整）

      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            const response = JSON.parse(line);
            this.handleResponse(response);
          } catch (e) {
            // 忽略非JSON行（如启动消息）
          }
        }
      }
    });

    this.mcpProcess.stderr.on('data', (data) => {
      // 忽略stderr（通常是启动消息）
    });

    // 初始化MCP连接
    await this.initialize();

    // 获取工具和资源列表
    await this.listTools();
    await this.listResources();

    console.log('\n✅ MCP客户端初始化完成！\n');
    this.showHelp();
    this.startInteractive();
  }

  async initialize() {
    return new Promise((resolve) => {
      const initRequest = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      this.pendingResolve = resolve;
      this.sendRequest(initRequest);
      
      // 超时保护
      setTimeout(() => {
        if (!this.initialized) {
          this.initialized = true;
          resolve();
        }
      }, 2000);
    });
  }

  async listTools() {
    return new Promise((resolve) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/list'
      };

      this.pendingToolsResolve = resolve;
      this.sendRequest(request);
      setTimeout(resolve, 1000);
    });
  }

  async listResources() {
    return new Promise((resolve) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'resources/list'
      };

      this.pendingResourcesResolve = resolve;
      this.sendRequest(request);
      setTimeout(resolve, 1000);
    });
  }

  sendRequest(request) {
    this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  }

  handleResponse(response) {
    if (response.result) {
      if (response.result.tools) {
        this.tools = response.result.tools;
        this.initialized = true;
        if (this.pendingToolsResolve) {
          this.pendingToolsResolve();
          this.pendingToolsResolve = null;
        }
      } else if (response.result.resources) {
        this.resources = response.result.resources;
        if (this.pendingResourcesResolve) {
          this.pendingResourcesResolve();
          this.pendingResourcesResolve = null;
        }
      } else if (response.result.content) {
        // 工具调用结果
        console.log('\n📊 结果：');
        response.result.content.forEach(item => {
          if (item.type === 'text') {
            console.log(item.text);
          }
        });
        console.log('\n');
      } else if (response.result.contents) {
        // 资源读取结果
        console.log('\n📊 资源内容：');
        response.result.contents.forEach(item => {
          if (item.text) {
            try {
              const data = JSON.parse(item.text);
              console.log(JSON.stringify(data, null, 2));
            } catch {
              console.log(item.text);
            }
          }
        });
        console.log('\n');
      } else if (this.pendingResolve) {
        this.initialized = true;
        this.pendingResolve();
        this.pendingResolve = null;
      }
    } else if (response.error) {
      console.error('\n❌ 错误：', response.error.message);
      console.log('\n');
    }
  }

  showHelp() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📚 可用命令：');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n🔧 工具命令：');
    console.log('  1. search <关键词>              - 搜索照片');
    console.log('  2. details <photo_id>           - 查看照片详情');
    console.log('  3. tag <标签名>                 - 按标签筛选照片');
    console.log('  4. stats <用户名>               - 查看用户统计');
    console.log('\n📁 资源命令：');
    console.log('  5. recent                       - 查看最近照片');
    console.log('  6. all                          - 查看所有照片');
    console.log('\n💡 系统命令：');
    console.log('  help                            - 显示此帮助');
    console.log('  tools                           - 列出所有工具');
    console.log('  resources                       - 列出所有资源');
    console.log('  exit / quit                     - 退出程序');
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('💬 示例：');
    console.log('  > search 风景');
    console.log('  > stats 11111');
    console.log('  > recent');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  startInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 MCP> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      const parts = input.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      switch (command) {
        case 'exit':
        case 'quit':
          console.log('\n👋 再见！');
          this.mcpProcess.kill();
          process.exit(0);
          break;

        case 'help':
          this.showHelp();
          break;

        case 'tools':
          console.log('\n🔧 可用工具：');
          this.tools.forEach((tool, idx) => {
            console.log(`\n${idx + 1}. ${tool.name}`);
            console.log(`   ${tool.description}`);
          });
          console.log('\n');
          break;

        case 'resources':
          console.log('\n📁 可用资源：');
          this.resources.forEach((resource, idx) => {
            console.log(`\n${idx + 1}. ${resource.name}`);
            console.log(`   URI: ${resource.uri}`);
            console.log(`   ${resource.description}`);
          });
          console.log('\n');
          break;

        case 'search':
        case '1':
          if (!args) {
            console.log('❌ 请提供搜索关键词：search <关键词>\n');
          } else {
            await this.callTool('search_photos', { keyword: args });
          }
          break;

        case 'details':
        case '2':
          if (!args) {
            console.log('❌ 请提供照片ID：details <photo_id>\n');
          } else {
            await this.callTool('get_photo_details', { photo_id: args });
          }
          break;

        case 'tag':
        case '3':
          if (!args) {
            console.log('❌ 请提供标签名：tag <标签名>\n');
          } else {
            await this.callTool('list_photos_by_tag', { tag: args });
          }
          break;

        case 'stats':
        case '4':
          if (!args) {
            console.log('❌ 请提供用户名：stats <用户名>\n');
          } else {
            await this.callTool('get_user_stats', { username: args });
          }
          break;

        case 'recent':
        case '5':
          await this.readResource('smartphoto://photos/recent');
          break;

        case 'all':
        case '6':
          await this.readResource('smartphoto://photos/all');
          break;

        default:
          console.log(`❌ 未知命令：${command}`);
          console.log('💡 输入 "help" 查看可用命令\n');
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\n👋 再见！');
      this.mcpProcess.kill();
      process.exit(0);
    });
  }

  async callTool(toolName, args) {
    return new Promise((resolve) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      console.log(`\n⚙️  调用工具: ${toolName}(${JSON.stringify(args)})`);
      this.sendRequest(request);
      
      setTimeout(resolve, 1500);
    });
  }

  async readResource(uri) {
    return new Promise((resolve) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'resources/read',
        params: { uri }
      };

      console.log(`\n📖 读取资源: ${uri}`);
      this.sendRequest(request);
      
      setTimeout(resolve, 1500);
    });
  }
}

// 启动客户端
const client = new MCPTestClient();
client.start().catch(console.error);
