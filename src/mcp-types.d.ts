declare module "@modelcontextprotocol/sdk" {
  export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
    handler: (params: any) => Promise<any>;
  }

  export function createServer(tools: ToolDefinition[]): {
    listen: () => Promise<{ port: number }>;
  };
}
