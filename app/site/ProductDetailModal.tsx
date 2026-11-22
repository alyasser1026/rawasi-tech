"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  type WebsiteProduct,
} from './store-catalog';
import Product4DSpinViewer from './Product4DSpinViewer';

interface ProductDetailModalProps {
  product: WebsiteProduct | null;
  withInstall: boolean;
  onToggleInstall: () => void;
  onAddToCart?: (product: WebsiteProduct, qty: number, withInstall: boolean) => void;
  onClose: () => void;
  whatsappNumber?: string;
  onOpenContact?: () => void;
}

export default function ProductDetailModal({
  product,
  withInstall,
  onToggleInstall,
  onAddToCart,
  onClose,
  whatsappNumber = '',
  onOpenContact,
}: ProductDetailModalProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setQty(1);
    setAdded(false);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const category =
    PRODUCT_CATEGORIES.find((c) => c.id === product.category) || PRODUCT_CATEGORIES[0];
  const imageUrl = getProductImageUrl(product);
  const installExtra = withInstall && product.installPrice ? product.installPrice : 0;
  const unitTotal = product.price > 0 ? product.price + installExtra : 0;
  const totalAmount = unitTotal * qty;
  const cleanWa = (whatsappNumber || '').replace(/[^\d]/g, '');
  const waMsg = `مرحباً فاي تك، أريد تسعيرة وطلب: ${product.name} (${product.code}) — الكمية: ${qty} ${product.unit}${withInstall ? ' (توريد + تركيب)' : ' (توريد فقط)'}`;

  const handleAdd = () => {
    if (product.inStock === false) return;
    onAddToCart?.(product, qty, withInstall);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="pw-pd-overlay" onClick={onClose}>
      <div
        className="pw-pd-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-pd-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pw-pd-head">
          <div>
            <span className="pw-bs-cat">
              {category.shortTitle} · {product.brand}
            </span>
            <h3 id="pw-pd-title">{product.name}</h3>
          </div>
          <button
            type="button"
            className="pw-pd-close"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="pw-pd-grid">
          <div>
            <Product4DSpinViewer
              images={product.spinImages}
              fallbackImage={imageUrl}
              alt={product.name}
              badge={product.badge}
              code={product.code}
            />
            {product.subCategory && (
              <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                التصنيف الفرعي: {product.subCategory}
              </p>
            )}
          </div>

          <div className="pw-pd-info">
            {product.description && <p className="pw-pd-desc">{product.description}</p>}

            {product.specs.length > 0 && (
              <div>
                <strong className="pw-pd-sec-title">المواصفات الفنية</strong>
                <ul className="pw-pd-specs">
                  {product.specs.map((spec) => (
                    <li key={spec}>
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.variants && product.variants.length > 0 && (
              <div>
                <strong className="pw-pd-sec-title">المقاسات / المتغيرات المتوفرة</strong>
                <div className="pw-pd-variants">
                  {product.variants.map((v, idx) => (
                    <span key={idx} className="pw-pd-variant">
                      {[v.name, v.size, v.color, v.price ? `${v.price.toLocaleString('en-US')} ${product.currency}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {product.attachments && product.attachments.length > 0 && (
              <div>
                <strong className="pw-pd-sec-title">الصور والمرفقات الفنية</strong>
                <div className="pw-pd-atts">
                  {product.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/store-media/${encodeURIComponent(att.id)}?download=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pw-pd-att"
                    >
                      <span>تحميل: {att.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <label className="pw-bs-install" style={{ marginTop: 0, paddingTop: 4 }}>
              <input type="checkbox" checked={withInstall} onChange={onToggleInstall} />
              <span>
                {product.installPrice && product.installPrice > 0
                  ? `شامل التركيب (+${product.installPrice.toLocaleString('en-US')} ${product.currency})`
                  : 'شامل التركيب'}
              </span>
            </label>

            <div className="pw-pd-buy-row">
              <div className="pw-pd-price">
                {product.price > 0 ? (
                  <>
                    <strong>{totalAmount.toLocaleString('en-US')}</strong>
                    <span>
                      {product.currency} / {qty > 1 ? `${qty} ${product.unit}` : product.unit}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#a64310' }}>
                    تسعير فوري ومعتمد عند الطلب · {product.unit}
                  </span>
                )}
              </div>

              <div className="pw-pd-qty" aria-label="تحديد الكمية">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="إنقاص الكمية"
                >
                  -
                </button>
                <span>{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="زيادة الكمية"
                >
                  +
                </button>
              </div>
            </div>

            <div className="pw-pd-actions">
              <button
                type="button"
                className={`pw-btn pw-btn-primary ${added ? 'is-added' : ''}`}
                style={{ flex: 1 }}
                disabled={product.inStock === false}
                onClick={handleAdd}
              >
                {product.inStock === false
                  ? 'نفد حالياً'
                  : added
                  ? 'تمت الإضافة للسلة ✓'
                  : 'أضف للسلة'}
              </button>

              {cleanWa ? (
                <a
                  href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pw-btn pw-btn-ghost"
                >
                  واتساب
                </a>
              ) : onOpenContact ? (
                <button type="button" className="pw-btn pw-btn-ghost" onClick={onOpenContact}>
                  استفسار
                </button>
              ) : null}

              <Link
                href={`/store?category=${product.category}`}
                className="pw-btn pw-btn-ghost"
                onClick={onClose}
              >
                عرض القسم بالمتجر ←
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
