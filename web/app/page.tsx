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

const STARTER_CHIPS = [
  { label: "☕  Light roast coffee", text: "I'm looking for a light roast coffee" },
  { label: "⚡  Energy boost", text: "What gives the best energy boost?" },
  { label: "🍫  Sweet snacks", text: "I want something sweet and satisfying" },
  { label: "📦  Bundle deals", text: "Show me your best bundle deals" },
];

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
  type CartItem = { slug: string; name: string; priceCents: number; priceUsd: string };
  type Top3Pick = {
    slug: string;
    name: string;
    reason: string;
    priceUsd?: string;
    priceCents?: number;
    category?: string;
    roastLevel?: string;
    flavorNotes?: string[];
  };
  type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    products?: Product[];
    top3?: Top3Pick[];
    chosenSlugs?: string[];
    selectionConfirmed?: boolean;
    payAmount?: number;
    payDisplay?: string;
    payPrompt?: { amount: number; display: string };
    timestamp?: number;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatCheckout = async (amountUsd: number) => {
    setError(null);
    // Open the tab synchronously (before any await) so the browser doesn't block the popup.
    const newTab = window.open("", "_blank");
    if (!newTab) {
      setError("Popups are blocked. Please allow popups for this site and try again.");
      return;
    }
    // Show a styled spinner so the tab never looks blank while we await the checkout URL.
    newTab.document.write(
      "<!DOCTYPE html><html><head><title>Loading checkout\u2026</title>" +
      "<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;" +
      "background:#faf5ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".wrap{text-align:center;}" +
      ".spinner{width:52px;height:52px;border:5px solid #e9d5ff;border-top-color:#7c3aed;" +
      "border-radius:50%;animation:spin .75s linear infinite;margin:0 auto 1.2rem;}" +
      "@keyframes spin{to{transform:rotate(360deg)}}" +
      "p{color:#6b7280;font-size:1rem;margin:0}</style></head>" +
      "<body><div class='wrap'><div class='spinner'></div><p>Loading your checkout\u2026</p></div></body></html>"
    );
    // Actual charge is the displayed price divided by 1000.
    const actualAmountUsd = amountUsd / 1000;
    const amountCents = Math.round(actualAmountUsd * 100);
    if (!email.trim() || !name.trim()) {
      newTab.close();
      setError("Name and email are required to complete payment.");
      return;
    }
    const result = await createCheckout({
      type: "AMOUNT",
      title: "Purchase from AI Agent Store",
      description: note.trim() || "AI agent buy from agents",
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
        creator: "ai-agent-store",
        tipUsd: String(actualAmountUsd),
        source: "chat_ui",
      },
    });
    if (result.error) {
      newTab.close();
      setError(result.error.message);
      return;
    }
    newTab.location.href = result.data.checkoutUrl;
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
    setCart([]);
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, payAmount: undefined, payDisplay: undefined } : m
      )
    );
  };

  const handleTogglePick = (msgIndex: number, slug: string) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== msgIndex) return m;
        const current = m.chosenSlugs ?? [];
        const next = current.includes(slug)
          ? current.filter((s) => s !== slug)
          : [...current, slug];
        return { ...m, chosenSlugs: next };
      })
    );
  };

  const handleConfirmPicks = (msgIndex: number, allPicks: Top3Pick[]) => {
    const msg = messages[msgIndex];
    const selected = allPicks.filter((p) => (msg.chosenSlugs ?? []).includes(p.slug));
    if (selected.length === 0) return;
    const newItems: CartItem[] = selected.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents ?? 0,
      priceUsd: p.priceUsd ?? "$0.00",
    }));
    const updatedCart = [...cart, ...newItems];
    setCart(updatedCart);
    const total = updatedCart.reduce((s, item) => s + item.priceCents, 0);
    const totalDisplay = (total / 100).toFixed(2);
    const cartLines = updatedCart.map((item) => `- **${item.name}** \u2014 ${item.priceUsd}`).join("\n");
    const userContent =
      selected.length === 1
        ? `I'll take the ${selected[0].name}.`
        : `I'll take these: ${selected.map((p) => p.name).join(", ")}.`;
    setMessages((prev) =>
      prev
        .map((m, i) => (i === msgIndex ? { ...m, selectionConfirmed: true } : m))
        .concat([
          { role: "user" as const, content: userContent, timestamp: Date.now() },
          {
            role: "assistant" as const,
            content: `Great choice${selected.length > 1 ? "s" : ""}! Here's your cart:\n${cartLines}\n\nTotal: **$${totalDisplay}**\n\nWould you like to pay $${totalDisplay}?`,
            payAmount: total / 100,
            payDisplay: totalDisplay,
            timestamp: Date.now() + 1,
          },
        ])
    );
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
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
    <div className={`chatShell${messages.length === 0 ? " chatShell--empty" : ""}`}>
      {messages.length > 0 && (
        <header className="chatAppHeader">
          <span className="chatAppLogo">☕</span>
          <span className="chatAppTitle">Delight Me</span>
        </header>
      )}

      {messages.length === 0 && (
        <div className="chatHero">
          <div className="chatHeroEmoji">☕</div>
          <h1 className="chatHeroTitle">Hi, {name || "Hanhan"}! What can I help you find today?</h1>
          <p className="chatHeroSub">Coffee, energy shots, bars, snacks &amp; more — just ask.</p>
          <div className="chatSuggestions">
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                className="chatSuggestionChip"
                onClick={() => sendMessage(chip.text)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="chatMessages">
          {messages.map((msg, i) => (
            <div key={i} className={`chatRow chatRow--${msg.role}`}>
              {msg.role === "assistant" && <div className="chatAvatar chatAvatar--assistant">☕</div>}
              <div className={`chatBubble chatBubble--${msg.role}`}>
                <div className="chatMeta">
                  <span className="chatRole">{msg.role === "user" ? "Hanhan" : "Assistant"}</span>
                  {msg.timestamp && (
                    <span className="chatTime">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="chatContent">{renderMarkdown(msg.content)}</div>
                {msg.role === "assistant" && msg.top3 && msg.top3.length > 0 && (
                  <div className="top3Section">
                    <div className="top3Label">
                      {msg.selectionConfirmed ? "Your selections:" : "Top picks — select one or more:"}
                    </div>
                    {msg.top3.map((pick, j) => {
                      const isChosen = (msg.chosenSlugs ?? []).includes(pick.slug);
                      const imgSrc = pick.category
                        ? `/images/${pick.category}_${pick.slug}.png`
                        : null;
                      return (
                        <div
                          key={j}
                          className={`top3Card${isChosen ? " top3Card--chosen" : ""}`}
                        >
                          {imgSrc && (
                            <img
                              src={imgSrc}
                              alt={pick.name}
                              className="top3CardImg"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
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
                          {!msg.selectionConfirmed && (
                            <button
                              className={`chooseBtn${isChosen ? " chooseBtn--selected" : ""}`}
                              onClick={() => handleTogglePick(i, pick.slug)}
                            >
                              {isChosen ? "✓ Selected" : "+ Select"}
                            </button>
                          )}
                          {msg.selectionConfirmed && isChosen && (
                            <div className="chosenBadge">✓ In your order</div>
                          )}
                        </div>
                      );
                    })}
                    {!msg.selectionConfirmed && (
                      <button
                        className="confirmPicksBtn"
                        disabled={(msg.chosenSlugs ?? []).length === 0}
                        onClick={() => handleConfirmPicks(i, msg.top3!)}
                      >
                        Confirm selection ({(msg.chosenSlugs ?? []).length} item{(msg.chosenSlugs ?? []).length !== 1 ? "s" : ""}) →
                      </button>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && msg.payAmount !== undefined && (
                  <div className="payActions" style={{ marginTop: "0.75rem" }}>
                    <button className="primary" onClick={() => handleChatCheckout(msg.payAmount!)} disabled={isLoading}>
                      {isLoading ? "Creating checkout…" : `Confirm — pay $${msg.payDisplay ?? msg.payAmount!.toFixed(2)}`}
                    </button>
                    <button className="secondary" onClick={() => handleCancelConfirmed(i)} disabled={isLoading}>
                      No thanks
                    </button>
                  </div>
                )}
              </div>
              {msg.role === "user" && <div className="chatAvatar chatAvatar--user">{(name || "Hanhan").charAt(0).toUpperCase()}</div>}
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
      )}

      <div className="chatInputWrap">
        {error && <p className="error">{error}</p>}
        <form className="chatForm" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <input
            className="chatInput"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={messages.length === 0 ? "Ask me anything…" : "Reply…"}
            disabled={chatLoading}
            autoFocus
          />
          <button type="submit" className="primary" disabled={chatLoading || !chatInput.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
