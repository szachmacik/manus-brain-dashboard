import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { pushRouter } from "./routers/push";
import { aiRouter } from "./routers/ai";
import { brainRouter } from "./routers/brain";
import { vectorRouter } from "./routers/vector";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  push: pushRouter,
  ai: aiRouter,
  brain: brainRouter,
  vector: vectorRouter,
});

export type AppRouter = typeof appRouter;
