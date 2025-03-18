// npm install @langchain/core @langchain/community @aws-sdk/client-bedrock-runtime dotenv


// AWS_ACCESS_KEY_ID=your_access_key
// AWS_SECRET_ACCESS_KEY=your_secret_key
// AWS_REGION=us-east-1 # 根据你的 Bedrock 配置修改
// cp .env.example .env # 填写你的实际凭证
// npx ts-node chatbot.ts
// Bot: 你好！我是 Claude3 助手，有什么可以帮你的？

// User: LangChain 是什么？
// Bot: LangChain 是一个用于构建大语言模型应用的开发框架，提供模块化组件（如模型集成、记忆管理、工具调用等），帮助开发者快速构建复杂的LLM驱动应用。

// User: 如何用它与 AWS Bedrock 集成？
// Bot: 要与 AWS Bedrock 集成，可通过以下步骤：1) 安装AWS SDK；2) 使用BedrockRuntimeClient初始化连接；3) 将LangChain的模型接口封装为Bedrock调用。本示例已演示了核心集成逻辑。


// 扩展建议
// 增加流式响应

// 使用 Bedrock 的流式 API + @langchain/core/load/serializable 实现实时输出

// 持久化历史存储

// 替换 ChatMessageHistory 为 Redis/DynamoDB 存储

// 添加工具调用

// 集成 @langchain/core/tools 实现天气查询/数据库操作等

// 部署为 Web 服务

// 使用 Express.js 包装为 HTTP API

// 添加前端界面（React/Vue）

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { PromptTemplate } from "@langchain/core/prompts";

// 初始化 Bedrock Client
const client = new BedrockRuntimeClient({ 
  region: process.env.AWS_REGION 
});

// 创建 LangChain Claude3 包装器
const claude3Model = {
  async invoke(messages: BaseMessage[]) {
    // 转换消息格式为 Claude3 要求的格式
    const formattedMessages = messages.map(msg => ({
      role: msg._getType() === "human" ? "user" : "assistant",
      content: [{ type: "text", text: msg.content }]
    }));

    // 构建 Bedrock 请求
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      body: JSON.stringify({
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.5
      })
    });

    // 调用模型
    const response = await client.send(command);
    const result = JSON.parse(Buffer.from(response.body).toString("utf-8"));
    
    return new AIMessage(result.content[0].text);
  }
};

// 初始化聊天历史
const messageHistory = new ChatMessageHistory();

// 创建提示模板
const promptTemplate = PromptTemplate.fromTemplate(`
你是一个友好的人工智能助手。请根据以下对话历史和最新问题回答问题：

历史:
{history}

问题: {input}
回答:`);

// 创建聊天链
async function chatChain(input: string) {
  // 1. 加载历史记录
  const history = await messageHistory.getMessages();
  
  // 2. 格式化提示
  const prompt = await promptTemplate.format({
    history: history.map(m => `${m._getType()}: ${m.content}`).join("\n"),
    input
  });

  // 3. 添加用户消息到历史
  await messageHistory.addMessage(new HumanMessage(input));

  // 4. 调用 Claude3
  const response = await claude3Model.invoke([...history, new HumanMessage(prompt)]);

  // 5. 添加 AI 响应到历史
  await messageHistory.addMessage(response);

  return response.content;
}

// 测试聊天循环
async function main() {
  console.log("Bot: 你好！我是 Claude3 助手，有什么可以帮你的？");
  
  // 示例对话
  const inputs = [
    "LangChain 是什么？",
    "如何用它与 AWS Bedrock 集成？"
  ];

  for (const input of inputs) {
    console.log(`\nUser: ${input}`);
    const response = await chatChain(input);
    console.log(`Bot: ${response}`);
  }
}

main().catch(console.error);