import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">이메일 템플릿</h1>
        <Link
          href="/emails/analytics"
          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          성과 분석 →
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <p className="text-gray-400 text-sm">등록된 템플릿이 없습니다.</p>
      ) : (
        <div className="grid gap-4">
          {templates.map((template: any) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    대상: {template.target_category || "전체"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(template.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium">제목: {template.subject}</p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-black">
                  본문 미리보기
                </summary>
                <div
                  className="mt-2 border border-gray-200 rounded-lg p-4 bg-white"
                  dangerouslySetInnerHTML={{ __html: template.body_html }}
                />
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
