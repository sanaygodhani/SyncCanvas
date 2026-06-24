import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";
import { channelSchema } from "../lib/schemas.js";

const api = new Hono();

api.use("*", authMiddleware);

// Get channels for a community
api.get("/community/:communityId", async (c) => {
  const communityId = c.req.param("communityId");
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("community_id", communityId)
    .order("position", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Create channel
api.post("/community/:communityId", async (c) => {
  const communityId = c.req.param("communityId");
  const body = await c.req.json();
  const validated = channelSchema.safeParse(body);

  if (!validated.success) {
    return c.json({ error: validated.error.format() }, 400);
  }

  const { data, error } = await supabase
    .from("channels")
    .insert([{ ...validated.data, community_id: communityId }])
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// Update channel
api.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = channelSchema.partial().safeParse(body);

  if (!validated.success) {
    return c.json({ error: validated.error.format() }, 400);
  }

  const { data, error } = await supabase
    .from("channels")
    .update(validated.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Delete channel
api.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabase.from("channels").delete().eq("id", id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

export default api;
