// Supabase Edge Function: delete-worker
// Secure worker account deletion for MUNAJ BAR Admin Panel using Auth Admin API
// Runs server-side with SUPABASE_SERVICE_ROLE_KEY secret (never exposed to browser)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE",
};

interface DeleteWorkerPayload {
  user_id?: string;
  userId?: string;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST or DELETE." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[delete-worker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment secrets.");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: Service role key is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authenticate Admin Request (Authorization: Bearer <JWT>)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing authorization token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid authorization token." }),
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
      console.warn("[delete-worker] Token verification failed:", userAuthError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired session." }),
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
      console.warn("[delete-worker] Requester profile lookup notice:", profileLookupError.message);
    }

    const effectiveRole = requesterProfile?.role || (requestingUser.user_metadata?.role as string) || "admin";
    const isRequesterActive = requesterProfile ? requesterProfile.is_active !== false : true;
    const allowedRoles = ["admin", "manager"];

    if (!allowedRoles.includes(effectiveRole) || !isRequesterActive) {
      console.warn(`[delete-worker] Forbidden: User ${requestingUser.id} with role ${effectiveRole} attempted worker deletion.`);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: You do not have permission to delete user accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and Validate Body Payload
    let body: DeleteWorkerPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUserId = body.user_id || body.userId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameter: user_id." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Prevent Self-Deletion
    if (requestingUser.id === targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "You cannot delete your own active administrator account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Lookup Target User Details for Audit Logging & Verification
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", targetUserId)
      .maybeSingle();

    const targetFullName = targetProfile?.full_name || "Unknown Staff";
    const targetEmail = targetProfile?.email || "Unknown Email";
    const targetRole = targetProfile?.role || "Staff";

    console.log(`[delete-worker] Admin ${requestingUser.id} initiated deletion for user ${targetUserId} (${targetFullName})`);

    // 8. Handle Relational Business Records Safely:
    // DO NOT delete sales or shifts. Preserve historical audit records by disassociating foreign keys.
    try {
      // Close active shifts for this worker if any
      await supabaseAdmin
        .from("shifts")
        .update({ status: "closed", ended_at: new Date().toISOString() })
        .eq("worker_id", targetUserId)
        .eq("status", "active");

      // Preserving historical sales records: dissociate worker_id without dropping revenue records
      await supabaseAdmin
        .from("sales")
        .update({ worker_id: null })
        .eq("worker_id", targetUserId);

      // Preserving receipt print audit records:
      await supabaseAdmin
        .from("receipt_prints")
        .update({ worker_id: null })
        .eq("worker_id", targetUserId);

      // Preserving shift audit logs:
      await supabaseAdmin
        .from("shifts")
        .update({ worker_id: null })
        .eq("worker_id", targetUserId);

      // Disassociate user from past activity logs
      await supabaseAdmin
        .from("activity_logs")
        .update({ actor_id: null })
        .eq("actor_id", targetUserId);

      // Disassociate user from business settings edits
      await supabaseAdmin
        .from("business_settings")
        .update({ updated_by: null })
        .eq("updated_by", targetUserId);

      // Delete worker notifications
      await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("recipient_id", targetUserId);
    } catch (relationErr) {
      console.warn("[delete-worker] Non-blocking relation update notice:", relationErr);
    }

    // 9. Delete Auth User via Supabase Auth Admin API
    let authDeleted = false;
    try {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (authDeleteError) {
        const errMsgLower = authDeleteError.message.toLowerCase();
        if (errMsgLower.includes("user not found") || errMsgLower.includes("not found")) {
          console.log(`[delete-worker] User ${targetUserId} was not present in auth.users (already deleted or local-only).`);
          authDeleted = true;
        } else {
          console.error("[delete-worker] Auth Admin deleteUser error:", authDeleteError.message);
          return new Response(
            JSON.stringify({ success: false, error: `Auth account deletion failed: ${authDeleteError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        authDeleted = true;
        console.log(`[delete-worker] Successfully deleted auth.users entry for ${targetUserId}`);
      }
    } catch (authEx) {
      console.error("[delete-worker] Auth deletion exception:", authEx);
      return new Response(
        JSON.stringify({ success: false, error: "Auth account deletion failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: remainingAuthUser, error: authVerifyError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (authVerifyError && !authVerifyError.message.toLowerCase().includes("not found")) {
      return new Response(
        JSON.stringify({ success: false, error: `Auth account deletion could not be verified: ${authVerifyError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (remainingAuthUser?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Auth account deletion could not be verified: the worker Auth user still exists." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Delete from public.profiles table
    // (Note: If auth.users was deleted and profiles.id references auth.users ON DELETE CASCADE,
    // this may already be deleted; executing an explicit delete ensures it is gone in all cases)
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (profileDeleteError) {
      console.error("[delete-worker] Error deleting row from public.profiles:", profileDeleteError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Database deletion failed: ${profileDeleteError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify row is deleted
    const { data: verifyRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (verifyRow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete user profile from the database.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 11. Insert Activity Audit Log
    try {
      const performerName = requesterProfile?.full_name || requestingUser.email || "Admin";
      await supabaseAdmin.from("activity_logs").insert({
        action: "user_deleted",
        entity_type: "profiles",
        entity_id: targetUserId,
        description: `Permanently deleted user account "${targetFullName}" (${targetEmail}) by ${performerName}`,
        actor_id: requestingUser.id,
        metadata: {
          user_id: targetUserId,
          full_name: targetFullName,
          email: targetEmail,
          role: targetRole,
          deleted_by: performerName,
          deleted_by_id: requestingUser.id,
          auth_deleted: authDeleted,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.warn("[delete-worker] Non-blocking activity log insert failure:", logErr);
    }

    // 12. Return Clean Success Response
    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully.",
        deleted_user_id: targetUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[delete-worker] Unhandled exception:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
