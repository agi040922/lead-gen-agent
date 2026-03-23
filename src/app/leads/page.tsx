import { supabase } from "@/lib/supabase";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  new: "신규",
  filtered: "필터 통과",
  contacted: "접촉 완료",
  meeting: "미팅",
  negotiation: "협상 중",
  closed_won: "계약 완료",
  closed_lost: "실패",
};

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status;
  const search = params.search || "";
  const page = parseInt(params.page || "1");
  const pageSize = 20;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("company_name", `%${search}%`);

  const { data: leads, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">리드 목록</h1>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        <form className="flex gap-2" method="GET">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="업체명 검색..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="bg-black text-white px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800"
          >
            검색
          </button>
        </form>
        <div className="flex gap-1.5 flex-wrap">
          <FilterLink href="/leads" label="전체" active={!status} />
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <FilterLink
              key={key}
              href={`/leads?status=${key}${search ? `&search=${search}` : ""}`}
              label={label}
              active={status === key}
            />
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">업체명</th>
              <th className="text-left px-4 py-2 font-medium">전화</th>
              <th className="text-left px-4 py-2 font-medium">이메일</th>
              <th className="text-left px-4 py-2 font-medium">업종</th>
              <th className="text-left px-4 py-2 font-medium">지역</th>
              <th className="text-left px-4 py-2 font-medium">점수</th>
              <th className="text-left px-4 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {!leads || leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  리드가 없습니다.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{lead.phone || "-"}</td>
                  <td className="px-4 py-2 text-gray-600">{lead.email || "-"}</td>
                  <td className="px-4 py-2">{lead.category || "-"}</td>
                  <td className="px-4 py-2">{lead.region || "-"}</td>
                  <td className="px-4 py-2">
                    <ScoreBar score={lead.score} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        lead.status === "closed_won"
                          ? "bg-green-50 text-green-700"
                          : lead.status === "closed_lost"
                            ? "bg-red-50 text-red-700"
                            : lead.status === "filtered"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/leads?page=${p}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
              className={`px-3 py-1 rounded text-sm ${
                p === page
                  ? "bg-black text-white"
                  : "border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">총 {count || 0}개 리드</p>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs border ${
        active
          ? "bg-black text-white border-black"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-black rounded-full" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs">{score}</span>
    </div>
  );
}
