import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { data: jobs } = await supabase
    .from("collection_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">수집 작업 이력</h1>

      {!jobs || jobs.length === 0 ? (
        <p className="text-gray-400 text-sm">수집 이력이 없습니다.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">키워드</th>
                <th className="text-left px-4 py-2 font-medium">지역</th>
                <th className="text-left px-4 py-2 font-medium">목표 수</th>
                <th className="text-left px-4 py-2 font-medium">실제 수집</th>
                <th className="text-left px-4 py-2 font-medium">상태</th>
                <th className="text-left px-4 py-2 font-medium">시작일</th>
                <th className="text-left px-4 py-2 font-medium">완료일</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: any) => (
                <tr key={job.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{job.keyword}</td>
                  <td className="px-4 py-2">{job.region}</td>
                  <td className="px-4 py-2">{job.count}</td>
                  <td className="px-4 py-2">{job.result_count ?? "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : job.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {job.status === "completed"
                        ? "완료"
                        : job.status === "failed"
                          ? "실패"
                          : "진행 중"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(job.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
