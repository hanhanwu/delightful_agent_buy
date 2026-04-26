"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCheckout } from "@moneydevkit/nextjs";

const PRESET_AMOUNTS = [5, 10, 25] as const;

export default function HomePage() {
  const { createCheckout, isLoading } = useCheckout();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("15");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("Your latest AI art stream was magical.");
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  // Chat
  type ChatMessage = { role: "user" | "assistant"; content: string; products?: { name?: string; priceUsd?: string; slug?: string }[] };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, products: data.referenced_products },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const amountInUsd = useMemo(() => {
    if (!isCustom) return selectedAmount;
    const parsed = Number(customAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.max(0.01, Math.round(parsed * 100) / 100);
  }, [customAmount, isCustom, selectedAmount]);

  const handleCheckout = async () => {
    setError(null);
    const amountCents = Math.round(amountInUsd * 100);
    if (!email.trim() || !name.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (amountCents <= 0) {
      setError("Please choose a valid tip amount.");
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
        tipUsd: String(amountInUsd),
        source: "human_ui",
      },
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  };

  const simulateAgentTip = async () => {
    setAgentStatus("Creating L402 challenge...");
    setError(null);

    const challenge = await fetch("/api/agent-tip");
    if (challenge.status !== 402) {
      setAgentStatus("Agent endpoint returned data directly (already authorized).");
      return;
    }

    const challengeData = await challenge.json();
    setAgentStatus(
      `402 received. Agents should pay invoice then retry with Authorization: L402 ${challengeData.macaroon}:<preimage>`
    );
  };

  return (
    <main className="container">
      <div className="card">
        <header>
          <h1 className="title">Delight Me - Hanhan's Agent Buyer</h1>
        </header>

        <section className="section">
          <h2>Leave a tip</h2>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Avery" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="avery@example.com"
            />
          </div>

          <div className="field">
            <label>Amount</label>
            <div className="amountGrid">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`amountButton ${!isCustom && selectedAmount === amount ? "active" : ""}`}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setIsCustom(false);
                  }}
                >
                  ${amount}
                </button>
              ))}
              <button
                type="button"
                className={`amountButton ${isCustom ? "active" : ""}`}
                onClick={() => setIsCustom(true)}
              >
                Custom
              </button>
            </div>
          </div>

          {isCustom && (
            <div className="field">
              <label htmlFor="customAmount">Custom amount (USD)</label>
              <input
                id="customAmount"
                type="number"
                min={1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="note">Message to Cindy</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="actions">
            <button className="primary" onClick={handleCheckout} disabled={isLoading}>
              {isLoading ? "Creating checkout..." : `Tip $${amountInUsd}`}
            </button>
          </div>
        </section>
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
