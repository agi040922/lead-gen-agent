import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

// 날짜를 MM/DD 형식으로 포맷
function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 퍼센트 계산 (0 나누기 방지)
function pct(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export default async function EmailAnalyticsPage() {
  // 모든 email_logs를 template 정보와 함께 조회
  const { data: logs } = await supabase
    .from("email_logs")
    .select(
      `
      id,
      lead_id,
      template_id,
      status,
      sent_at,
      delivered_at,
      opened_at,
      clicked_at,
      bounced_at,
      complained_at,
      email_templates (
        id,
        name,
        target_category
      )
    `
    )
    .order("sent_at", { ascending: false });

  // 바운스/스팸 리드 정보 조회
  const bouncedIds =
    logs
      ?.filter((l: any) => l.bounced_at || l.complained_at)
      .map((l: any) => l.lead_id)
      .filter(Boolean) ?? [];

  const { data: bouncedLeads } =
    bouncedIds.length > 0
      ? await supabase
          .from("leads")
          .select("id, company_name, email")
          .in("id", bouncedIds)
      : { data: [] };

  // 최근 이벤트 조회
  const { data: recentEvents } = await supabase
    .from("email_events")
    .select(
      `
      id,
      event_type,
      resend_email_id,
      created_at,
      email_logs!left (
        lead_id,
        leads (company_name)
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  // ── 1. 퍼널 통계 집계 ──────────────────────────────────────────
  const allLogs = logs ?? [];
  const sentCount = allLogs.filter((l: any) => l.status === "sent").length;
  const deliveredCount = allLogs.filter((l: any) => l.delivered_at).length;
  const openedCount = allLogs.filter((l: any) => l.opened_at).length;
  const clickedCount = allLogs.filter((l: any) => l.clicked_at).length;
  const bouncedCount = allLogs.filter((l: any) => l.bounced_at).length;
  const complainedCount = allLogs.filter((l: any) => l.complained_at).length;

  const funnelSteps = [
    { label: "발송", count: sentCount, rate: 100 },
    {
      label: "도달",
      count: deliveredCount,
      rate: pct(deliveredCount, sentCount),
    },
    {
      label: "오픈",
      count: openedCount,
      rate: pct(openedCount, deliveredCount),
    },
    {
      label: "클릭",
      count: clickedCount,
      rate: pct(clickedCount, openedCount),
    },
  ];

  // ── 2. 템플릿별 비교 집계 ─────────────────────────────────────
  const templateMap = new Map<
    string,
    {
      name: string;
      category: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }
  >();

  for (const log of allLogs) {
    const tpl = (log as any).email_templates;
    const key = tpl?.id ?? "unknown";
    if (!templateMap.has(key)) {
      templateMap.set(key, {
        name: tpl?.name ?? "알 수 없음",
        category: tpl?.target_category ?? "-",
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
      });
    }
    const entry = templateMap.get(key)!;
    if ((log as any).status === "sent") entry.sent++;
    if ((log as any).delivered_at) entry.delivered++;
    if ((log as any).opened_at) entry.opened++;
    if ((log as any).clicked_at) entry.clicked++;
  }

  const templateStats = Array.from(templateMap.values()).sort(
    (a, b) => b.sent - a.sent
  );

  // ── 3. 일별 추이 (최근 14일) ──────────────────────────────────
  const today = new Date();
  const dailyData: {
    date: string;
    label: string;
    sent: number;
    opened: number;
    clicked: number;
  }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyData.push({
      date: dateStr,
      label: formatDateLabel(dateStr),
      sent: 0,
      opened: 0,
      clicked: 0,
    });
  }

  for (const log of allLogs) {
    const sentDate = (log as any).sent_at?.slice(0, 10);
    const entry = dailyData.find((d) => d.date === sentDate);
    if (entry) {
      if ((log as any).status === "sent") entry.sent++;
      if ((log as any).opened_at) entry.opened++;
      if ((log as any).clicked_at) entry.clicked++;
    }
  }

  const maxSent = Math.max(...dailyData.map((d) => d.sent), 1);

  // ── 4. 바운스/스팸 목록 ───────────────────────────────────────
  const bouncedLogs = allLogs
    .filter((l: any) => l.bounced_at || l.complained_at)
    .map((l: any) => ({
      ...l,
      lead: bouncedLeads?.find((lead: any) => lead.id === l.lead_id),
    }));

  const eventTypeLabel: Record<string, string> = {
    sent: "발송",
    delivered: "도달",
    opened: "오픈",
    clicked: "클릭",
    bounced: "바운스",
    complained: "스팸신고",
  };

  const eventTypeBadgeClass: Record<string, string> = {
    sent: "bg-gray-100 text-gray-600",
    delivered: "bg-blue-50 text-blue-600",
    opened: "bg-green-50 text-green-700",
    clicked: "bg-emerald-50 text-emerald-700",
    bounced: "bg-red-50 text-red-600",
    complained: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">이메일 성과</h1>
          <p className="text-sm text-gray-500 mt-1">
            발송 퍼널 및 템플릿별 성과 분석
          </p>
        </div>
        <Link
          href="/emails"
          className="text-sm text-gray-500 hover:text-black transition-colors"
        >
          ← 템플릿 목록으로
        </Link>
      </div>

      {/* ① 퍼널 통계 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          퍼널 통계
        </h2>
        {sentCount === 0 ? (
          <p className="text-sm text-gray-400">데이터가 없습니다.</p>
        ) : (
          <>
            <div className="flex items-stretch gap-0">
              {funnelSteps.map((step, idx) => (
                <div key={step.label} className="flex items-center flex-1">
                  <div
                    className="flex-1 border border-gray-200 rounded-lg p-4 text-center"
                    style={{ opacity: 0.4 + (step.rate / 100) * 0.6 }}
                  >
                    <p className="text-xs text-gray-500 mb-1">{step.label}</p>
                    <p className="text-2xl font-bold">{step.count.toLocaleString()}</p>
                    {idx > 0 && (
                      <p className="text-sm text-gray-500 mt-1">{step.rate}%</p>
                    )}
                  </div>
                  {idx < funnelSteps.length - 1 && (
                    <div className="text-gray-300 text-lg px-1">→</div>
                  )}
                </div>
              ))}
            </div>

            {/* 바운스 / 스팸신고 요약 배지 */}
            <div className="flex gap-3 mt-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  bouncedCount > 0
                    ? "bg-red-50 text-red-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                바운스 {bouncedCount}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  complainedCount > 0
                    ? "bg-orange-50 text-orange-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                스팸신고 {complainedCount}
              </span>
            </div>
          </>
        )}
      </section>

      {/* ② 템플릿별 비교 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          템플릿별 비교
        </h2>
        {templateStats.length === 0 ? (
          <p className="text-sm text-gray-400">데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">
                    템플릿
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">
                    업종
                  </th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">
                    발송수
                  </th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">
                    오픈수
                  </th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">
                    오픈율
                  </th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">
                    클릭수
                  </th>
                  <th className="text-right py-2 font-medium text-gray-500">
                    클릭율
                  </th>
                </tr>
              </thead>
              <tbody>
                {templateStats.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 pr-4 text-gray-500">{row.category}</td>
                    <td className="py-3 pr-4 text-right">{row.sent}</td>
                    <td className="py-3 pr-4 text-right">{row.opened}</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={`font-medium ${
                          pct(row.opened, row.sent) >= 30
                            ? "text-green-600"
                            : pct(row.opened, row.sent) >= 15
                            ? "text-yellow-600"
                            : "text-gray-600"
                        }`}
                      >
                        {pct(row.opened, row.sent)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{row.clicked}</td>
                    <td className="py-3 text-right">
                      <span
                        className={`font-medium ${
                          pct(row.clicked, row.opened) >= 10
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {pct(row.clicked, row.opened)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ③ 일별 추이 (최근 14일) */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          일별 추이 (최근 14일)
        </h2>
        {dailyData.every((d) => d.sent === 0) ? (
          <p className="text-sm text-gray-400">데이터가 없습니다.</p>
        ) : (
          <div>
            {/* 범례 */}
            <div className="flex gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-black inline-block" />
                발송
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-gray-400 inline-block" />
                오픈
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />
                클릭
              </span>
            </div>
            {/* 막대 차트 */}
            <div className="flex items-end gap-1 h-32 border-b border-gray-200 pb-1">
              {dailyData.map((day) => {
                const sentHeight = Math.round((day.sent / maxSent) * 100);
                const openHeight = Math.round((day.opened / maxSent) * 100);
                const clickHeight = Math.round((day.clicked / maxSent) * 100);
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex items-end gap-px"
                    title={`${day.date}\n발송:${day.sent} 오픈:${day.opened} 클릭:${day.clicked}`}
                  >
                    <div
                      className="flex-1 bg-black rounded-t-sm"
                      style={{ height: `${sentHeight}%`, minHeight: day.sent > 0 ? "2px" : "0" }}
                    />
                    <div
                      className="flex-1 bg-gray-400 rounded-t-sm"
                      style={{ height: `${openHeight}%`, minHeight: day.opened > 0 ? "2px" : "0" }}
                    />
                    <div
                      className="flex-1 bg-gray-200 rounded-t-sm"
                      style={{ height: `${clickHeight}%`, minHeight: day.clicked > 0 ? "2px" : "0" }}
                    />
                  </div>
                );
              })}
            </div>
            {/* X축 레이블 */}
            <div className="flex gap-1 mt-1">
              {dailyData.map((day) => (
                <div key={day.date} className="flex-1 text-center">
                  <span className="text-[9px] text-gray-400">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ④ 바운스/스팸 알림 */}
      {bouncedLogs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            바운스 / 스팸신고 목록
          </h2>
          <div className="space-y-2">
            {bouncedLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between border border-red-100 bg-red-50 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">
                    {log.lead?.company_name ?? "알 수 없는 업체"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {log.lead?.email ?? "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {log.bounced_at && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      바운스
                    </span>
                  )}
                  {log.complained_at && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                      스팸신고
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ⑤ 최근 이벤트 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          최근 이벤트
        </h2>
        {!recentEvents || recentEvents.length === 0 ? (
          <p className="text-sm text-gray-400">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event: any) => {
              const companyName =
                event.email_logs?.leads?.company_name ?? "알 수 없음";
              const label =
                eventTypeLabel[event.event_type] ?? event.event_type;
              const badgeClass =
                eventTypeBadgeClass[event.event_type] ??
                "bg-gray-100 text-gray-600";
              const occuredAt = event.created_at
                ? new Date(event.created_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-";
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}
                    >
                      {label}
                    </span>
                    <span className="text-sm">{companyName}</span>
                  </div>
                  <span className="text-xs text-gray-400">{occuredAt}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
