-- 이메일 템플릿 시드 데이터

-- 제조/물류용 템플릿
INSERT INTO email_templates (name, subject, body_html, target_category) VALUES (
  '제조/물류 맞춤 제안',
  '{{company_name}} 대표님, 생산관리 효율화 제안드립니다',
  '<div style="font-family: ''Pretendard'', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
<h2 style="color: #111;">{{company_name}} 대표님께</h2>
<p>안녕하세요, {{company_name}}의 운영 효율화를 도울 수 있는 솔루션을 제안드립니다.</p>
<p>현재 많은 제조/물류 기업들이 <strong>수기 관리</strong>나 <strong>구형 ERP</strong>로 인해 다음과 같은 어려움을 겪고 계십니다:</p>
<ul>
<li>재고 파악에 매번 수작업이 필요</li>
<li>생산 현황을 실시간으로 확인 불가</li>
<li>거래처 관리가 엑셀에 흩어져 있음</li>
</ul>
<p>저희 솔루션은 <strong>클라우드 기반</strong>으로, 도입 후 평균 <strong>업무 시간 40% 절감</strong> 효과를 보이고 있습니다.</p>
<p>15분 온라인 데모를 통해 {{company_name}}에 맞는 활용 방안을 안내드리겠습니다.</p>
<p style="margin-top: 24px;">
<a href="https://cal.com/demo" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">무료 데모 예약하기</a>
</p>
<p style="color: #666; margin-top: 24px; font-size: 14px;">감사합니다.</p>
</div>',
  '제조'
);

-- 의료/병원용 템플릿
INSERT INTO email_templates (name, subject, body_html, target_category) VALUES (
  '의료/병원 맞춤 제안',
  '{{company_name}} 원장님, 병원 운영 효율화 솔루션 안내',
  '<div style="font-family: ''Pretendard'', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
<h2 style="color: #111;">{{company_name}} 원장님께</h2>
<p>안녕하세요, 병원 운영의 디지털 전환을 돕는 솔루션을 소개드립니다.</p>
<p>많은 의료기관에서 다음과 같은 불편을 겪고 계십니다:</p>
<ul>
<li>환자 예약 관리가 수기 또는 구형 시스템</li>
<li>진료 기록과 행정 업무의 이중 입력</li>
<li>환자 리뷰/피드백 관리 부재</li>
</ul>
<p>저희는 <strong>의료 특화 CRM</strong>으로, 예약부터 사후관리까지 한 곳에서 관리할 수 있도록 돕습니다.</p>
<p>{{company_name}}에 맞는 활용 방안을 15분 데모로 안내드리겠습니다.</p>
<p style="margin-top: 24px;">
<a href="https://cal.com/demo" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">무료 데모 예약하기</a>
</p>
<p style="color: #666; margin-top: 24px; font-size: 14px;">감사합니다.</p>
</div>',
  '의료'
);

-- 일반 중소기업용 템플릿
INSERT INTO email_templates (name, subject, body_html, target_category) VALUES (
  '일반 중소기업 제안',
  '{{company_name}} 대표님, 업무 자동화로 비용 절감하세요',
  '<div style="font-family: ''Pretendard'', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
<h2 style="color: #111;">{{company_name}} 대표님께</h2>
<p>안녕하세요, 중소기업 맞춤 업무 자동화 솔루션을 안내드립니다.</p>
<p>혹시 다음 중 해당되는 것이 있으신가요?</p>
<ul>
<li>고객 관리를 엑셀이나 수기로 하고 계신가요?</li>
<li>직원들이 반복 업무에 많은 시간을 쓰고 있나요?</li>
<li>매출/비용 현황 파악이 즉시 안 되나요?</li>
</ul>
<p>저희 솔루션은 <strong>월 9만원</strong>부터 시작하며, 도입 기업의 <strong>87%가 3개월 내 ROI를 달성</strong>했습니다.</p>
<p>{{company_name}}의 상황에 맞는 제안을 드리고 싶습니다.</p>
<p style="margin-top: 24px;">
<a href="https://cal.com/demo" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">무료 상담 예약하기</a>
</p>
<p style="color: #666; margin-top: 24px; font-size: 14px;">감사합니다.</p>
</div>',
  '일반'
);
