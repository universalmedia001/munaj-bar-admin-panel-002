// Supabase Edge Function: create-worker
// Secure worker account creation for MUNAJ BAR Admin Panel using Auth Admin API
// Runs server-side with SUPABASE_SERVICE_ROLE_KEY secret (never exposed to browser)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateWorkerPayload {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: "cashier" | "bar_worker" | "sales_worker" | "manager" | "admin";
  is_active?: boolean;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[create-worker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment secrets.");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error. Service role key is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authenticate Admin Request (Authorization: Bearer <JWT>)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized. Missing authorization token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized. Invalid authorization token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Service-role Client (Server-side privileged client)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: requestingUser },
      error: userAuthError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userAuthError || !requestingUser) {
      console.warn("[create-worker] Token verification failed:", userAuthError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized. Invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify Requesting User's Role in Profiles Table (or User Metadata)
    const { data: requesterProfile, error: profileLookupError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active, full_name")
      .eq("id", requestingUser.id)
      .maybeSingle();

    if (profileLookupError) {
      console.warn("[create-worker] Requester profile lookup notice:", profileLookupError.message);
    }

    const effectiveRole = requesterProfile?.role || (requestingUser.user_metadata?.role as string) || "admin";
    const isRequesterActive = requesterProfile ? requesterProfile.is_active !== false : true;
    const allowedRoles = ["admin", "manager"];

    if (!allowedRoles.includes(effectiveRole) || !isRequesterActive) {
      console.warn(`[create-worker] Forbidden: User ${requestingUser.id} with role ${effectiveRole} attempted worker creation.`);
      return new Response(
        JSON.stringify({ success: false, error: "You do not have permission to create worker accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and Validate Body Payload
    let body: CreateWorkerPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name, phone, role = "cashier", is_active = true } = body;

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Email, password, full name, and role are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = full_name.trim();
    const cleanPhone = phone ? phone.trim() : null;

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 6 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validWorkerRoles = ["cashier", "bar_worker", "sales_worker", "manager", "admin"];
    if (!validWorkerRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid role specified. Allowed roles: ${validWorkerRoles.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Check for Duplicate Email in Profiles Table
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "A worker account with this email already exists." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Create Auth User via Supabase Auth Admin API
    // email_confirm: true auto-confirms without dispatching client confirmation emails
    console.log(`[create-worker] Provisioning Auth user: ${cleanEmail} (Role: ${role})`);
    const { data: authCreatedUser, error: authAdminError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        role: role,
        phone: cleanPhone,
      },
    });

    if (authAdminError) {
      console.warn("[create-worker] Auth Admin createUser error:", authAdminError.message);
      const errLower = authAdminError.message.toLowerCase();
      if (errLower.includes("already registered") || errLower.includes("user already exists") || errLower.includes("duplicate")) {
        return new Response(
          JSON.stringify({ success: false, error: "A worker account with this email already exists." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errLower.includes("rate limit") || (authAdminError as any).status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Worker account creation is temporarily rate-limited by Supabase. Please wait and try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: authAdminError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authCreatedUser.user.id;

    // 8. Create / Upsert Profile Record
    const profilePayload: Record<string, any> = {
      id: newUserId,
      full_name: cleanFullName,
      email: cleanEmail,
      role: role,
      is_active: is_active,
      updated_at: new Date().toISOString(),
    };

    if (cleanPhone) {
      profilePayload.phone = cleanPhone;
    }

    let { error: profileInsertError } = await supabaseAdmin.from("profiles").upsert(profilePayload);

    // Fallback if profiles table doesn't have a phone column
    if (profileInsertError && profileInsertError.message?.toLowerCase().includes("phone")) {
      delete profilePayload.phone;
      const retryResult = await supabaseAdmin.from("profiles").upsert(profilePayload);
      profileInsertError = retryResult.error;
    }

    if (profileInsertError) {
      console.error("[create-worker] Profile record creation failed:", profileInsertError.message);
      // Clean up orphaned Auth User to maintain transaction integrity
      try {
        console.log(`[create-worker] Cleaning up auth user ${newUserId} due to profile insertion failure.`);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      } catch (cleanupErr) {
        console.error("[create-worker] Cleanup failed:", cleanupErr);
      }

      return new Response(
        JSON.stringify({ success: false, error: `Failed to create worker profile record: ${profileInsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Insert Activity Audit Log
    try {
      const performerName = requesterProfile?.full_name || requestingUser.email || "Admin";
      await supabaseAdmin.from("activity_logs").insert({
        action: "worker_created",
        entity_type: "profiles",
        entity_id: newUserId,
        description: `Provisioned staff account "${cleanFullName}" (${role.toUpperCase()}) by ${performerName}`,
        performed_by: requestingUser.id,
      });
    } catch (logErr) {
      console.warn("[create-worker] Non-blocking activity log insert failure:", logErr);
    }

    // 10. Return Clean Success Response
    return new Response(
      JSON.stringify({
        success: true,
        worker: {
          id: newUserId,
          email: cleanEmail,
          role: role,
          full_name: cleanFullName,
          phone: cleanPhone,
          is_active: is_active,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[create-worker] Unhandled exception:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
