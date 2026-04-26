"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { useCheckout } from "@moneydevkit/nextjs";

// ── Markdown helpers ─────────────────────────────────────────────────────────
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`}>
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  lines.forEach((line, idx) => {
    if (/^[-*•]\s/.test(line)) {
      listBuf.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() === "") {
        if (idx > 0) elements.push(<br key={`br-${idx}`} />);
      } else {
        elements.push(<p key={`p-${idx}`}>{renderInline(line)}</p>);
      }
    }
  });
  flushList();
  return <>{elements}</>;
}

export default function HomePage() {
  const { createCheckout, isLoading } = useCheckout();
  const [name] = useState(process.env.NEXT_PUBLIC_USER_NAME ?? "");
  const [email] = useState(process.env.NEXT_PUBLIC_USER_EMAIL ?? "");
  const [note] = useState("Your latest AI art stream was magical.");
  const [error, setError] = useState<string | null>(null);

  // Chat
  type Product = {
    name?: string;
    priceUsd?: string;
    slug?: string;
    description?: string;
    origin?: string;
    roastLevel?: string;
    flavorNotes?: string[];
  };
  type Top3Pick = {
    slug: string;
    name: string;
    reason: string;
    priceUsd?: string;
    category?: string;
    roastLevel?: string;
    flavorNotes?: string[];
  };
  type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    products?: Product[];
    top3?: Top3Pick[];
    payAmount?: number;
    payDisplay?: string;
    payPrompt?: { amount: number; display: string };
    timestamp?: number;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatCheckout = async (amountUsd: number) => {
    setError(null);
    const amountCents = Math.round(amountUsd * 100);
    if (!email.trim() || !name.trim()) {
      setError("Name and email are required to complete payment.");
      return;
    }
    const result = await createCheckout({
      type: "AMOUNT",
      title: "Tip Cindy - AI Art Sorceress",
      description: note.trim() || "Support Cindy's creative AI art work",
      amount: amountCents,
      currency: "USD",
      successUrl: "/checkout/success",
      customer: {
        name: name.trim(),
        email: email.trim(),
        externalId: email.trim().toLowerCase(),
      },
      requireCustomerData: ["name", "email"],
      metadata: {
        creator: "cindy-ai-art-sorceress",
        tipUsd: String(amountUsd),
        source: "chat_ui",
      },
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const handlePayYes = (msgIndex: number, amount: number, display: string) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, payAmount: amount / 1000, payDisplay: display, payPrompt: undefined } : m
      )
    );
  };

  const handlePayNo = (msgIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, payPrompt: undefined } : m))
    );
  };

  const handleCancelConfirmed = (msgIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, payAmount: undefined, payDisplay: undefined } : m
      )
    );
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    // Detect "pay $X" intent — amount is X/100 USD
    const payMatch = text.match(/^pay\s+\$(\d+(?:\.\d+)?)/i);
    if (payMatch) {
      const originalValue = payMatch[1];
      const amountUsd = parseFloat(originalValue) / 100;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Ready to send a payment of $${originalValue}. Hit the button below to confirm.`,
          payAmount: amountUsd,
          payDisplay: originalValue,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const priceMatch = (data.reply as string).match(/\$(\d+(?:\.\d{1,2})?)/);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply ?? "",
        products: data.referenced_products,
        top3: data.top3 ?? [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <header>
          <h1 className="title">Delight Me - Hanhan's Agent Buyer</h1>
        </header>

        <section className="section">
          <h2>Chat with our assistant</h2>
          <p>Ask about products, get recommendations, or find the right coffee for you.</p>
          <div className="chatMessages">
            {messages.length === 0 && (
              <p className="chatEmpty">Ask me anything — e.g. &ldquo;What&apos;s a good light roast?&rdquo;</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chatRow chatRow--${msg.role}`}>
                {msg.role === "assistant" && <div className="chatAvatar chatAvatar--assistant">☕</div>}
                <div className={`chatBubble chatBubble--${msg.role}`}>
                  <div className="chatMeta">
                    <span className="chatRole">{msg.role === "user" ? "You" : "Assistant"}</span>
                    {msg.timestamp && (
                      <span className="chatTime">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <div className="chatContent">{renderMarkdown(msg.content)}</div>
                  {msg.role === "assistant" && msg.top3 && msg.top3.length > 0 && (
                    <div className="top3Section">
                      <div className="top3Label">Top picks for you</div>
                      {msg.top3.map((pick, j) => (
                        <div key={j} className="top3Card">
                          <div className="top3CardHead">
                            <span className="top3Rank">#{j + 1}</span>
                            <span className="productName">{pick.name}</span>
                            {pick.priceUsd && <span className="productPrice">{pick.priceUsd}</span>}
                          </div>
                          <div className="top3Meta">
                            {pick.category && <span className="top3Category">{pick.category}</span>}
                            {pick.roastLevel && <span className="productRoast">{pick.roastLevel}</span>}
                          </div>
                          {pick.flavorNotes && pick.flavorNotes.length > 0 && (
                            <div className="flavorChips">
                              {pick.flavorNotes.map((note, k) => (
                                <span key={k} className="flavorChip">{note}</span>
                              ))}
                            </div>
                          )}
                          <p className="top3Reason">💡 {pick.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === "assistant" && msg.payPrompt && msg.payAmount === undefined && (
                    <div className="payPrompt">
                      <p>Would you like to pay ${msg.payPrompt.display}?</p>
                      <div className="payActions">
                        <button className="primary" onClick={() => handlePayYes(i, msg.payPrompt!.amount, msg.payPrompt!.display)}>Yes, pay</button>
                        <button className="secondary" onClick={() => handlePayNo(i)}>No thanks</button>
                      </div>
                    </div>
                  )}
                  {msg.role === "assistant" && msg.payAmount !== undefined && (
                    <div className="payActions" style={{ marginTop: "0.65rem" }}>
                      <button className="primary" onClick={() => handleChatCheckout(msg.payAmount!)} disabled={isLoading}>
                        {isLoading ? "Creating checkout…" : `Confirm payment of $${msg.payDisplay ?? msg.payAmount!.toFixed(2)}`}
                      </button>
                      <button className="secondary" onClick={() => handleCancelConfirmed(i)} disabled={isLoading}>
                        No thanks
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === "user" && <div className="chatAvatar chatAvatar--user">👤</div>}
              </div>
            ))}
            {chatLoading && (
              <div className="chatRow chatRow--assistant">
                <div className="chatAvatar chatAvatar--assistant">☕</div>
                <div className="chatBubble chatBubble--assistant">
                  <div className="chatTypingDots"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form
            className="chatForm"
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          >
            <input
              className="chatInput"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about products…"
              disabled={chatLoading}
            />
            <button
              type="submit"
              className="primary"
              disabled={chatLoading || !chatInput.trim()}
            >
              Send
            </button>
          </form>
        </section>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
