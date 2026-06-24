import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";
import { communitySchema } from "../lib/schemas.js";

const api = new Hono();

api.use("*", authMiddleware);

// Get all communities for current user
api.get("/", async (c) => {
  const user = c.get("user");
  const { data, error } = await supabase
    .from("community_members")
    .select("communities(*)")
    .eq("user_id", user.id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data.map((d) => d.communities));
});

// Create community
api.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validated = communitySchema.safeParse(body);

  if (!validated.success) {
    return c.json({ error: validated.error.format() }, 400);
  }

  const { data: community, error: communityError } = await supabase
    .from("communities")
    .insert([{ ...validated.data, owner_id: user.id }])
    .select()
    .single();

  if (communityError) return c.json({ error: communityError.message }, 500);

  // Add creator as owner/member
  await supabase.from("community_members").insert([
    {
      community_id: community.id,
      user_id: user.id,
      role: "owner",
    },
  ]);

  return c.json(community, 201);
});

// Get community details
api.get("/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await supabase
    .from("communities")
    .select("*, channel_categories(*, channels(*))")
    .eq("id", id)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

export default api;
