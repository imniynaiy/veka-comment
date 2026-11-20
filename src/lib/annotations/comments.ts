import { z } from "astro/zod";

export const comments = z.object({
  version: z.literal(1),
  threads: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    status: z.enum(['open', 'resolved']),
    messages: z.array(z.object({ author: z.string().min(1), body: z.string().min(1), createdAt: z.string().datetime({offset:true}) })).min(1)
  }))
});

export type Thread = z.infer<typeof comments>["threads"][number];
