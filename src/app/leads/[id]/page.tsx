import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  const { data: emailLogs } = await supabase
    .from("email_logs")
    .select("*")
    .eq("lead_id", id)
    .order("sent_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/leads" className="text-gray-400 hover:text-black text-sm">
          &larr; 목록으로
        </Link>
        <h1 className="text-2xl font-bold">{lead.company_name}</h1>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
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
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">
            기본 정보
          </h2>
          <InfoRow label="업종" value={lead.category} />
          <InfoRow label="지역" value={lead.region} />
          <InfoRow label="주소" value={lead.address} />
          <InfoRow label="전화" value={lead.phone} />
          <InfoRow label="이메일" value={lead.email} />
          <InfoRow label="웹사이트" value={lead.website} link />
          <InfoRow label="데이터 소스" value={lead.source} />
        </section>

        <section className="border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">분석</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">리드 점수</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full"
                style={{ width: `${lead.score}%` }}
              />
            </div>
            <span className="text-lg font-bold">{lead.score}</span>
          </div>
          {/* 점수 근거 */}
          {lead.score_breakdown && Object.keys(lead.score_breakdown).length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm text-gray-500">점수 근거</span>
              {Object.values(lead.score_breakdown as Record<string, { points: number; reason: string }>).map(
                (item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 bg-black text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      +{item.points}
                    </span>
                    <span className="text-gray-700">{item.reason}</span>
                  </div>
                )
              )}
            </div>
          )}
          <InfoRow label="리뷰 수" value={lead.review_count?.toString()} />
          {lead.review_summary && (
            <div>
              <span className="text-sm text-gray-500">리뷰 요약</span>
              <p className="text-sm mt-1">{lead.review_summary}</p>
            </div>
          )}
          {lead.notes && (
            <div>
              <span className="text-sm text-gray-500">메모</span>
              <p className="text-sm mt-1">{lead.notes}</p>
            </div>
          )}
          <InfoRow
            label="등록일"
            value={new Date(lead.created_at).toLocaleDateString("ko-KR")}
          />
          <InfoRow
            label="수정일"
            value={new Date(lead.updated_at).toLocaleDateString("ko-KR")}
          />
        </section>
      </div>

      {/* 이메일 이력 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">이메일 이력</h2>
        {!emailLogs || emailLogs.length === 0 ? (
          <p className="text-gray-400 text-sm">이메일 이력이 없습니다.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">제목</th>
                  <th className="text-left px-4 py-2 font-medium">상태</th>
                  <th className="text-left px-4 py-2 font-medium">발송</th>
                  <th className="text-left px-4 py-2 font-medium">도달</th>
                  <th className="text-left px-4 py-2 font-medium">오픈</th>
                  <th className="text-left px-4 py-2 font-medium">클릭</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log: any) => (
                  <tr key={log.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{log.subject}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          log.status === "sent"
                            ? "bg-green-50 text-green-700"
                            : log.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {log.status === "sent"
                          ? "발송 완료"
                          : log.status === "failed"
                            ? "실패"
                            : "대기"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {log.delivered_at ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-2">
                      {log.opened_at ? (
                        <span className="text-blue-600 text-xs font-medium" title={new Date(log.opened_at).toLocaleString("ko-KR")}>✓ {new Date(log.opened_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-2">
                      {log.clicked_at ? (
                        <span className="text-purple-600 text-xs font-medium" title={new Date(log.clicked_at).toLocaleString("ko-KR")}>✓ {new Date(log.clicked_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({
  label,
  value,
  link,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      {link && value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate max-w-[200px]"
        >
          {value}
        </a>
      ) : (
        <span className="text-right truncate max-w-[200px]">{value || "-"}</span>
      )}
    </div>
  );
}
