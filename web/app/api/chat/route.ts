import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import coffeeData from "../../../unhuman_json/coffee.json";

// ---------------------------------------------------------------------------
// Product catalog — statically imported so Vercel bundles them at build time.
// To add more product files, import them here and spread into ALL_PRODUCTS.
// ---------------------------------------------------------------------------
type RawProduct = Record<string, unknown>;

const ALL_PRODUCTS: RawProduct[] = [
  ...((coffeeData as { products?: RawProduct[] }).products ?? []).map((p) => ({
    ...p,
    sourceFile: "coffee.json",
  })),
];

// ---------------------------------------------------------------------------
// Groq client — only reads env vars on the server, never exposed to the browser
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
const MODEL = process.env.GROQ_MODEL ?? "llama3-8b-8192";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function selectRelevant(query: string, products: RawProduct[], limit = 4): RawProduct[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (!terms.length) return products.slice(0, limit);

  const scored = products.map((p) => ({
    score: terms.filter((t) => JSON.stringify(p).toLowerCase().includes(t)).length,
    p,
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).map((s) => s.p);
  return top.length ? top.slice(0, limit) : products.slice(0, limit);
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: { message?: string; history?: { role: string; content: string }[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  const references = selectRelevant(message, ALL_PRODUCTS);

  const systemPrompt = `You are a friendly shopping assistant for a specialty coffee store. \
Recommend products only from the catalog below. Be concise and helpful. \
If no product fits the request, say so clearly.

Catalog:
${JSON.stringify(references, null, 2)}`;

  const history = (body.history ?? [])
    .slice(-8)
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content ?? "I could not generate a response.";

    return NextResponse.json({ reply, referenced_products: references });
  } catch (err) {
    console.error("Groq API error:", err);
    return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
  }
}
