import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ area: "", maxPrice: null, unitType: "", keywords: "" });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `أنت مساعد لتحليل طلبات البحث عن شقق في مصر.
حلل هذا الطلب: "${query}"

استخرج:
- area: المنطقة (مثل: المنصورة، القاهرة، الجيزة، الإسكندرية، أسيوط، سوهاج، المنيا)
- maxPrice: أقصى سعر شهري بالأرقام فقط (null لو مش موجود)
- unitType: نوع الوحدة (student/family/studio/shared/employee أو "" لو مش واضح)
- keywords: كلمات البحث المتبقية المفيدة

أجب بـ JSON فقط:
{"area":"","maxPrice":null,"unitType":"","keywords":""}`
      }]
    })
  });

  const data = await response.json();
  
  try {
    const text = data.content[0].text.trim();
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ area: "", maxPrice: null, unitType: "", keywords: query });
  }
}