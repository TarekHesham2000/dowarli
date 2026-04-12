"use client";

import { useState } from "react";

const WA = "https://wa.me/201098599892";

export default function ContactSupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submitMailto = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`تواصل من ${name || "زائر"} — دورلي`);
    const body = encodeURIComponent(
      `الاسم: ${name}\nالبريد: ${email}\n\n${message}`,
    );
    window.location.href = `mailto:support@dowarly.com?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={submitMailto} className="space-y-4 rounded-xl border border-gray-200 bg-[#f9fdfc] p-5">
      <div>
        <label htmlFor="c-name" className="mb-1 block text-xs font-bold text-slate-600">
          الاسم
        </label>
        <input
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-[#00d38d]/20 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="c-email" className="mb-1 block text-xs font-bold text-slate-600">
          البريد الإلكتروني
        </label>
        <input
          id="c-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-[#00d38d]/20 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="c-msg" className="mb-1 block text-xs font-bold text-slate-600">
          رسالتك
        </label>
        <textarea
          id="c-msg"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-[#00d38d]/20 focus:ring-2"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg bg-[#00d38d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
        >
          إرسال عبر البريد
        </button>
        <a
          href={WA}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 no-underline shadow-sm transition hover:bg-gray-50"
        >
          واتساب مباشر
        </a>
      </div>
      <p className="text-xs text-slate-500">يفتح تطبيق البريد أو واتساب حسب اختيارك.</p>
    </form>
  );
}
