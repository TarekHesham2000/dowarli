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
- أجب بـ JSON فقط بدون أي شرح أو نص إضافي، بصيغة:
{"area":"","maxPrice":null,"unitType":"","keywords":""}
مثال: 
للطلب "شقة للإيجار في المنصورة بحد أقصى 3000 جنيه شهريًا، مناسبة للطلاب" يجب أن تجيب بـ:
{"area":"المنصورة","maxPrice":3000,"unitType":"student","keywords":""}
للطلب "أريد شقة للإيجار في القاهرة أو الجيزة، بحد أقصى 5000 جنيه شهريًا، مناسبة للعائلات" يجب أن تجيب بـ:
{"area":"القاهرة أو الجيزة","maxPrice":5000,"unitType":"family","keywords":""}
للطلب "شقة للإيجار في الإسكندرية، بحد أقصى 4000 جنيه شهريًا، مناسبة للموظفين" يجب أن تجيب بـ:
{"area":"الإسكندرية","maxPrice":4000,"unitType":"employee","keywords":""}
للطلب "شقة للإيجار في أسيوط، بحد أقصى 2000 جنيه شهريًا، مناسبة للاستوديوهات" يجب أن تجيب بـ:
{"area":"أسيوط","maxPrice":2000,"unitType":"studio","keywords":""}
للطلب "شقة للإيجار في سوهاج، بحد أقصى 2500 جنيه شهريًا، مناسبة للمشاركة" يجب أن تجيب بـ:
{"area":"سوهاج","maxPrice":2500,"unitType":"shared","keywords":""}
للطلب "شقة للإيجار في المنيا، بحد أقصى 3500 جنيه شهريًا، مناسبة للعائلات أو الموظفين" يجب أن تجيب بـ:
{"area":"المنيا","maxPrice":3500,"unitType":"family/employee","keywords":""}
للطلب "شقة للإيجار في القاهرة، بحد أقصى 4500 جنيه شهريًا، مناسبة للطلاب أو العائلات، قريبة من الجامعة" يجب أن تجيب بـ:
{"area":"القاهرة","maxPrice":4500,"unitType":"student/family","keywords":"قريبة من الجامعة"}
للطلب "شقة للإيجار في الجيزة، بحد أقصى 3000 جنيه شهريًا، مناسبة للموظفين، تحتوي على غرفة نوم واحدة" يجب أن تجيب بـ:
{"area":"الجيزة","maxPrice":3000,"unitType":"employee","keywords":"تحتوي على غرفة نوم واحدة"}
للطلب "شقة للإيجار في الإسكندرية، بحد أقصى 4000 جنيه شهريًا، مناسبة للعائلات، تحتوي على شرفة" يجب أن تجيب بـ:
{"area":"الإسكندرية","maxPrice":4000,"unitType":"family","keywords":"تحتوي على شرفة"}

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