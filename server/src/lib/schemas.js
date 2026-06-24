import { z } from "zod";

export const communitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon_url: z.string().url().optional().or(z.literal("")),
  is_public: z.boolean().default(false),
});

export const channelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Channel name must be lowercase and hyphenated"),
  topic: z.string().max(500).optional(),
  type: z.enum(["text", "whiteboard", "announcement", "forum"]).default("text"),
  category_id: z.string().uuid().optional().nullable(),
  position: z.number().int().default(0),
});
