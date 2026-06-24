import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const api = new Hono();

api.use("*", authMiddleware);

// Get current user profile
api.get("/me", async (c) => {
  const user = c.get("user");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Update profile
api.put("/me", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  
  // Basic validation for profile update
  const { display_name, bio, avatar_url } = body;

  const { data, error } = await supabase
    .from("users")
    .update({ display_name, bio, avatar_url, updated_at: new Date() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Get user by ID
api.get("/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

export default api;
