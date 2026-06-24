import { betterAuth } from "better-auth";
import { supabaseAdapter } from "better-auth/adapters/supabase";
import { supabase } from "../lib/supabase.js";

export const auth = betterAuth({
    database: supabaseAdapter(supabase, {
        schema: "public",
    }),
    emailAndPassword: {
        enabled: true,
    },
    // Add magic link and social providers as needed
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
    },
});
