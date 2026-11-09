"use client";

import React, { useState, useMemo } from 'react';
import { EXECUTION_GUIDE_ITEMS, ExecutionItemGuide } from './execution-guide-data';

interface Props {
  initialSearch?: string;
  onNavigateToChecklistSection?: (sectionCode: string) => void;
}

export default function ExecutionGuideDossier({ initialSearch = '', onNavigateToChecklistSection }: Props) {
  const [q, setQ] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [selectedProject, setSelectedProject] = useState<string>('الكل');
  const [expandedId, setExpandedId] = useState<string | null>(EXECUTION_GUIDE_ITEMS[0]?.id || null);

  const categories = useMemo(() => {
    return ['الكل', 'أعمال مدنية وعظم', 'أعمال تشطيبات', 'أعمال كهروميكانيكية (MEP)', 'أعمال متخصصة وعزل'];
  }, []);

  const projects = useMemo(() => {
    return ['الكل', 'برج كابيتال', 'فيلا 657'];
  }, []);

  const filteredItems = useMemo(() => {
    const searchNorm = q.trim().toLowerCase();
    return EXECUTION_GUIDE_ITEMS.filter(item => {
      // Category filter
      if (selectedCategory !== 'الكل' && item.itemCategory !== selectedCategory) {
        return false;
      }
      // Project filter
      if (selectedProject !== 'الكل') {
        if (!item.appliedProject.projectName.includes(selectedProject)) {
          return false;
        }
      }
      // Text search
      if (searchNorm) {
        const fullText = [
          item.itemTitle,
          item.sectionCode,
          item.itemCategory,
          item.prerequisites.description,
          ...item.prerequisites.items,
          ...item.requiredApprovals.submittals,
          item.calculationsAndQuantities.takeoffFormula,
          ...item.calculationsAndQuantities.consumptionRates,
          ...item.preExecutionReview.points,
          ...item.executionSequence.steps.map(s => s.title + ' ' + s.detail),
          ...item.inspectionAndHandover.checkpoints,
          item.approximatePricing.totalRate,
          item.appliedProject.projectName,
          item.appliedProject.siteReality,
        ].join(' ').toLowerCase();

        return fullText.includes(searchNorm);
      }
      return true;
    });
  }, [q, selectedCategory, selectedProject]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const expandAll = () => {
    // If all expanded, collapse
    setExpandedId(null);
  };

  return (
    <div className="pw-exec-dossier" dir="rtl">
      {/* Search and Filters Header */}
      <div className="pw-exec-controls">
        <div className="pw-exec-search-row">
          <div className="pw-exec-search-box">
            <span className="pw-exec-search-icon" aria-hidden>🔍</span>
            <input
              type="search"
              className="pw-exec-search-input"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ابحث في بنود التنفيذ، الاشتراطات، المعادلات، الأسعار، أو مشاريع التطبيق (مثال: استراوس، بؤج، عزل، كابيتال)..."
              aria-label="بحث في دليل التنفيذ"
            />
            {q && (
              <button type="button" className="pw-exec-search-clear" onClick={() => setQ('')} title="مسح البحث">
                ✕
              </button>
            )}
          </div>
          <div className="pw-exec-quick-stats">
            <span>عرض <strong>{filteredItems.length}</strong> من <strong>{EXECUTION_GUIDE_ITEMS.length}</strong> بند تنفيذي</span>
          </div>
        </div>

        {/* Category & Project Filter Chips */}
        <div className="pw-exec-filters">
          <div className="pw-exec-filter-group">
            <span className="pw-exec-filter-label">القطاع:</span>
            <div className="pw-exec-chips" role="tablist">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`pw-chip ${selectedCategory === cat ? 'is-on' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-exec-filter-group">
            <span className="pw-exec-filter-label">المشروع التطبيقي:</span>
            <div className="pw-exec-chips" role="tablist">
              {projects.map(prj => (
                <button
                  key={prj}
                  type="button"
                  className={`pw-chip ${selectedProject === prj ? 'is-on' : ''}`}
                  onClick={() => setSelectedProject(prj)}
                >
                  {prj}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="pw-exec-list">
        {filteredItems.length === 0 ? (
          <div className="pw-exec-empty">
            <p>لا توجد بنود مطابقة لبحثك في دليل التنفيذ.</p>
            <button type="button" className="pw-ck-btn" onClick={() => { setQ(''); setSelectedCategory('الكل'); setSelectedProject('الكل'); }}>
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <article key={item.id} id={`exec-${item.id}`} className={`pw-exec-card ${isExpanded ? 'is-open' : ''}`}>
                {/* Header Row */}
                <header className="pw-exec-card-header" onClick={() => toggleExpand(item.id)}>
                  <div className="pw-exec-header-left">
                    <span className="pw-exec-code">{item.sectionCode}</span>
                    <div className="pw-exec-titles">
                      <h3>{item.itemTitle}</h3>
                      <div className="pw-exec-meta-pills">
                        <span className="pw-exec-pill pw-pill-cat">{item.itemCategory}</span>
                        <span className="pw-exec-pill pw-pill-unit">{item.unit}</span>
                        <span className="pw-exec-pill pw-pill-prj">🏛️ {item.appliedProject.projectName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pw-exec-header-right">
                    <div className="pw-exec-price-chip" title="السعر التقريبي التقديري">
                      <strong className="pw-exec-price-val">{item.approximatePricing.totalRate}</strong>
                      <small className="pw-exec-price-date">تحديث: {item.lastPriceUpdate}</small>
                    </div>
                    <button
                      type="button"
                      className="pw-exec-toggle-btn"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'طي بطاقة البند' : 'فتح بطاقة البند'}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`pw-ck-chev ${isExpanded ? 'is-rotated' : ''}`}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </header>

                {/* Collapsible Content: The 10 Dimensions */}
                {isExpanded && (
                  <div className="pw-exec-body">
                    {/* Top Shortcut Bar */}
                    <div className="pw-exec-topbar">
                      <div className="pw-exec-dimension-badges">
                        <span className="pw-dim-badge">10 محاور تنفيذية معتمدة</span>
                        <span className="pw-dim-badge is-verified">معايير فاي تك الهندسية</span>
                      </div>
                      {onNavigateToChecklistSection && (
                        <button
                          type="button"
                          className="pw-exec-goto-ck"
                          onClick={() => onNavigateToChecklistSection(item.sectionCode)}
                        >
                          📋 فتح قائمة الفحص السريعة لهذا البند
                        </button>
                      )}
                    </div>

                    <div className="pw-exec-grid">
                      {/* 1. ما يسبق البند */}
                      <section className="pw-exec-block pw-block-prereq">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">📌</span>
                          <h4>1. ما يسبق البند (الأعمال والاشتراطات التمهيدية)</h4>
                        </div>
                        <p className="pw-block-intro">{item.prerequisites.description}</p>
                        <ul className="pw-exec-checklist">
                          {item.prerequisites.items.map((p, idx) => (
                            <li key={idx}><span className="pw-dot" /><span>{p}</span></li>
                          ))}
                        </ul>
                      </section>

                      {/* 2. الاعتمادات المطلوبة */}
                      <section className="pw-exec-block pw-block-approvals">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">📑</span>
                          <h4>2. الاعتمادات المطلوبة (Approvals & Submittals)</h4>
                        </div>
                        <ul className="pw-exec-checklist">
                          {item.requiredApprovals.submittals.map((a, idx) => (
                            <li key={idx}><span className="pw-dot pw-dot-blue" /><span>{a}</span></li>
                          ))}
                          {item.requiredApprovals.authorities.map((auth, idx) => (
                            <li key={`auth-${idx}`}><span className="pw-dot pw-dot-amber" /><strong>الجهات الرسمية: </strong><span>{auth}</span></li>
                          ))}
                        </ul>
                        {item.requiredApprovals.mockupRequired && (
                          <div className="pw-mockup-notice">
                            <strong>🎯 بروتوكول العينة المعتمدة (Mock-up): </strong>
                            <span>{item.requiredApprovals.mockupDetails || 'يلزم تنفيذ عينة أولى معتمدة بالموقع قبل التعميم.'}</span>
                          </div>
                        )}
                      </section>

                      {/* 3. الحسابات والكميات */}
                      <section className="pw-exec-block pw-block-calc">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">📐</span>
                          <h4>3. الحسابات والكميات (معادلات الحصر ونسب الاستهلاك)</h4>
                        </div>
                        <div className="pw-calc-box">
                          <strong>معادلة الحصر الهندسي المعتمدة:</strong>
                          <code className="pw-calc-formula">{item.calculationsAndQuantities.takeoffFormula}</code>
                        </div>
                        <div className="pw-rates-list">
                          <strong>معدلات الاستهلاك القياسية:</strong>
                          <ul>
                            {item.calculationsAndQuantities.consumptionRates.map((r, idx) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="pw-calc-footer">
                          <span><strong>نسبة الهالك الطبيعي المقبولة:</strong> {item.calculationsAndQuantities.standardWaste}</span>
                        </div>
                        {item.calculationsAndQuantities.technicalRules.length > 0 && (
                          <div className="pw-rules-box">
                            <strong>قواعد هندسية ملزمة:</strong>
                            <ul>
                              {item.calculationsAndQuantities.technicalRules.map((tr, idx) => (
                                <li key={idx}>{tr}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </section>

                      {/* 4. ما يراجع قبل التنفيذ */}
                      <section className="pw-exec-block pw-block-review">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">🔍</span>
                          <h4>4. ما يُراجع ويدقق قبل التنفيذ (Pre-execution Review)</h4>
                        </div>
                        <ul className="pw-exec-checklist">
                          {item.preExecutionReview.points.map((pt, idx) => (
                            <li key={idx}><span className="pw-dot pw-dot-red" /><span>{pt}</span></li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    {/* 5. تسلسل التنفيذ (عرض كامل العرض) */}
                    <section className="pw-exec-block pw-block-steps full-width">
                      <div className="pw-block-head">
                        <span className="pw-block-icon">⚙️</span>
                        <h4>5. تسلسل وخطوات التنفيذ الميداني (Step-by-Step Method Statement)</h4>
                      </div>
                      <div className="pw-steps-timeline">
                        {item.executionSequence.steps.map(step => (
                          <div key={step.stepNumber} className="pw-timeline-step">
                            <div className="pw-step-number">{step.stepNumber}</div>
                            <div className="pw-step-content">
                              <h5>{step.title}</h5>
                              <p>{step.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="pw-exec-grid">
                      {/* 6. الاستلام والتسليم */}
                      <section className="pw-exec-block pw-block-inspection">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">📏</span>
                          <h4>6. الاستلام والتسليم ومعايير القبول (Inspection & Quality)</h4>
                        </div>
                        <div className="pw-inspect-section">
                          <strong>نقاط الفحص والاستلام الميداني:</strong>
                          <ul className="pw-exec-checklist">
                            {item.inspectionAndHandover.checkpoints.map((cp, idx) => (
                              <li key={idx}><span className="pw-dot pw-dot-green" /><span>{cp}</span></li>
                            ))}
                          </ul>
                        </div>

                        <div className="pw-tolerances-box">
                          <strong>نسب التفاوت المسموح بها (Tolerances):</strong>
                          <ul>
                            {item.inspectionAndHandover.tolerances.map((tol, idx) => (
                              <li key={idx}>{tol}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="pw-tools-box">
                          <strong>أدوات الفحص والقياس المستخدمة:</strong>
                          <div className="pw-tool-tags">
                            {item.inspectionAndHandover.toolsUsed.map((tool, idx) => (
                              <span key={idx} className="pw-tool-tag">{tool}</span>
                            ))}
                          </div>
                        </div>

                        {item.inspectionAndHandover.rejectionCriteria.length > 0 && (
                          <div className="pw-rejection-box">
                            <strong>🚫 معايير وحالات الرفض الفوري (Rejection Criteria):</strong>
                            <ul>
                              {item.inspectionAndHandover.rejectionCriteria.map((rej, idx) => (
                                <li key={idx}>{rej}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </section>

                      {/* 7. مسار الاعتماد */}
                      <section className="pw-exec-block pw-block-workflow">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">🔄</span>
                          <h4>7. مسار الاعتماد ودورة التسليم (Approval & WIR Workflow)</h4>
                        </div>
                        <div className="pw-workflow-steps">
                          {item.approvalWorkflow.steps.map((ws, idx) => (
                            <div key={idx} className="pw-wf-step">
                              <span className="pw-wf-no">{idx + 1}</span>
                              <p>{ws}</p>
                            </div>
                          ))}
                        </div>
                        <div className="pw-wf-code">
                          <span>رمز نموذج طلب الفحص المعتمد:</span>
                          <code>{item.approvalWorkflow.wirCode}</code>
                        </div>
                      </section>

                      {/* 8 و 9. الأسعار التقريبية وتاريخ آخر تحديث */}
                      <section className="pw-exec-block pw-block-pricing">
                        <div className="pw-block-head">
                          <span className="pw-block-icon">💰</span>
                          <h4>8 & 9. أسعار استرشادية وتاريخ آخر تحديث</h4>
                        </div>
                        <div className="pw-pricing-table">
                          <div className="pw-price-row">
                            <span>تكلفة المواد والخامات:</span>
                            <strong>{item.approximatePricing.materialCostRange}</strong>
                          </div>
                          <div className="pw-price-row">
                            <span>تكلفة المصنعيات والتشغيل:</span>
                            <strong>{item.approximatePricing.laborCostRange}</strong>
                          </div>
                          <div className="pw-price-row is-total">
                            <span>السعر الإجمالي الاسترشادي:</span>
                            <strong className="pw-rate-highlight">{item.approximatePricing.totalRate}</strong>
                          </div>
                        </div>
                        <div className="pw-pricing-meta">
                          <p className="pw-price-notes">{item.approximatePricing.pricingNotes}</p>
                          <div className="pw-price-date-tag">
                            <span>🕒 تاريخ آخر تحديث للسعر: </span>
                            <strong>{item.lastPriceUpdate}</strong>
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* 10. ما يحدث في المشروع التطبيقي (عرض ممتد مميز) */}
                    <section className="pw-exec-block pw-block-applied full-width">
                      <div className="pw-applied-banner">
                        <div className="pw-applied-head">
                          <span className="pw-applied-icon">🏗️</span>
                          <div>
                            <h4>10. ما يحدث في المشروع التطبيقي (الواقع الميداني العملي)</h4>
                            <p className="pw-applied-sub">
                              المشروع: <strong>{item.appliedProject.projectName}</strong> ({item.appliedProject.projectCode}) — {item.appliedProject.location}
                              {item.appliedProject.appliedJobOrder && (
                                <span className="pw-applied-jo"> | أمر الشغل: <code>{item.appliedProject.appliedJobOrder}</code></span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="pw-applied-story">
                          <p>{item.appliedProject.siteReality}</p>
                        </div>

                        {item.appliedProject.practicalChallenges.length > 0 && (
                          <div className="pw-applied-challenges">
                            <h5>تحديات ميدانية حقيقية وكيف تعاملنا معها هندسياً:</h5>
                            <div className="pw-challenges-grid">
                              {item.appliedProject.practicalChallenges.map((ch, idx) => (
                                <div key={idx} className="pw-challenge-card">
                                  <div className="pw-ch-q">
                                    <span className="pw-ch-tag">التحدي الميداني</span>
                                    <p>{ch.challenge}</p>
                                  </div>
                                  <div className="pw-ch-a">
                                    <span className="pw-ch-tag is-sol">الحل الهندسي المنفذ</span>
                                    <p>{ch.solution}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pw-applied-metric">
                          <span className="pw-metric-icon">🏆</span>
                          <p><strong>مؤشر جودة واقعي: </strong>{item.appliedProject.fieldKeyMetric}</p>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
