import { supabase } from "@/lib/supabase";
import Link from "next/link";

const PIPELINE_STAGES = [
  { key: "new", label: "신규", color: "border-gray-300" },
  { key: "filtered", label: "필터 통과", color: "border-blue-300" },
  { key: "contacted", label: "접촉 완료", color: "border-yellow-300" },
  { key: "meeting", label: "미팅", color: "border-purple-300" },
  { key: "negotiation", label: "협상 중", color: "border-orange-300" },
  { key: "closed_won", label: "계약 완료", color: "border-green-300" },
  { key: "closed_lost", label: "실패", color: "border-red-300" },
];

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const stagesData: Record<string, any[]> = {};

  for (const stage of PIPELINE_STAGES) {
    const { data } = await supabase
      .from("leads")
      .select("id, company_name, category, region, score, email")
      .eq("status", stage.key)
      .order("score", { ascending: false })
      .limit(50);
    stagesData[stage.key] = data || [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">파이프라인</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.key} className="flex-shrink-0 w-64">
            <div className={`border-t-2 ${stage.color} rounded-lg border border-gray-200 p-3`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {stagesData[stage.key].length}
                </span>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {stagesData[stage.key].length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">비어 있음</p>
                ) : (
                  stagesData[stage.key].map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block border border-gray-200 rounded-lg p-3 hover:border-gray-400 transition-colors"
                    >
                      <div className="font-medium text-sm truncate">{lead.company_name}</div>
                      <div className="flex justify-between mt-1.5 text-xs text-gray-500">
                        <span>{lead.category || "-"}</span>
                        <span className="font-medium text-black">{lead.score}점</span>
                      </div>
                      {lead.email && (
                        <div className="text-xs text-gray-400 mt-1 truncate">{lead.email}</div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
