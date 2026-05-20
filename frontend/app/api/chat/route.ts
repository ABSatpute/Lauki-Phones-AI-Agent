import { NextRequest, NextResponse } from "next/server";
import aws4 from "aws4";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const AGENT_ARN = process.env.AGENT_ARN!;
const ENCODED_ARN = encodeURIComponent(AGENT_ARN);
const HOST = `bedrock-agentcore.${REGION}.amazonaws.com`;
const PATH = `/runtimes/${ENCODED_ARN}/invocations`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, actorId, threadId } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const body = JSON.stringify({ prompt, actor_id: actorId, thread_id: threadId });

    const opts = aws4.sign(
      {
        host: HOST,
        path: PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": threadId,
        },
        body,
        service: "bedrock-agentcore",
        region: REGION,
      },
      {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }
    );

    const res = await fetch(`https://${HOST}${PATH}`, {
      method: "POST",
      headers: opts.headers as Record<string, string>,
      body,
    });

    const text = await res.text();
    console.log("AgentCore response status:", res.status, text.slice(0, 200));

    if (!res.ok) {
      return NextResponse.json({ error: `AgentCore error ${res.status}: ${text}` }, { status: res.status });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("AgentCore error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
