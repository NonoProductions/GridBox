import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

// Validate and sanitize token
function extractToken(authorization: string | null): string | null {
  if (!authorization) return null;
  
  // Only allow Bearer tokens
  if (!authorization.startsWith("Bearer ")) return null;
  
  const token = authorization.slice(7).trim();
  
  // Basic validation: JWT tokens are base64url encoded and have 3 parts
  if (!token || token.length < 20) return null;
  
  // Prevent potential injection by checking for suspicious characters
  if (!/^[A-Za-z0-9._-]+$/.test(token)) return null;
  
  return token;
}

export async function GET(request: Request) {
  try {
    // Validate environment variables
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase Service Role configuration missing");
      return NextResponse.json(
        { message: "Service configuration error" },
        { status: 500 }
      );
    }

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { message: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // Extract and validate authorization header
    const authorization = request.headers.get("authorization") || 
                         request.headers.get("Authorization");
    const token = extractToken(authorization);

    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // Create Supabase client with service role key
    const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify token and get user
    const {
      data: userData,
      error: userError,
    } = await supabaseServer.auth.getUser(token);

    if (userError || !userData?.user) {
      // Don't leak error details
      return NextResponse.json(
        { message: "Authentication failed" },
        { status: 401 }
      );
    }

    // Check user role
    const { data: roleData, error: roleError } = await supabaseServer
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (roleError || !roleData) {
      return NextResponse.json(
        { message: "Authorization check failed" },
        { status: 500 }
      );
    }

    // Verify owner role
    if (roleData.role !== "owner") {
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch users with pagination to prevent large responses
    const { data, error } = await supabaseServer
      .from("profiles")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(1000); // Reasonable limit

    if (error) {
      console.error("Error loading users:", error);
      return NextResponse.json(
        { message: "Failed to load users" },
        { status: 500 }
      );
    }

    // Sanitize and map user data
    const users = (data || []).map((profile) => ({
      user_id: profile.id,
      email: profile.email || "", // Ensure email is always a string
      role: profile.role || "user",
      created_at: profile.created_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Unexpected error in admin/users route:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

