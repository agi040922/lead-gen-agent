import { supabase } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  new: "신규",
  filtered: "필터 통과",
  contacted: "접촉 완료",
  meeting: "미팅",
  negotiation: "협상 중",
  closed_won: "계약 완료",
  closed_lost: "실패",
};

async function getDashboardData() {
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const statuses = Object.keys(STATUS_LABELS);
  const distribution: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    distribution[status] = count || 0;
  }

  const { count: pendingEmails } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: sentEmails } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent");

  const { data: recentJobs } = await supabase
    .from("collection_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentLeads } = await supabase
    .from("leads")
    .select("id, company_name, category, region, score, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    totalLeads: totalLeads || 0,
    distribution,
    pendingEmails: pendingEmails || 0,
    sentEmails: sentEmails || 0,
    recentJobs: recentJobs || [],
    recentLeads: recentLeads || [],
  };
}

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="전체 리드" value={data.totalLeads} />
        <StatCard label="필터 통과" value={data.distribution.filtered || 0} />
        <StatCard label="발송 대기" value={data.pendingEmails} />
        <StatCard label="발송 완료" value={data.sentEmails} />
      </div>

      {/* 파이프라인 분포 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">파이프라인 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{data.distribution[key] || 0}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 수집 이력 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">최근 수집 작업</h2>
        {data.recentJobs.length === 0 ? (
          <p className="text-gray-400 text-sm">수집 이력이 없습니다.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">키워드</th>
                  <th className="text-left px-4 py-2 font-medium">지역</th>
                  <th className="text-left px-4 py-2 font-medium">상태</th>
                  <th className="text-left px-4 py-2 font-medium">수집 수</th>
                  <th className="text-left px-4 py-2 font-medium">일시</th>
                </tr>
              </thead>
              <tbody>
                {data.recentJobs.map((job: any) => (
                  <tr key={job.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{job.keyword}</td>
                    <td className="px-4 py-2">{job.region}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-2">{job.result_count ?? "-"}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(job.created_at).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 최근 리드 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">최근 리드</h2>
        {data.recentLeads.length === 0 ? (
          <p className="text-gray-400 text-sm">리드가 없습니다.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">업체명</th>
                  <th className="text-left px-4 py-2 font-medium">업종</th>
                  <th className="text-left px-4 py-2 font-medium">지역</th>
                  <th className="text-left px-4 py-2 font-medium">점수</th>
                  <th className="text-left px-4 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead: any) => (
                  <tr key={lead.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{lead.company_name}</td>
                    <td className="px-4 py-2">{lead.category || "-"}</td>
                    <td className="px-4 py-2">{lead.region || "-"}</td>
                    <td className="px-4 py-2">{lead.score}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={lead.status} />
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-gray-100 text-gray-700",
    filtered: "bg-blue-50 text-blue-700",
    contacted: "bg-yellow-50 text-yellow-700",
    meeting: "bg-purple-50 text-purple-700",
    negotiation: "bg-orange-50 text-orange-700",
    closed_won: "bg-green-50 text-green-700",
    closed_lost: "bg-red-50 text-red-700",
    running: "bg-blue-50 text-blue-700",
    completed: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    pending: "bg-yellow-50 text-yellow-700",
    sent: "bg-green-50 text-green-700",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
