import { ImageResponse } from "@vercel/og";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@dropitx/shared/supabase/admin";

export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const adminClient = createAdminClient();

  const { data: share } = await adminClient
    .from("shares")
    .select("filename, title, view_count, is_private, password_hash")
    .eq("slug", slug)
    .single();

  if (!share) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Don't expose metadata for private or password-protected shares
  if (share.is_private || share.password_hash) {
    return new NextResponse("Not found", { status: 404 });
  }

  const title = (share.title ?? share.filename).slice(0, 80);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px",
          backgroundColor: "#0f0f0f",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.3 }}>
          {title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 40,
            fontSize: 20,
            color: "#888888",
          }}
        >
          <span>{share.view_count ?? 0} views</span>
          <span style={{ color: "#a855f7" }}>DropItX</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
