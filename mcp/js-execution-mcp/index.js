import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import crypto from "crypto";
import getPort from "get-port";

const port = await getPort({ port: 9235 });
let activeSocket;

const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
  console.log("Companion extension connected.");
  activeSocket = ws;

  const keepAlive = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(keepAlive);
    }
  }, 10000);

  ws.on("close", () => {
    console.log("Companion extension disconnected.");
    activeSocket = null;
    clearInterval(keepAlive);
  });
});

const readDomTool = {
  schema: {
    name: "read_dom",
    description: "Reads the entire DOM of the page.",
    inputSchema: zodToJsonSchema(z.object({})),
  },
  handle: async () => {
    if (!activeSocket) {
      return {
        content: [{ type: "text", text: "No connection to companion extension." }],
        isError: true,
      };
    }
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const message = {
        id,
        type: "read_dom",
      };
      activeSocket.send(JSON.stringify(message));
      activeSocket.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          if (response.ok) {
            resolve({
              content: [{ type: "text", text: response.result.html }],
            });
          } else {
            resolve({
              content: [{ type: "text", text: `Error reading DOM: ${response.error}` }],
              isError: true,
            });
          }
        }
      });
    });
  },
};

const executeJqueryTool = {
  schema: {
    name: "execute_jquery",
    description: "Executes a jQuery script on the page.",
    inputSchema: zodToJsonSchema(
      z.object({
        script: z.string(),
      })
    ),
  },
  handle: async (params) => {
    if (!activeSocket) {
      return {
        content: [{ type: "text", text: "No connection to companion extension." }],
        isError: true,
      };
    }
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const message = {
        id,
        type: "execute_jquery",
        script: params.script,
      };
      activeSocket.send(JSON.stringify(message));
      activeSocket.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          if (response.ok) {
            resolve({
              content: [{ type: "text", text: `Script result: ${JSON.stringify(response.result, null, 2)}` }],
            });
          } else {
            resolve({
              content: [{ type: "text", text: `Script error: ${response.error}` }],
              isError: true,
            });
          }
        }
      });
    });
  },
};

const server = new Server(
  { name: "js-execution-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [readDomTool.schema, executeJqueryTool.schema] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_dom") {
    return readDomTool.handle();
  } else if (request.params.name === "execute_jquery") {
    return executeJqueryTool.handle(request.params.arguments);
  }
  return {
    content: [{ type: "text", text: `Tool "${request.params.name}" not found` }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
server.connect(transport);

console.log(`JS Execution MCP Server running on port ${port}`);
