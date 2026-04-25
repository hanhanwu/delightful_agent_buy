import { withPayment } from "@moneydevkit/nextjs/server";

const handler = async () => {
  return Response.json({
    ok: true,
    message: "Agent tip accepted. You have access to Cindy's premium AI art feed.",
  });
};

export const GET = withPayment({ amount: 25, currency: "SAT" }, handler);
