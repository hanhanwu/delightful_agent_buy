"use client";

import Link from "next/link";
import { useCheckoutSuccess } from "@moneydevkit/nextjs";

export default function CheckoutSuccessPage() {
  const { isCheckoutPaidLoading, isCheckoutPaid, metadata } = useCheckoutSuccess();

  if (isCheckoutPaidLoading || isCheckoutPaid === null) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">Verifying payment...</h1>
        </div>
      </main>
    );
  }

  if (!isCheckoutPaid) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">Payment not confirmed</h1>
          <p>Please wait a moment and refresh.</p>
          <Link href="/">Return to tip page</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card">
        <p className="subtitle">Tip received</p>
        <h1 className="title">Thank you for supporting Cindy</h1>
        <p>
          Your Lightning tip was confirmed. We attached your details to customers and checkout
          metadata for dashboard visibility.
        </p>
        <p className="status">Recorded amount: ${metadata?.tipUsd ?? "unknown"}</p>
        <Link href="/">Send another tip</Link>
      </div>
    </main>
  );
}
