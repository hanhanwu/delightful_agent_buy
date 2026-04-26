import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import productsData from "../../../unhuman_json/products.json";

// ---------------------------------------------------------------------------
// Product catalog — statically imported so Vercel bundles them at build time.
// ---------------------------------------------------------------------------
type RawProduct = Record<string, unknown>;

const ALL_PRODUCTS: RawProduct[] = (
  (productsData as { products?: RawProduct[] }).products ?? []
);

// ---------------------------------------------------------------------------
// Groq client — only reads env vars on the server, never exposed to the browser
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
const MODEL = process.env.GROQ_MODEL ?? "llama3-8b-8192";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function selectRelevant(query: string, products: RawProduct[], limit = 8): RawProduct[] {
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

type Top3Pick = { slug: string; name: string; reason: string };

function parseStructuredReply(raw: string): { reply: string; top3: Top3Pick[] } {
  // Try to find a JSON block (```json ... ``` or bare { ... })
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.reply && Array.isArray(parsed.top3)) {
        return { reply: parsed.reply, top3: parsed.top3 };
      }
    } catch {
      // fall through to plain text
    }
  }
  return { reply: raw, top3: [] };
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

  const systemPrompt = `You are a friendly shopping assistant. \
You sell coffee, energy shots, energy bars, energy drinks, snacks, bundles, focus gummies, and fruit. \
Recommend products ONLY from the catalog below.

ALWAYS respond with valid JSON in this exact shape — no extra keys, no markdown outside the JSON block:
{
  "reply": "<short conversational message, 1-3 sentences>",
  "top3": [
    { "slug": "<slug>", "name": "<product name>", "reason": "<one short sentence why it fits>" },
    { "slug": "<slug>", "name": "<product name>", "reason": "<one short sentence why it fits>" },
    { "slug": "<slug>", "name": "<product name>", "reason": "<one short sentence why it fits>" }
  ]
}

Rules:
- top3 must always contain exactly 3 items chosen from the catalog.
- Each slug in top3 must be UNIQUE — never repeat the same slug twice.
- reason must be one concise sentence tailored to the user's request.
- If the user mentions a specific category, prefer products from that category first, but still pick 3 different slugs.
- Spread recommendations across different categories when the query is general.

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

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const { reply, top3: rawTop3 } = parseStructuredReply(raw);

    // Deduplicate slugs — keep first occurrence of each slug
    const seen = new Set<string>();
    const top3 = rawTop3.filter((pick) => {
      if (seen.has(pick.slug)) return false;
      seen.add(pick.slug);
      return true;
    });

    // Attach full product details to each top3 pick
    const top3WithDetails = top3.map((pick) => {
      const product = ALL_PRODUCTS.find((p) => (p as { slug?: string }).slug === pick.slug);
      return { ...pick, ...(product ?? {}) };
    });

    return NextResponse.json({ reply, top3: top3WithDetails, referenced_products: references });
  } catch (err) {
    console.error("Groq API error:", err);
    return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
  }
}
