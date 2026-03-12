import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const useSupabase = !!(supabaseUrl && supabaseAnonKey);

let supabase;
if (useSupabase) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log("✅ Supabase connected");
} else {
  console.log("⚠️ Supabase credentials missing. Using in-memory storage.");
}

// In-memory fallback storage
// (Not used when Supabase is configured)

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/config", (req, res) => {
  console.log("Config requested. URL set:", !!process.env.SUPABASE_URL, "Key set:", !!process.env.SUPABASE_ANON_KEY);
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

// API Routes
const authenticate = async (req, res, next) => {
  if (!useSupabase) {
    return res.status(503).json({ error: "Supabase is not configured on the server. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables." });
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  
  const token = authHeader.split(' ')[1];
  try {
    // Create a per-request client that uses the user's token
    // This ensures RLS policies like `auth.uid() = owner_id` work correctly
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Invalid token" });
    
    req.user = user;
    req.supabase = userClient;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

app.get("/api/boards", authenticate, async (req, res) => {
  try {
    const { data: boards, error } = await req.supabase
      .from('boards')
      .select('*');
    
    if (error) throw error;
    res.json(boards || []);
  } catch (error) {
    console.error("Server error fetching boards:", error);
    res.status(500).json({ error: `Database error: ${error.message}.` });
  }
});

app.post("/api/boards", authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await req.supabase
      .from('boards')
      .insert([{ name, owner_id: req.user.id }])
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error creating board:", error);
      throw error;
    }

    // Auto-add owner as a member
    const { error: memberError } = await req.supabase
      .from('board_members')
      .insert([{ board_id: data.id, user_id: req.user.id, role: 'owner' }]);
    
    if (memberError) {
      console.error("Supabase error adding owner to board_members:", memberError);
      throw memberError;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error("Detailed Server error creating board:", JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: `Database error: ${error.message || 'Unknown error'}.`,
      details: error.details || null,
      hint: error.hint || null
    });
  }
});

app.post("/api/boards/:id/share", authenticate, async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  try {
    const { data: userData, error: userError } = await req.supabase.rpc('get_user_id_by_email', { email_input: email });
    
    if (userError || !userData) {
        return res.status(404).json({ error: "User not found. They must sign up first." });
    }

    const { error } = await req.supabase
      .from('board_members')
      .insert([{ board_id: id, user_id: userData, role: 'member' }]);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/boards/:id/columns", authenticate, async (req, res) => {
  const { id } = req.params;
  const { columns } = req.body;
  try {
    const { error } = await req.supabase
      .from('boards')
      .update({ columns })
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tasks", authenticate, async (req, res) => {
  const { board_id } = req.query;
  try {
    const { data, error } = await req.supabase
      .from('tasks')
      .select('*')
      .eq('board_id', board_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks", authenticate, async (req, res) => {
  const { title, priority, note, status, board_id } = req.body;
  try {
    console.log(`Inserting task into board ${board_id} for user ${req.user.id}`);
    const { data, error } = await req.supabase
      .from('tasks')
      .insert([{ title, priority, note, status, board_id, user_id: req.user.id }])
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error creating task:", error);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }
    return res.status(201).json(data);
  } catch (error) {
    console.error("Server error creating task:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/tasks/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, priority, note, status } = req.body;
  try {
    console.log(`Updating task ${id} for user ${req.user.id}`);
    const { data, error } = await req.supabase
      .from('tasks')
      .update({ title, priority, note, status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error updating task:", error);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }
    return res.json(data);
  } catch (error) {
    console.error("Server error updating task:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await req.supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route to serve index.html for any non-API requests
// We exclude requests that look like files (have an extension) to avoid MIME type errors
app.get('*', (req, res, next) => {
  if (req.path.includes('.') || req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
