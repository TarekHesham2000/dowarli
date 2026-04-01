"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Property = {
  id: number;
  title: string;
  area: string;
  price: number;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  description: string | null;
  address: string | null;
  images: string[];
  unit_type: string;
};

type Stats = {
  totalProperties: number;
  totalLeads: number;
  walletBalance: number;
  name: string;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700" },
  active: { label: "نشط", color: "bg-green-100 text-green-700" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  archived: { label: "مؤرشف", color: "bg-gray-100 text-gray-700" },
};

export default function BrokerDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalProperties: 0,
    totalLeads: 0,
    walletBalance: 0,
    name: "",
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // جيب بيانات السمسار
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, wallet_balance")
      .eq("id", user.id)
      .single();

    // جيب الإعلانات
    const { data: props } = await supabase
      .from("properties")
      .select(
        "id, title, area, price, status, created_at, rejection_reason, description, address, images, unit_type",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    // احسب الـ Leads
    const propertyIds = props?.map((p) => p.id) ?? [];
    let leadsCount = 0;
    if (propertyIds.length > 0) {
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("property_id", propertyIds);
      leadsCount = count ?? 0;
    }

    setStats({
      name: profile?.name ?? "",
      walletBalance: profile?.wallet_balance ?? 0,
      totalProperties: props?.length ?? 0,
      totalLeads: leadsCount,
    });
    setProperties(props ?? []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">{selectedProperty.title}</h2>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-gray-400 text-xl"
              >
                ✕
              </button>
            </div>
            {selectedProperty.images?.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {selectedProperty.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt="property"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}
            <div className="space-y-2 text-sm text-gray-600">
              <p>المنطقة: {selectedProperty.area}</p>
              {selectedProperty.address && (
                <p>العنوان: {selectedProperty.address}</p>
              )}
              <p>السعر: {selectedProperty.price} ج.م</p>
              {selectedProperty.description && (
                <p>الوصف: {selectedProperty.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">أجرلي 🏠</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">أهلاً، {stats.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:underline"
          >
            خروج
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">
              {stats.totalProperties}
            </p>
            <p className="text-gray-500 text-sm mt-1">إعلاناتي</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-3xl font-bold text-green-600">
              {stats.totalLeads}
            </p>
            <p className="text-gray-500 text-sm mt-1">عملاء مهتمين</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-3xl font-bold text-yellow-600">
              {stats.walletBalance} ج.م
            </p>
            <p className="text-gray-500 text-sm mt-1">رصيد المحفظة</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">إعلاناتي</h2>
          <button
            onClick={() => router.push("/broker/add-property")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
          >
            + رفع إعلان جديد
          </button>
        </div>

        {/* Properties Table */}
        {properties.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">مفيش إعلانات لحد دلوقتي</p>
            <button
              onClick={() => router.push("/broker/add-property")}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
            >
              ارفع أول إعلان مجاناً 🚀
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4 text-right">العنوان</th>
                  <th className="p-4 text-right">المنطقة</th>
                  <th className="p-4 text-right">السعر</th>
                  <th className="p-4 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedProperty(p)}
                  >
                    <td className="p-4 font-medium">{p.title}</td>
                    <td className="p-4 text-gray-500">{p.area}</td>
                    <td className="p-4 text-gray-500">{p.price} ج.م</td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_MAP[p.status]?.color}`}
                      >
                        {STATUS_MAP[p.status]?.label}
                        {p.status === "rejected" && p.rejection_reason && (
                          <p className="text-xs text-red-400 mt-1">
                            السبب: {p.rejection_reason}
                          </p>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
