"use client";

import { useEffect, useRef, useState } from "react";
import { useCheckout } from "@moneydevkit/nextjs";

export default function HomePage() {
  const { createCheckout, isLoading } = useCheckout();
  const [name] = useState(process.env.NEXT_PUBLIC_USER_NAME ?? "");
  const [email] = useState(process.env.NEXT_PUBLIC_USER_EMAIL ?? "");
  const [note] = useState("Your latest AI art stream was magical.");
  const [error, setError] = useState<string | null>(null);

  // Chat
  type ChatMessage = { role: "user" | "assistant"; content: string; products?: { name?: string; priceUsd?: string; slug?: string }[]; payAmount?: number; payDisplay?: string; payPrompt?: { amount: number; display: string } };
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
    window.location.href = result.data.checkoutUrl;
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

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
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
        content: data.reply,
        products: data.referenced_products,
        ...(priceMatch ? { payPrompt: { amount: parseFloat(priceMatch[1]), display: priceMatch[1] } } : {}),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
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
              <div key={i} className={`chatBubble ${msg.role}`}>
                <p>{msg.content}</p>
                {msg.role === "assistant" && msg.products && msg.products.length > 0 && (
                  <div className="chatProducts">
                    {msg.products.map((p, j) => (
                      <span key={j} className="chatProduct">
                        {p.name}{p.priceUsd ? ` — ${p.priceUsd}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && msg.payPrompt && msg.payAmount === undefined && (
                  <div style={{ marginTop: "8px" }}>
                    <p>Would you like to pay ${msg.payPrompt.display}?</p>
                    <button
                      className="primary"
                      style={{ marginRight: "8px" }}
                      onClick={() => handlePayYes(i, msg.payPrompt!.amount, msg.payPrompt!.display)}
                    >
                      Yes
                    </button>
                    <button onClick={() => handlePayNo(i)}>No</button>
                  </div>
                )}
                {msg.role === "assistant" && msg.payAmount !== undefined && (
                  <button
                    className="primary"
                    style={{ marginTop: "8px" }}
                    onClick={() => handleChatCheckout(msg.payAmount!)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating checkout..." : `Confirm to pay $${msg.payDisplay ?? msg.payAmount!.toFixed(2)}`}
                  </button>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="chatBubble assistant">
                <span className="chatTyping">Thinking…</span>
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
