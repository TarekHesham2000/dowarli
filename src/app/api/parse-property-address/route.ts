import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import type { ParsedPropertyAddress } from "@/lib/parsePropertyAddress";

const EMPTY: ParsedPropertyAddress = { district: "", sub_area: "", landmark: "" };

function parseOpenAiJsonContent(content: string): ParsedPropertyAddress | null {
  const t = content.trim();
  if (!t) return null;
  try {
    const raw = JSON.parse(t) as Record<string, unknown>;
    const district = typeof raw.district === "string" ? raw.district.trim() : "";
    const sub_area = typeof raw.sub_area === "string" ? raw.sub_area.trim() : "";
    const landmark = typeof raw.landmark === "string" ? raw.landmark.trim() : "";
    return { district, sub_area, landmark };
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const raw = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
      const district = typeof raw.district === "string" ? raw.district.trim() : "";
      const sub_area = typeof raw.sub_area === "string" ? raw.sub_area.trim() : "";
      const landmark = typeof raw.landmark === "string" ? raw.landmark.trim() : "";
      return { district, sub_area, landmark };
    } catch {
      return null;
    }
  }
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { governorate?: string; detailed_address?: string };
  try {
    body = (await req.json()) as { governorate?: string; detailed_address?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const governorate = typeof body.governorate === "string" ? body.governorate.trim() : "";
  const detailed = typeof body.detailed_address === "string" ? body.detailed_address.trim() : "";
  if (!governorate || !detailed) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      parsed: EMPTY,
      fallback: true,
      reason: "no_openai_key",
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured Egyptian property address fields. Reply with JSON only: keys district, sub_area, landmark (strings). Use Arabic when the input is Arabic; empty string if unknown. district = main district/neighborhood (not governorate alone). sub_area = finer block. landmark = near X / street / building.",
        },
        {
          role: "user",
          content: `المحافظة (ثابتة من المستخدم): ${governorate}\nالعنوان التفصيلي:\n${detailed}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({
      ok: true,
      parsed: EMPTY,
      fallback: true,
      reason: `openai_http_${response.status}`,
    });
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseOpenAiJsonContent(content);
  if (!parsed) {
    return NextResponse.json({
      ok: true,
      parsed: EMPTY,
      fallback: true,
      reason: "parse_json",
    });
  }

  return NextResponse.json({ ok: true, parsed, fallback: false });
}
