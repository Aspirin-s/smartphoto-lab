import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from 'mysql2/promise';

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'smartphoto-db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: 'photo_lab',
  waitForConnections: true,
  connectionLimit: 10
});

// JSON解析辅助函数
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// 创建MCP服务器
const server = new Server(
  {
    name: "smartphoto-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ==================== Resources ====================
// 资源：用户的照片列表
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "smartphoto://photos/all",
        name: "所有照片",
        description: "获取系统中所有用户的照片列表",
        mimeType: "application/json",
      },
      {
        uri: "smartphoto://photos/recent",
        name: "最近上传的照片",
        description: "获取最近上传的20张照片",
        mimeType: "application/json",
      }
    ],
  };
});

// 读取资源内容
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "smartphoto://photos/all") {
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.description, p.url, p.tags, p.exif, 
                p.timestamp, p.width, p.height, u.username 
         FROM photos p 
         JOIN users u ON p.user_id = u.id 
         ORDER BY p.timestamp DESC`
      );
      
      const photos = rows.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        tags: safeParse(p.tags) || [],
        exif: safeParse(p.exif) || {},
        timestamp: p.timestamp,
        dimensions: `${p.width}x${p.height}`,
        username: p.username
      }));

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(photos, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `错误: ${error.message}`,
          },
        ],
      };
    }
  }

  if (uri === "smartphoto://photos/recent") {
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.description, p.url, p.tags, p.exif, 
                p.timestamp, u.username 
         FROM photos p 
         JOIN users u ON p.user_id = u.id 
         ORDER BY p.timestamp DESC 
         LIMIT 20`
      );
      
      const photos = rows.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        tags: safeParse(p.tags) || [],
        exif: safeParse(p.exif) || {},
        timestamp: new Date(Number(p.timestamp)).toLocaleString('zh-CN'),
        username: p.username
      }));

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(photos, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `错误: ${error.message}`,
          },
        ],
      };
    }
  }

  throw new Error(`未知资源: ${uri}`);
});

// ==================== Tools ====================
// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_photos",
        description: "根据关键词搜索照片。支持搜索标签、描述、照片名称、EXIF信息等",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "搜索关键词，例如：风景、海边、美食、iPhone 15等",
            },
            username: {
              type: "string",
              description: "可选：指定用户名，只搜索该用户的照片",
            }
          },
          required: ["keyword"],
        },
      },
      {
        name: "get_photo_details",
        description: "获取指定照片的详细信息，包括EXIF数据、标签、拍摄参数等",
        inputSchema: {
          type: "object",
          properties: {
            photo_id: {
              type: "string",
              description: "照片的唯一ID",
            },
          },
          required: ["photo_id"],
        },
      },
      {
        name: "list_photos_by_tag",
        description: "列出包含指定标签的所有照片",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "标签名称，例如：风景、人物、动物等",
            },
          },
          required: ["tag"],
        },
      },
      {
        name: "get_user_stats",
        description: "获取指定用户的照片统计信息",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "用户名",
            },
          },
          required: ["username"],
        },
      },
    ],
  };
});

// 执行工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // 工具1：搜索照片
    if (name === "search_photos") {
      const { keyword, username } = args;
      
      let query = `
        SELECT p.id, p.name, p.description, p.url, p.tags, p.exif, 
               p.timestamp, p.width, p.height, u.username 
        FROM photos p 
        JOIN users u ON p.user_id = u.id 
        WHERE (
          p.name LIKE ? OR 
          p.description LIKE ? OR 
          JSON_SEARCH(p.tags, 'one', ?) IS NOT NULL OR
          JSON_EXTRACT(p.exif, '$.camera') LIKE ? OR
          JSON_EXTRACT(p.exif, '$.location') LIKE ?
        )
      `;
      
      const searchPattern = `%${keyword}%`;
      const params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
      
      if (username) {
        query += ` AND u.username = ?`;
        params.push(username);
      }
      
      query += ` ORDER BY p.timestamp DESC LIMIT 50`;
      
      const [rows] = await pool.query(query, params);
      
      const results = rows.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        tags: safeParse(p.tags) || [],
        exif: safeParse(p.exif) || {},
        dimensions: `${p.width}x${p.height}`,
        uploadTime: new Date(Number(p.timestamp)).toLocaleString('zh-CN'),
        username: p.username
      }));

      return {
        content: [
          {
            type: "text",
            text: `找到 ${results.length} 张匹配"${keyword}"的照片：\n\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }

    // 工具2：获取照片详情
    if (name === "get_photo_details") {
      const { photo_id } = args;
      
      const [rows] = await pool.query(
        `SELECT p.*, u.username, u.email 
         FROM photos p 
         JOIN users u ON p.user_id = u.id 
         WHERE p.id = ?`,
        [photo_id]
      );
      
      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `未找到ID为"${photo_id}"的照片`,
            },
          ],
        };
      }
      
      const photo = rows[0];
      const details = {
        id: photo.id,
        name: photo.name,
        description: photo.description,
        url: photo.url,
        dimensions: `${photo.width}x${photo.height}`,
        fileSize: `${(photo.size / 1024 / 1024).toFixed(2)} MB`,
        uploadTime: new Date(Number(photo.timestamp)).toLocaleString('zh-CN'),
        tags: safeParse(photo.tags) || [],
        exif: safeParse(photo.exif) || {},
        owner: {
          username: photo.username,
          email: photo.email
        }
      };

      return {
        content: [
          {
            type: "text",
            text: `照片详细信息：\n\n${JSON.stringify(details, null, 2)}`,
          },
        ],
      };
    }

    // 工具3：按标签列出照片
    if (name === "list_photos_by_tag") {
      const { tag } = args;
      
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.description, p.url, p.tags, 
                p.timestamp, u.username 
         FROM photos p 
         JOIN users u ON p.user_id = u.id 
         WHERE JSON_SEARCH(p.tags, 'one', ?) IS NOT NULL 
         ORDER BY p.timestamp DESC`,
        [tag]
      );
      
      const results = rows.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        tags: safeParse(p.tags) || [],
        uploadTime: new Date(Number(p.timestamp)).toLocaleString('zh-CN'),
        username: p.username
      }));

      return {
        content: [
          {
            type: "text",
            text: `标签"${tag}"的照片共 ${results.length} 张：\n\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }

    // 工具4：获取用户统计
    if (name === "get_user_stats") {
      const { username } = args;
      
      const [userRows] = await pool.query(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      
      if (userRows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `用户"${username}"不存在`,
            },
          ],
        };
      }
      
      const userId = userRows[0].id;
      
      // 照片总数
      const [countRows] = await pool.query(
        'SELECT COUNT(*) as total FROM photos WHERE user_id = ?',
        [userId]
      );
      
      // 总存储大小
      const [sizeRows] = await pool.query(
        'SELECT SUM(size) as totalSize FROM photos WHERE user_id = ?',
        [userId]
      );
      
      // 所有标签
      const [tagRows] = await pool.query(
        'SELECT tags FROM photos WHERE user_id = ?',
        [userId]
      );
      
      const allTags = new Set();
      tagRows.forEach(row => {
        const tags = safeParse(row.tags) || [];
        tags.forEach(tag => allTags.add(tag));
      });
      
      // 最近上传
      const [recentRows] = await pool.query(
        'SELECT name, timestamp FROM photos WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5',
        [userId]
      );

      const stats = {
        username,
        totalPhotos: countRows[0].total,
        totalStorage: `${(sizeRows[0].totalSize / 1024 / 1024).toFixed(2)} MB`,
        uniqueTags: Array.from(allTags),
        tagCount: allTags.size,
        recentUploads: recentRows.map(r => ({
          name: r.name,
          time: new Date(Number(r.timestamp)).toLocaleString('zh-CN')
        }))
      };

      return {
        content: [
          {
            type: "text",
            text: `用户"${username}"的统计信息：\n\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
      };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `执行工具"${name}"时出错: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SmartPhoto MCP Server 已启动");
}

main().catch((error) => {
  console.error("服务器启动失败:", error);
  process.exit(1);
});
