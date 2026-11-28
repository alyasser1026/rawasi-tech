"use client";

import React from 'react';
import { getProductImageUrl, PRODUCT_CATEGORIES, type WebsiteProduct } from './store-catalog';
import Product4DSpinViewer from './Product4DSpinViewer';
import { dispatchOpenCopilotEvent } from './copilot-events';
import { CheckIcon, CloseIcon } from './StoreIcons';

interface StoreProductDetailModalProps {
  detailProduct: WebsiteProduct;
  categoryMap: Record<string, { shortTitle: string }>;
  installSelections: Record<string, boolean>;
  globalInstallMode: boolean;
  detailQty: number;
  setDetailQty: React.Dispatch<React.SetStateAction<number>>;
  addedId: string | null;
  onClose: () => void;
  onToggleInstall: (id: string) => void;
  onAddProduct: (product: WebsiteProduct, withInstall: boolean, qty: number) => void;
}

export default function StoreProductDetailModal({
  detailProduct,
  categoryMap,
  installSelections,
  globalInstallMode,
  detailQty,
  setDetailQty,
  addedId,
  onClose,
  onToggleInstall,
  onAddProduct,
}: StoreProductDetailModalProps) {
  return (
    <div className="st-modal-overlay" onClick={onClose}>
      <div className="st-modal-card st-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="st-modal-head">
          <div>
            <span className="st-prod-cat">
              {(categoryMap[detailProduct.category] || PRODUCT_CATEGORIES[0]).shortTitle} · {detailProduct.brand}
            </span>
            <h3>{detailProduct.name}</h3>
          </div>
          <button type="button" className="st-modal-close" onClick={onClose} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>

        <div className="st-detail-grid">
          <div>
            <Product4DSpinViewer
              images={detailProduct.spinImages}
              fallbackImage={getProductImageUrl(detailProduct)}
              alt={detailProduct.name}
              badge={detailProduct.badge}
              code={detailProduct.code}
            />
            {detailProduct.subCategory && (
              <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                التصنيف الفرعي: {detailProduct.subCategory}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#47525c', lineHeight: 1.7 }}>
              {detailProduct.description}
            </p>

            {detailProduct.specs.length > 0 && (
              <div>
                <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                  المواصفات الفنية
                </strong>
                <ul className="st-detail-specs">
                  {detailProduct.specs.map((spec) => (
                    <li key={spec}>
                      <CheckIcon size={15} />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detailProduct.variants && detailProduct.variants.length > 0 && (
              <div>
                <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                  المقاسات / المتغيرات المتوفرة
                </strong>
                <div className="st-detail-variants">
                  {detailProduct.variants.map((v, idx) => (
                    <span key={idx} className="st-detail-variant-pill">
                      {[v.name, v.size, v.color, v.price ? `${v.price.toLocaleString('en-US')} ${detailProduct.currency}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detailProduct.attachments && detailProduct.attachments.length > 0 && (
              <div>
                <strong style={{ display: 'block', fontSize: '0.84rem', marginBottom: '6px', color: '#14181b' }}>
                  الصور والمرفقات الفنية
                </strong>
                <div className="st-detail-att-list">
                  {detailProduct.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/store-media/${encodeURIComponent(att.id)}?download=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-detail-att-link"
                    >
                      <span>تحميل: {att.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <label className={`st-install-toggle ${(installSelections[detailProduct.id] ?? globalInstallMode) ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={installSelections[detailProduct.id] ?? globalInstallMode}
                onChange={() => onToggleInstall(detailProduct.id)}
              />
              <span>
                {detailProduct.installPrice && detailProduct.installPrice > 0
                  ? `إضافة التركيب (+${detailProduct.installPrice.toLocaleString('en-US')} ${detailProduct.currency})`
                  : 'شامل التركيب عند الطلب'}
              </span>
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '8px', borderTop: '1px solid #efe9df' }}>
              <div>
                {detailProduct.price > 0 ? (
                  <>
                    {detailProduct.oldPrice && detailProduct.oldPrice > detailProduct.price && (
                      <span className="st-price-old">
                        {detailProduct.oldPrice.toLocaleString('en-US')} {detailProduct.currency}
                      </span>
                    )}
                    <div className="st-price-main">
                      <strong>
                        {(
                          (detailProduct.price +
                            ((installSelections[detailProduct.id] ?? globalInstallMode) && detailProduct.installPrice
                              ? detailProduct.installPrice
                              : 0)) *
                          detailQty
                        ).toLocaleString('en-US')}
                      </strong>
                      <span>
                        {detailProduct.currency} ({detailQty} × {detailProduct.unit})
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="st-price-quote">
                    <strong>تسعير فوري عند الطلب</strong>
                    <span>الوحدة: {detailProduct.unit}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="st-qty-box">
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    aria-label="تقليل الكمية"
                  >
                    -
                  </button>
                  <span>{detailQty}</span>
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => q + 1)}
                    aria-label="زيادة الكمية"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!detailProduct.inStock}
                  onClick={() => {
                    const withInst = installSelections[detailProduct.id] ?? globalInstallMode;
                    onAddProduct(detailProduct, withInst, detailQty);
                  }}
                  className={`pw-btn pw-btn-primary ${addedId === detailProduct.id ? 'is-added' : ''}`}
                >
                  {!detailProduct.inStock ? 'نفد حالياً' : addedId === detailProduct.id ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = detailProduct;
                    onClose();
                    dispatchOpenCopilotEvent({
                      productId: target.id,
                      productCode: target.code,
                      productName: target.name,
                      prompt: `عايز أعرف تفاصيل ومواصفات وخيارات التركيب والبدائل للمنتج: ${target.name} (كود ${target.code})`,
                      autoSend: true,
                    });
                  }}
                  className="pw-btn pw-btn-ghost"
                  style={{ borderColor: '#fed7aa', background: '#fff7ed', color: '#c2410c', fontWeight: 800 }}
                >
                  🤖 اسأل الكوبايلوت
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
